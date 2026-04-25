//@ts-check

const { logger } = require("../common/utils/logger");

class PetStateTransition {
  /**
   * Called after a pet is created (afterInsert)
   * @param {Object} pet
   * @param {string} user
   */
  async onCreated(pet, user = 'system') {
    logger.info(`[PetState] Pet created: id=${pet.id}, name=${pet.name}, client=${pet.client_id}`);
    // Example: send welcome email to client, add to loyalty program, etc.
  }

  /**
   * Called after a pet is updated (significant fields changed)
   * @param {Object} pet
   * @param {Object} oldData
   * @param {string} user
   */
  async onUpdated(pet, oldData, user = 'system') {
    logger.info(`[PetState] Pet updated: id=${pet.id}`);
    if (pet.medical_notes !== oldData.medical_notes) {
      logger.info(`Medical notes changed for pet ${pet.id}`);
    }
    if (pet.weight !== oldData.weight) {
      logger.info(`Weight changed for pet ${pet.id}: ${oldData.weight} → ${pet.weight}`);
    }
  }

  /**
   * Called after a pet is soft‑deleted (is_deleted becomes true)
   * @param {Object} pet
   * @param {string} user
   */
  async onDeleted(pet, user = 'system') {
    logger.info(`[PetState] Pet soft‑deleted: id=${pet.id}, name=${pet.name}`);
    // Example: cancel upcoming appointments, archive records
  }
}

module.exports = { PetStateTransition };