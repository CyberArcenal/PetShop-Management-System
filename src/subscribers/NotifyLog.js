

const { logger } = require("../common/utils/logger");
const { NotifyLogStateTransition } = require("../stateTransitionServices/notifylog.state");

class NotifyLogSubscriber {
  constructor() {
    this.stateTransition = new NotifyLogStateTransition();
  }

  listenTo() {
    return 'NotifyLog'; // entity name from EntitySchema
  }

  /**
   * @param {Object} entity
   */
  async afterInsert(entity) {
    logger.info(`[NotifyLogSubscriber] afterInsert id=${entity.id}, channel=${entity.channel}`);
    // Only react to queued logs (optional: also resend etc.)
    if (entity.status === 'queued') {
      await this.stateTransition.onCreated(entity);
    }
  }

  /**
   * @param {{ entity: any; databaseEntity: any; user: any; }} event
   */
  async afterUpdate(event) {
    // Optional: react to status changes (e.g., retry logic)
    if (!event.entity) return;
    const oldLog = event.databaseEntity;
    const newLog = event.entity;
    const user = event.user
    if (!oldLog) return;
    if (oldLog.status !== newLog.status && newLog.status === 'queued') {
      // If status changes to queued (e.g., manual retry), also send
      await this.stateTransition.onCreated(newLog);
    }
  }
}

module.exports = NotifyLogSubscriber;