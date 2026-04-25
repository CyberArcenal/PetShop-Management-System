//@ts-check

const { logger } = require("../common/utils/logger");

class ClientStateTransition {
  /**
   * Called after a client is created
   * @param {Object} client
   * @param {string} actor
   */
  async onCreated(client, actor = 'system') {
    logger.info(`[ClientState] Client created: ${client.id} (${client.name}, ${client.email})`);
    // Example: send welcome email
    // await emailService.sendWelcome(client.email, client.name);
  }

  /**
   * Called after a client is updated
   * @param {Object} client
   * @param {Object} oldData
   * @param {string} actor
   */
  async onUpdated(client, oldData, actor = 'system') {
    logger.info(`[ClientState] Client updated: ${client.id} (${client.name})`);
    // Example: sync with CRM
  }

  /**
   * Called after a client is soft-deleted
   * @param {Object} client
   * @param {string} actor
   */
  async onDeleted(client, actor = 'system') {
    logger.info(`[ClientState] Client deleted: ${client.id} (${client.name})`);
    // Example: anonymise data, cancel upcoming appointments
  }
}

module.exports = { ClientStateTransition };