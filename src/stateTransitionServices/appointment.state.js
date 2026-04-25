

const { logger } = require("../common/utils/logger");

class AppointmentStateTransition {
  constructor() {}

  async onConfirmed(appointment, user = 'system') {
    logger.info(`Appointment ${appointment.id} confirmed.`);
    // Add side effects: send confirmation email, etc.
  }

  async onCompleted(appointment, user = 'system') {
    logger.info(`Appointment ${appointment.id} completed.`);
    // e.g., trigger sale generation
  }

  async onCancelled(appointment, oldStatus, user = 'system') {
    logger.info(`Appointment ${appointment.id} cancelled from ${oldStatus}`);
    // e.g., free up time slot, notify client
  }

  async onNoShow(appointment, user = 'system') {
    logger.info(`Appointment ${appointment.id} marked as no-show.`);
    // e.g., charge no‑show fee
  }
}

module.exports = { AppointmentStateTransition };