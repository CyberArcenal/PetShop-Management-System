// src/modules/notifications/services/notificationLog.service.js
const emailSender = require('../../../channels/email.sender');
const { logger } = require('../../../common/utils/logger');
const { AppDataSource } = require('../../../db/datasource');
const { NotificationLogEntity } = require('../entities/notificationLog.entity');
const auditLogger = require('../../../common/utils/auditLogger');

const LOG_STATUS = {
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
  RESEND: "resend",
};

const ALLOWED_SORT_COLUMNS = new Set([
  "id", "recipient_email", "subject", "status", "retry_count",
  "resend_count", "sent_at", "last_error_at", "created_at", "updated_at",
]);

class NotificationLogEntityService {
  constructor(deps = {}) {
    this.repository = deps.repository || AppDataSource.getRepository(NotificationLogEntity);
    this.emailSender = deps.emailSender || emailSender;
    this.logger = deps.logger || logger;
  }

  getRepository(queryRunner) {
    if (queryRunner?.manager) {
      return queryRunner.manager.getRepository(NotificationLogEntity);
    }
    return this.repository;
  }

  _handleError(error, context = "") {
    this.logger.error(`NotificationLogEntityService${context ? ` [${context}]` : ""}:`, error);
    return {
      status: false,
      message: error?.message || "Unknown error",
      data: null,
    };
  }

