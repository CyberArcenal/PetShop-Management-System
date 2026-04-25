// src/utils/auditLogger.js
// @ts-check

const { AuditLog } = require("../entities/AuditLog");
const { AppDataSource } = require("../main/db/datasource");
const DeviceInfo = require("./deviceInfo"); // static class, no constructor needed
const { logger } = require("./logger");
const { auditTrailEnabled } = require("./settings/system");


/**
 * @typedef {Object} SystemSettings
 * @property {() => Promise<boolean>} isAuditEnabled
 */

/**
 * @typedef {import('typeorm').DataSource} DataSource
 * @typedef {import('typeorm').Repository<import('../entities/AuditLog').AuditLog>} AuditLogRepository
 */

class AuditLogger {
  /**
   * @param {Object} deps
   * @param {DataSource} deps.dataSource
   * @param {SystemSettings} deps.systemSettings
   */
  constructor() {
    this.dataSource = AppDataSource;
    /** @type {AuditLogRepository | null} */
    this.repository = null;
  }

  /**
   * Ensure the repository is initialized.
   * @private
   */
  async _ensureRepository() {
    if (!this.repository) {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }
      // @ts-ignore
      this.repository = this.dataSource.getRepository(AuditLog);
      logger.debug("AuditLogger repository initialized");
    }
    return this.repository;
  }

  /**
   * Check if audit logging is enabled globally.
   * @private
   */
  async _isEnabled() {
    try {
      return await auditTrailEnabled();
    } catch (err) {
      logger.warn(
        "Failed to read audit enabled setting, defaulting to true",
        // @ts-ignore
        err,
      );
      return true; // fail open
    }
  }

  /**
   * Get the current actor (machine ID) if none provided.
   * @param {string} [actor]
   * @returns {Promise<string>}
   * @private
   */
  async _resolveActor(actor) {
    if (actor) return actor;
    try {
      // Call the static method directly
      return await DeviceInfo.getMachineId();
    } catch (err) {
      logger.error(
        "Failed to get machine ID for audit log, using fallback",
        // @ts-ignore
        err,
      );
      return "unknown-device";
    }
  }

  /**
   * Log an audit event
   * @param {Object} params
   * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, VIEW, etc.)
   * @param {string} params.entity - Entity name (Product, Order, etc.)
   * @param {number|string} [params.entityId] - ID of the affected entity
   * @param {Object} [params.oldData] - Previous data
   * @param {Object} [params.newData] - New data
   * @param {string} [params.actor] - Actor identifier (device ID or username). If omitted, machine ID is used.
   * @param {string} [params.description] - Custom description
   * @returns {Promise<Object|null>} The created audit log entry or null if disabled/failed
   */
  async log({
    action,
    entity,
    entityId,
    oldData,
    newData,
    actor,
    description,
  }) {
    try {
      if (!(await this._isEnabled())) {
        return null;
      }

      const repo = await this._ensureRepository();
      const resolvedActor = await this._resolveActor(actor);

      // @ts-ignore
      const auditLog = repo.create({
        // @ts-ignore
        action,
        entity,
        entityId: entityId != null ? Number(entityId) : null,
        previousData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        user: resolvedActor, // entity column remains 'user'
        description,
        timestamp: new Date(),
      });

      // @ts-ignore
      const saved = await repo.save(auditLog);
      logger.debug(
        `[AUDIT] ${action} on ${entity}${entityId ? ` #${entityId}` : ""} by ${resolvedActor}`,
      );
      return saved;
    } catch (error) {
      // Don't break the app if audit logging fails
      // @ts-ignore
      logger.error("Audit logging failed:", error);
      return null;
    }
  }

  /**
   * Log creation of an entity
   * @param {string} entity
   * @param {number|string} entityId
   * @param {Object} newData
   * @param {string} [actor]
   */
  async logCreate(entity, entityId, newData, actor) {
    return this.log({ action: "CREATE", entity, entityId, newData, actor });
  }

  /**
   * Log update of an entity
   * @param {string} entity
   * @param {number|string} entityId
   * @param {Object} oldData
   * @param {Object} newData
   * @param {string} [actor]
   */
  async logUpdate(entity, entityId, oldData, newData, actor) {
    return this.log({
      action: "UPDATE",
      entity,
      entityId,
      oldData,
      newData,
      actor,
    });
  }

  /**
   * Log deletion of an entity
   * @param {string} entity
   * @param {number|string} entityId
   * @param {Object} oldData
   * @param {string} [actor]
   */
  async logDelete(entity, entityId, oldData, actor) {
    return this.log({ action: "DELETE", entity, entityId, oldData, actor });
  }

  /**
   * Log view/access of an entity
   * @param {string} entity
   * @param {number|string} [entityId]
   * @param {string} [actor]
   */
  async logView(entity, entityId, actor) {
    return;
    
    return this.log({ action: "VIEW", entity, entityId, actor });
  }

  /**
   * Log export action
   * @param {string} entity
   * @param {string} format
   * @param {Object} [filters]
   * @param {string} [actor]
   */
  async logExport(entity, format, filters, actor) {
    return this.log({
      action: "EXPORT",
      entity,
      newData: { format, filters },
      actor,
    });
  }

  /**
   * Get audit logs with filters
   * @param {Object} params
   * @param {string} [params.entity]
   * @param {number|string} [params.entityId]
   * @param {string} [params.action]
   * @param {string} [params.actor] - Filter by actor (device ID or username)
   * @param {Date} [params.startDate]
   * @param {Date} [params.endDate]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=50]
   * @returns {Promise<Object>}
   */
  async getLogs({
    entity,
    entityId,
    action,
    actor,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  }) {
    const repo = await this._ensureRepository();

    // @ts-ignore
    const queryBuilder = repo.createQueryBuilder("log");

    if (entity) {
      queryBuilder.andWhere("log.entity = :entity", { entity });
    }
    if (entityId != null) {
      queryBuilder.andWhere("log.entityId = :entityId", {
        entityId: Number(entityId),
      });
    }
    if (action) {
      queryBuilder.andWhere("log.action = :action", { action });
    }
    if (actor) {
      queryBuilder.andWhere("log.user = :actor", { actor }); // column is 'user'
    }
    if (startDate) {
      queryBuilder.andWhere("log.timestamp >= :startDate", { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere("log.timestamp <= :endDate", { endDate });
    }

    const offset = (page - 1) * limit;
    queryBuilder.orderBy("log.timestamp", "DESC").skip(offset).take(limit);

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs: logs.map((log) => ({
        ...log,
        // @ts-ignore
        previousData: log.previousData ? JSON.parse(log.previousData) : null,
        // @ts-ignore
        newData: log.newData ? JSON.parse(log.newData) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Clear old audit logs (housekeeping)
   * @param {number} daysToKeep - Number of days to retain logs
   * @returns {Promise<number>} Number of deleted records
   */
  async clearOldLogs(daysToKeep = 365) {
    const repo = await this._ensureRepository();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // @ts-ignore
    const result = await repo
      .createQueryBuilder()
      .delete()
      .where("timestamp < :cutoffDate", { cutoffDate })
      .execute();

    logger.info(
      `Cleared ${result.affected} audit logs older than ${daysToKeep} days`,
    );
    return result.affected || 0;
  }
}
const auditLogger = new AuditLogger();
module.exports = auditLogger;
