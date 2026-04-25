// src/subscribers/NotificationSubscriber.js
// @ts-check

const { logger } = require("../common/utils/logger");

console.log("[Subscriber] Loading NotificationSubscriber");

class NotificationSubscriber {
  listenTo() {
    return Notification;
  }

  /**
     * @param {any} entity
     */
  async beforeInsert(entity) {
    try {
      
      logger.info("[NotificationSubscriber] beforeInsert", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationSubscriber] beforeInsert error", err);
    }
  }

  /**
     * @param {any} entity
     */
  async afterInsert(entity) {
    try {
      
      logger.info("[NotificationSubscriber] afterInsert", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationSubscriber] afterInsert error", err);
    }
  }

  /**
     * @param {any} entity
     */
  async beforeUpdate(entity) {
    try {
      
      logger.info("[NotificationSubscriber] beforeUpdate", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationSubscriber] beforeUpdate error", err);
    }
  }

  /**
     * @param {{ entity: any; }} event
     */
  async afterUpdate(event) {
    try {
      const { entity } = event;
      
      logger.info("[NotificationSubscriber] afterUpdate", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationSubscriber] afterUpdate error", err);
    }
  }

  /**
     * @param {any} entity
     */
  async beforeRemove(entity) {
    try {
      
      logger.info("[NotificationSubscriber] beforeRemove", {
        entity: JSON.parse(JSON.stringify(entity)),
      });
    } catch (err) {
      
      logger.error("[NotificationSubscriber] beforeRemove error", err);
    }
  }

  /**
     * @param {any} event
     */
  async afterRemove(event) {
    try {
      
      logger.info("[NotificationSubscriber] afterRemove", {
        event: JSON.parse(JSON.stringify(event)),
      });
    } catch (err) {
      
      logger.error("[NotificationSubscriber] afterRemove error", err);
    }
  }
}

module.exports = NotificationSubscriber;