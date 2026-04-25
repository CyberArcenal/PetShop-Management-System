// src/subscribers/NotificationLogSubscriber.js
// @ts-check

const { logger } = require("../common/utils/logger");
const { NotificationLogEntity } = require("../modules/notifications/entities/notificationLog.entity");

console.log("[Subscriber] Loading NotificationLogSubscriber");

class NotificationLogSubscriber {
  listenTo() {
    return NotificationLogEntity;
  }

  /**
     * @param {any} entity
     */
  async beforeInsert(entity) {
    try {
      
      logger.info("[NotificationLogSubscriber] beforeInsert", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationLogSubscriber] beforeInsert error", err);
    }
  }

  /**
     * @param {any} entity
     */
  async afterInsert(entity) {
    try {
      
      logger.info("[NotificationLogSubscriber] afterInsert", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationLogSubscriber] afterInsert error", err);
    }
  }

  /**
     * @param {any} entity
     */
  async beforeUpdate(entity) {
    try {
      
      logger.info("[NotificationLogSubscriber] beforeUpdate", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationLogSubscriber] beforeUpdate error", err);
    }
  }

  /**
     * @param {{ entity: any; }} event
     */
  async afterUpdate(event) {
    try {
      const { entity } = event;
      
      logger.info("[NotificationLogSubscriber] afterUpdate", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationLogSubscriber] afterUpdate error", err);
    }
  }

  /**
     * @param {any} entity
     */
  async beforeRemove(entity) {
    try {
      
      logger.info("[NotificationLogSubscriber] beforeRemove", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationLogSubscriber] beforeRemove error", err);
    }
  }

  /**
     * @param {any} event
     */
  async afterRemove(event) {
    try {
      
      logger.info("[NotificationLogSubscriber] afterRemove", {
        event: JSON.parse(JSON.stringify(event)),
      });
    } catch (err) {
      
      logger.error("[NotificationLogSubscriber] afterRemove error", err);
    }
  }
}

module.exports = NotificationLogSubscriber;