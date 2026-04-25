//@ts-check
const twilio = require("twilio");
const { logger } = require("../common/utils/logger");
const notificationService = require("../modules/notifications/services/Notification");
require("dotenv").config();

class SmsSender {
  constructor() {
    this.client = null;
    this.config = null;
  }

  /**
   * Load Twilio credentials from environment variables.
   */
  loadConfig() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials missing. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env");
    }

    return { accountSid, authToken, phoneNumber, messagingServiceSid };
  }

  async initialize() {
    if (this.client) return this;

    try {
      this.config = this.loadConfig();
      const { accountSid, authToken } = this.config;

      this.client = twilio(accountSid, authToken);
      logger.info("✅ Twilio client initialized successfully");
      return this;
    } catch (error) {
      logger.error("❌ Failed to initialize Twilio client", error);
      throw error;
    }
  }

  /**
   * Format phone number to E.164 standard (used by Twilio).
   * @param {string} phone
   * @returns {string}
   */
  formatPhoneNumber(phone) {
    let formatted = phone.replace(/\D/g, "");
    if (formatted.startsWith("0")) {
      formatted = "+63" + formatted.substring(1); // 🇵🇭 default to Philippines
    } else if (!formatted.startsWith("+")) {
      formatted = "+" + formatted;
    }
    return formatted;
  }

  /**
   * Send a single SMS.
   * @param {string} to - phone number
   * @param {string} message - SMS body
   * @param {object} options - additional Twilio options
   * @returns {Promise<object>}
   */
  async send(to, message, options = {}) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const { phoneNumber, messagingServiceSid } = this.config;
      const from = messagingServiceSid || phoneNumber;
      const formattedTo = this.formatPhoneNumber(to);

      if (!from) {
        throw new Error("Neither TWILIO_PHONE_NUMBER nor TWILIO_MESSAGING_SERVICE_SID is set");
      }

      logger.info(`📱 Preparing SMS → From: ${from}, To: ${formattedTo}, Message: "${message.substring(0, 50)}..."`);

      const smsOptions = {
        body: message,
        from,
        to: formattedTo,
        ...options,
      };

      const result = await this.client.messages.create(smsOptions);

      logger.info(`✅ SMS sent → To: ${formattedTo}, SID: ${result.sid}, Status: ${result.status}`);
      return {
        success: true,
        sid: result.sid,
        status: result.status,
        price: result.price,
      };
    } catch (error) {
      logger.error(`❌ Failed to send SMS → To: ${to}`, error);

      try {
        // Create an in‑app notification about the failure
        await notificationService.create(
          {
            userId: 1, // system user (adjust as needed)
            title: "SMS Sending Failed",
            message: `Failed to send SMS to ${to}: ${error.message}`,
            type: "error",
            metadata: {
              to,
              message,
              error: error.message,
              stack: error.stack,
            },
          },
          "system"
        );
      } catch (notifErr) {
        logger.error("Failed to send error notification for SMS", notifErr);
      }
      throw error;
    }
  }

  /**
   * Send bulk SMS to multiple recipients (with a short delay between sends).
   * @param {string[]} recipients - array of phone numbers
   * @param {string} message - SMS body
   * @param {object} options - additional Twilio options
   * @returns {Promise<object[]>}
   */
  async sendBatch(recipients, message, options = {}) {
    const results = [];
    logger.info(`📱 Bulk SMS send initiated → Total recipients: ${recipients.length}`);

    for (const recipient of recipients) {
      try {
        const result = await this.send(recipient, message, options);
        results.push({ recipient, ...result });
        // delay a bit to avoid hitting rate limits (adjust as needed)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`❌ Failed batch SMS → To: ${recipient}`, error);
        results.push({ recipient, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    logger.info(`📱 Bulk SMS send completed → Success: ${successCount}, Failed: ${failCount}`);
    return results;
  }
}

module.exports = new SmsSender();