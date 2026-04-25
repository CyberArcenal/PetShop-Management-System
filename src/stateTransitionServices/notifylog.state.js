

const emailSender = require("../channels/email.sender");
const { logger } = require("../common/utils/logger");

class NotifyLogStateTransition {
  /**
   * Called after a NotifyLog is created.
   * Sends an email using the stored subject and payload.
   * @param {Object} log - the NotifyLog entity
   * @param {any} user
   */
  async onCreated(log, user = null) {
    if (log.channel !== 'email') {
      logger.info(`[NotifyLogState] Not an email log (channel=${log.channel}), skipping send.`);
      return;
    }

    if (!log.recipient_email || !log.subject || !log.payload) {
      logger.warn(`[NotifyLogState] Missing email data for log ${log.id}`);
      return;
    }

    try {
      const result = await emailSender.send(
        log.recipient_email,
        log.subject,
        log.payload,
        null, // text version (optional)
        {},
        false // sync mode for immediate processing (or true to queue)
      );
      logger.info(`[NotifyLogState] Email sent for log ${log.id}, result: ${JSON.stringify(result)}`);
      // Optionally update the log status to 'sent' and set sent_at
      // This is already handled by the emailSender or can be done here.
    } catch (error) {
      logger.error(`[NotifyLogState] Failed to send email for log ${log.id}`, error);
      // Optionally update log status to 'failed' and set error_message
    }
  }
}

module.exports = { NotifyLogStateTransition };