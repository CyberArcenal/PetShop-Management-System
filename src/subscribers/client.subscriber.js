//@ts-check

const { logger } = require("../common/utils/logger");
const { ClientStateTransition } = require("../stateTransitionServices/client.state");

class ClientSubscriber {
  constructor() {
    this.stateTransition = new ClientStateTransition();
  }

  listenTo() {
    return 'Client'; // entity name from EntitySchema
  }

  async afterInsert(entity) {
    logger.info('[ClientSubscriber] afterInsert', { id: entity.id, name: entity.name });
    await this.stateTransition.onCreated(entity);
  }

  async afterUpdate(event) {
    if (!event.entity) return;
    const oldClient = event.databaseEntity;
    const newClient = event.entity;
    if (!oldClient) return;

    // Soft delete detection
    if (oldClient.is_deleted !== newClient.is_deleted && newClient.is_deleted === true) {
      await this.stateTransition.onDeleted(newClient);
    } else if (!newClient.is_deleted) {
      // Only report updates for non-deleted clients
      let hasChange = false;
      if (oldClient.name !== newClient.name) hasChange = true;
      if (oldClient.email !== newClient.email) hasChange = true;
      if (oldClient.phone !== newClient.phone) hasChange = true;
      if (oldClient.address !== newClient.address) hasChange = true;
      if (hasChange) {
        await this.stateTransition.onUpdated(newClient, oldClient);
      }
    }
  }

  async afterRemove(event) {
    logger.info('[ClientSubscriber] afterRemove (hard delete)', { id: event.entityId });
  }
}

module.exports = ClientSubscriber;