  // READ OPERATIONS (no user needed, but can add user for audit if required)
  async getAllNotifications(
    { page = 1, limit = 50, status, startDate, endDate, sortBy = "created_at", sortOrder = "DESC" },
    queryRunner,
  ) {
    try {
      const repo = this.getRepository(queryRunner);
      const qb = repo.createQueryBuilder("log");

      if (status) qb.andWhere("log.status = :status", { status });
      if (startDate) qb.andWhere("log.created_at >= :startDate", { startDate });
      if (endDate) qb.andWhere("log.created_at <= :endDate", { endDate });

      const safeSortBy = ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : "created_at";
      qb.orderBy(`log.${safeSortBy}`, sortOrder === "DESC" ? "DESC" : "ASC");

      qb.skip((page - 1) * limit).take(limit);

      const [data, total] = await qb.getManyAndCount();

      return {
        status: true,
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      return this._handleError(error, "getAllNotifications");
    }
  }

  async getNotificationById({ id }, queryRunner) {
    try {
      if (!id) return { status: false, message: "ID is required", data: null };
      const repo = this.getRepository(queryRunner);
      const notification = await repo.findOne({ where: { id } });
      if (!notification) return { status: false, message: "Notification not found", data: null };
      return { status: true, data: notification };
    } catch (error) {
      return this._handleError(error, "getNotificationById");
    }
  }

  async getNotificationsByRecipient({ recipient_email, page = 1, limit = 50 }, queryRunner) {
    try {
      if (!recipient_email) return { status: false, message: "Recipient email is required", data: null };
      const repo = this.getRepository(queryRunner);
      const [data, total] = await repo.findAndCount({
        where: { recipient_email },
        order: { created_at: "DESC" },
        skip: (page - 1) * limit,
        take: limit,
      });
      return {
        status: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      return this._handleError(error, "getNotificationsByRecipient");
    }
  }

  async searchNotifications({ keyword, page = 1, limit = 50 }, queryRunner) {
    try {
      if (!keyword) return { status: false, message: "Keyword is required", data: null };
      const repo = this.getRepository(queryRunner);
      const qb = repo
        .createQueryBuilder("log")
        .where("log.recipient_email LIKE :keyword", { keyword: `%${keyword}%` })
        .orWhere("log.subject LIKE :keyword", { keyword: `%${keyword}%` })
        .orWhere("log.payload LIKE :keyword", { keyword: `%${keyword}%` })
        .orderBy("log.created_at", "DESC")
        .skip((page - 1) * limit)
        .take(limit);
      const [data, total] = await qb.getManyAndCount();
      return {
        status: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      return this._handleError(error, "searchNotifications");
    }
  }

  // WRITE OPERATIONS with user and queryRunner
  async deleteNotification({ id }, user, queryRunner) {
    try {
      if (!id) return { status: false, message: "ID is required", data: null };
      const repo = this.getRepository(queryRunner);
      const notification = await repo.findOne({ where: { id } });
      if (!notification) return { status: false, message: "Notification not found", data: null };
      await repo.remove(notification);
      await auditLogger.logDelete("NotificationLog", id, notification, user.id);
      return { status: true, message: "Notification log deleted successfully" };
    } catch (error) {
      return this._handleError(error, "deleteNotification");
    }
  }

  async updateNotificationStatus({ id, status, errorMessage = null }, user, queryRunner) {
    try {
      if (!id || !status) return { status: false, message: "ID and status are required", data: null };
      const repo = this.getRepository(queryRunner);
      const notification = await repo.findOne({ where: { id } });
      if (!notification) return { status: false, message: "Notification not found", data: null };
      const oldData = { ...notification };
      notification.status = status;
      notification.error_message = errorMessage;
      if (status === LOG_STATUS.SENT) notification.sent_at = new Date();
      else if (status === LOG_STATUS.FAILED) notification.last_error_at = new Date();
      notification.updated_at = new Date();
      const saved = await repo.save(notification);
      await auditLogger.logUpdate("NotificationLog", id, oldData, saved, user.id);
      return { status: true, data: saved };
    } catch (error) {
      return this._handleError(error, "updateNotificationStatus");
    }
  }

  // RETRY / RESEND operations
  async _sendAndUpdate(notification, isResend = false) {
    const sendResult = await this.emailSender.send(
      notification.recipient_email,
      notification.subject || "No Subject",
      notification.payload || "",
      null,
      {},
      false,
    );
    if (sendResult?.success) {
      notification.status = isResend ? LOG_STATUS.RESEND : LOG_STATUS.SENT;
      notification.sent_at = new Date();
      notification.error_message = null;
      notification.last_error_at = null;
    } else {
      notification.status = LOG_STATUS.FAILED;
      notification.last_error_at = new Date();
      notification.error_message = sendResult?.error || "Unknown error";
    }
    if (isResend) {
      notification.resend_count = (notification.resend_count || 0) + 1;
    } else {
      notification.retry_count = (notification.retry_count || 0) + 1;
    }
    notification.updated_at = new Date();
    return sendResult;
  }

  async retryFailedNotification({ id }, user, queryRunner) {
    try {
      if (!id) return { status: false, message: "Notification ID is required", data: null };
      const repo = this.getRepository(queryRunner);
      const notification = await repo.findOne({ where: { id } });
      if (!notification) return { status: false, message: "Notification not found", data: null };
      if (![LOG_STATUS.FAILED, LOG_STATUS.QUEUED].includes(notification.status)) {
        return { status: false, message: `Cannot retry notification with status: ${notification.status}`, data: null };
      }
      const sendResult = await this._sendAndUpdate(notification, false);
      const saved = await repo.save(notification);
      await auditLogger.logUpdate("NotificationLog", id, null, saved, user.id);
      return { status: true, data: saved, sendResult };
    } catch (error) {
      return this._handleError(error, "retryFailedNotification");
    }
  }

  async resendNotification({ id }, user, queryRunner) {
    try {
      if (!id) return { status: false, message: "Notification ID is required", data: null };
      const repo = this.getRepository(queryRunner);
      const notification = await repo.findOne({ where: { id } });
      if (!notification) return { status: false, message: "Notification not found", data: null };
      const sendResult = await this._sendAndUpdate(notification, true);
      const saved = await repo.save(notification);
      await auditLogger.logUpdate("NotificationLog", id, null, saved, user.id);
      return { status: true, data: saved, sendResult };
    } catch (error) {
      return this._handleError(error, "resendNotification");
    }
  }

  // STATISTICS
  async getNotificationStats({ startDate, endDate }, queryRunner) {
    try {
      const repo = this.getRepository(queryRunner);
      const qb = repo.createQueryBuilder("log");
      if (startDate) qb.andWhere("log.created_at >= :startDate", { startDate });
      if (endDate) qb.andWhere("log.created_at <= :endDate", { endDate });
      const statusStats = await qb.clone()
        .select("log.status", "status")
        .addSelect("COUNT(log.id)", "count")
        .groupBy("log.status")
        .getRawMany();
      const total = await qb.clone().getCount();
      const avgRetry = await qb.clone()
        .where("log.status = :status", { status: LOG_STATUS.FAILED })
        .select("AVG(log.retry_count)", "avg")
        .getRawOne();
      const last24h = await qb.clone()
        .where("log.created_at >= :date", { date: new Date(Date.now() - 24 * 60 * 60 * 1000) })
        .getCount();
      const byStatus = statusStats.reduce((acc, { status, count }) => {
        acc[status] = parseInt(count, 10);
        return acc;
      }, {});
      return {
        status: true,
        data: {
          total,
          byStatus,
          avgRetryFailed: parseFloat(avgRetry?.avg) || 0,
          last24h,
        },
      };
    } catch (error) {
      return this._handleError(error, "getNotificationStats");
    }
  }

  async createLog(data, user, queryRunner) {
    try {
      const repo = this.getRepository(queryRunner);
      const log = repo.create({
        recipient_email: data.to,
        subject: data.subject,
        payload: data.html || data.text,
        status: LOG_STATUS.QUEUED,
        retry_count: 0,
        resend_count: 0,
      });
      const saved = await repo.save(log);
      await auditLogger.logCreate("NotificationLog", saved.id, saved, user?.id || "system");
      return { status: true, data: saved };
    } catch (error) {
      return this._handleError(error, "createLog");
    }
  }
}

module.exports = { NotificationLogEntityService, LOG_STATUS };