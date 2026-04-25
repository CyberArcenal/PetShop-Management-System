// src/modules/notifications/controllers/notificationLog.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const { NotificationLogEntityService, LOG_STATUS } = require('../services/notificationLog.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const notificationLogService = new NotificationLogEntityService();

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const getErrorStatus = (err) => 400; // basic mapping

class NotificationLogController {
  // GET /api/v1/notification-logs
  static async getAll(req, res) {
    try {
      const { page, limit, status, startDate, endDate, sortBy, sortOrder } = req.query;
      const result = await notificationLogService.getAllNotifications({
        page: toInt(page) || 1,
        limit: toInt(limit) || 50,
        status,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      });
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, { data: result.data, pagination: result.pagination }, 'Notification logs retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/notification-logs/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid log ID');
      const result = await notificationLogService.getNotificationById({ id });
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, result.data, 'Notification log found');
    } catch (err) {
      sendResponse(res, err.message.includes('not found') ? 404 : 400, null, err.message);
    }
  }

  // GET /api/v1/notification-logs/recipient/:email
  static async getByRecipient(req, res) {
    try {
      const { email } = req.params;
      const { page, limit } = req.query;
      const result = await notificationLogService.getNotificationsByRecipient({
        recipient_email: email,
        page: toInt(page) || 1,
        limit: toInt(limit) || 50,
      });
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, { data: result.data, pagination: result.pagination }, 'Logs by recipient retrieved');
    } catch (err) {
      sendResponse(res, 400, null, err.message);
    }
  }

  // GET /api/v1/notification-logs/search?keyword=...
  static async search(req, res) {
    try {
      const { keyword, page, limit } = req.query;
      if (!keyword) throw new Error('Keyword is required');
      const result = await notificationLogService.searchNotifications({
        keyword,
        page: toInt(page) || 1,
        limit: toInt(limit) || 50,
      });
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, { data: result.data, pagination: result.pagination }, 'Search results');
    } catch (err) {
      sendResponse(res, 400, null, err.message);
    }
  }

  // DELETE /api/v1/notification-logs/:id
  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid log ID');
      const currentUser = req.user;
      const result = await withTransaction(
        async (queryRunner) => await notificationLogService.deleteNotification({ id }, currentUser, queryRunner),
        { name: 'DeleteNotificationLog' }
      );
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, result, 'Notification log deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/notification-logs/:id/retry
  static async retry(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid log ID');
      const currentUser = req.user;
      const result = await withTransaction(
        async (queryRunner) => await notificationLogService.retryFailedNotification({ id }, currentUser, queryRunner),
        { name: 'RetryNotificationLog' }
      );
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, result.data, 'Retry attempted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/notification-logs/:id/resend
  static async resend(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid log ID');
      const currentUser = req.user;
      const result = await withTransaction(
        async (queryRunner) => await notificationLogService.resendNotification({ id }, currentUser, queryRunner),
        { name: 'ResendNotificationLog' }
      );
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, result.data, 'Resend attempted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/notification-logs/stats
  static async getStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const result = await notificationLogService.getNotificationStats({ startDate, endDate });
      if (!result.status) throw new Error(result.message);
      sendResponse(res, 200, result.data, 'Notification log stats');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = NotificationLogController;