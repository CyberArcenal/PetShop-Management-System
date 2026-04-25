//@ts-check

const { logger } = require("../common/utils/logger");
const { PetStateTransition } = require("../stateTransitionServices/pet.state");

class PetSubscriber {
  constructor() {
    this.stateTransition = new PetStateTransition();
  }

  listenTo() {
    return 'Pet'; // must match the entity name used in EntitySchema
  }

  async beforeInsert(entity) {
    logger.debug('[PetSubscriber] beforeInsert', { id: entity.id });
  }

  async afterInsert(entity) {
    logger.info('[PetSubscriber] afterInsert', { id: entity.id, name: entity.name });
    await this.stateTransition.onCreated(entity);
  }

  async beforeUpdate(entity) {
    // optional
  }

  /** @param {{ databaseEntity?: any; entity: any }} event */
  async afterUpdate(event) {
    if (!event.entity) return;

    const oldPet = event.databaseEntity;
    const newPet = event.entity;

    if (!oldPet) return;

    // Detect soft‑delete
    if (oldPet.is_deleted !== newPet.is_deleted && newPet.is_deleted === true) {
      await this.stateTransition.onDeleted(newPet);
    }

    // Detect other important changes (e.g., medical_notes, weight)
    let hasChange = false;
    if (oldPet.name !== newPet.name) hasChange = true;
    if (oldPet.species !== newPet.species) hasChange = true;
    if (oldPet.breed !== newPet.breed) hasChange = true;
    if (oldPet.birth_date !== newPet.birth_date) hasChange = true;
    if (oldPet.weight !== newPet.weight) hasChange = true;
    if (oldPet.medical_notes !== newPet.medical_notes) hasChange = true;

    if (hasChange && !newPet.is_deleted) { // not needed for deleted pets (already handled)
      await this.stateTransition.onUpdated(newPet, oldPet);
    }
  }

  async beforeRemove(entity) {
    logger.info('[PetSubscriber] beforeRemove (hard delete)', { id: entity.id });
  }

  async afterRemove(event) {
    logger.info('[PetSubscriber] afterRemove (hard delete)', { id: event.entityId });
  }
}

module.exports = PetSubscriber;