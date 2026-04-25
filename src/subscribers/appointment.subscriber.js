

const { logger } = require("../common/utils/logger");
const { AppointmentStateTransition } = require("../stateTransitionServices/appointment.state");


class AppointmentSubscriber {
  constructor() {
    this.transitionService = new AppointmentStateTransition();
  }

  /**
   * Tells TypeORM which entity this subscriber listens to.
   * @returns {string} - the entity name as defined in the EntitySchema
   */
  listenTo() {
    return 'Appointment';
  }

  async beforeInsert(entity) {
    logger.info('[AppointmentSubscriber] beforeInsert', { id: entity.id });
  }

  async afterInsert(entity) {
    logger.info('[AppointmentSubscriber] afterInsert', { id: entity.id });
  }

  async beforeUpdate(entity) {
    logger.info('[AppointmentSubscriber] beforeUpdate', { id: entity.id });
  }

  /** @param {{ databaseEntity?: any; entity: any }} event */
  async afterUpdate(event) {
    if (!event.entity) return;

    const oldAppointment = event.databaseEntity;
    const newAppointment = event.entity;

    logger.info('[AppointmentSubscriber] afterUpdate', {
      id: newAppointment.id,
      oldStatus: oldAppointment?.status,
      newStatus: newAppointment.status,
    });

    // Only react if status actually changed
    if (oldAppointment && oldAppointment.status === newAppointment.status) return;

    switch (newAppointment.status) {
      case 'Confirmed':
        await this.transitionService.onConfirmed(newAppointment);
        break;
      case 'Completed':
        await this.transitionService.onCompleted(newAppointment);
        break;
      case 'Cancelled':
        await this.transitionService.onCancelled(newAppointment, oldAppointment?.status);
        break;
      case 'NoShow':
        await this.transitionService.onNoShow(newAppointment);
        break;
      default:
        // no action for other statuses (e.g., 'Scheduled')
        break;
    }
  }

  async beforeRemove(entity) {
    logger.info('[AppointmentSubscriber] beforeRemove', { id: entity.id });
  }

  async afterRemove(event) {
    logger.info('[AppointmentSubscriber] afterRemove', { id: event.entityId });
  }
}

module.exports = AppointmentSubscriber;