const nodemailer = require("nodemailer");
const { logger } = require("../common/utils/logger");
const { AppDataSource } = require("../db/datasource");
const { NotificationLogEntity } = require("../modules/notifications/entities/notificationLog.entity");
const PQueue = require("p-queue").default;
require("dotenv").config();

class EmailSender {
  constructor() {
    this.queue = new PQueue({ concurrency: 1 });
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  /**
   * Get SMTP configuration from environment variables.
   * Falls back to sensible defaults (but will throw if missing when needed).
   */
  getSmtpConfig() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM || "noreply@example.com";
    const secure = port === 465; // implicit TLS

    if (!host || !user || !pass) {
      throw new Error("SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env");
    }

    return { host, port, secure, user, pass, from };
  }

  /**
   * @param {string} to
   * @param {string} subject
   * @param {string} html
   * @param {string} text
   * @param {object} options
   * @param {boolean} asyncMode
   */
  async send(to, subject, html, text, options = {}, asyncMode = true) {
    if (asyncMode) {
      this.queue.add(() =>
        this._sendWithRetry(to, subject, html, text, options)
      );
      logger.info(`📥 Queued email → To: ${to}, Subject: "${subject}"`);
      return { success: true, queued: true };
    } else {
      return await this._sendWithRetry(to, subject, html, text, options);
    }
  }

  /**
   * @private
   */
  async _sendWithRetry(to, subject, html, text, options) {
    const notificationService = require("../modules/notifications/services/Notification");
    let attempt = 0;
    let lastError;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        logger.info(
          `📨 Attempt ${attempt} sending email → To: ${to}, Subject: "${subject}"`
        );

        // 1. Create/update log entry (QUEUED or RESEND)
        const log = await this._updateLog(
          to,
          subject,
          html,
          attempt === 1 ? "queued" : "resend",
          attempt,
          null,
          null
        );

        // 2. Actually send the email
        const result = await this._sendInternal(
          to,
          subject,
          html,
          text,
          options
        );

        // 3. Mark as sent
        await this._updateLog(
          to,
          subject,
          html,
          "sent",
          attempt,
          null,
          log?.id
        );

        logger.info(`✅ Email sent → To: ${to}, Attempt: ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        logger.error(`❌ Attempt ${attempt} failed → To: ${to}`, error);

        await this._updateLog(
          to,
          subject,
          html,
          "failed",
          attempt,
          error.message,
          null
        );

        if (attempt < this.maxRetries) {
          logger.warn(`⏳ Retrying in ${this.retryDelay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    try {
      await notificationService.create(
        {
          userId: 1, // system user
          title: "Email Sending Failed",
          message: `Failed to send email to ${to}: ${lastError.message}`,
          type: "error",
          metadata: {
            to,
            subject,
            error: lastError.message,
            stack: lastError.stack,
          },
        },
        "system"
      );
    } catch (notifErr) {
      logger.error("Failed to send error notification for email", notifErr);
    }

    throw lastError;
  }

  /**
   * @private
   */
  async _sendInternal(to, subject, html, text, options = {}) {
    const config = this.getSmtpConfig();

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const mailOptions = {
      from: config.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
      ...options,
    };

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  }

  /**
   * Upsert a notification log entry.
   * @private
   */
  async _updateLog(to, subject, html, status, retryCount, errorMessage = null, existingLogId = null) {
    const { saveDb } = require("../common/utils/dbUtils/dbActions");
    await this._waitForDbReady();

    const repo = AppDataSource.getRepository(NotificationLogEntity);

    try {
      let log = null;
      if (existingLogId) {
        log = await repo.findOneBy({ id: existingLogId });
      }

      if (!log) {
        log = repo.create({
          recipient_email: to,
          subject,
          payload: html,
          status,
          retry_count: retryCount,
          error_message: errorMessage,
          sent_at: status === "sent" ? new Date() : null,
          last_error_at: status === "failed" ? new Date() : null,
        });
      } else {
        log.status = status;
        log.retry_count = retryCount;
        if (status === "sent") {
          log.sent_at = new Date();
          log.error_message = null;
        } else if (status === "failed") {
          log.last_error_at = new Date();
          log.error_message = errorMessage;
        } else if (status === "resend") {
          log.resend_count = (log.resend_count || 0) + 1;
        }
      }

      const saved = await saveDb(repo, log);
      logger.debug(`📌 NotificationLogEntity ${saved.id} → Status: ${status}, Retry: ${retryCount}`);
      return saved;
    } catch (err) {
      logger.error("❌ Failed to update NotificationLogEntity", err);
      return null;
    }
  }

  /**
   * Wait for TypeORM DataSource to be initialised.
   * @private
   */
  async _waitForDbReady() {
    const maxAttempts = 20;
    let delay = 50;
    for (let i = 0; i < maxAttempts; i++) {
      if (AppDataSource.isInitialized) {
        return true;
      }
      logger.debug(`⏳ Waiting for database connection... (${i + 1}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 2000);
    }
    logger.error("❌ Database not ready after maximum attempts – logging skipped");
    return false;
  }
}

module.exports = new EmailSender();