//@ts-check

const { logger } = require("../common/utils/logger");
const { SaleStateTransition } = require("../stateTransitionServices/sale.state");

class SaleSubscriber {
  constructor() {
    this.transitionService = new SaleStateTransition();
  }

  listenTo() {
    return 'Sale'; // must match the entity name from your SaleEntity
  }

  async beforeInsert(entity) {
    logger.debug('[SaleSubscriber] beforeInsert', { id: entity.id });
  }

  async afterInsert(entity) {
    logger.info('[SaleSubscriber] afterInsert', { id: entity.id });
  }

  async beforeUpdate(entity) {
    // optional
  }

  /** @param {{ databaseEntity?: any; entity: any }} event */
  async afterUpdate(event) {
    if (!event.entity) return;

    const oldSale = event.databaseEntity;
    const newSale = event.entity;

    if (!oldSale) return;

    // Only react if status changed
    if (oldSale.status === newSale.status) return;

    logger.info('[SaleSubscriber] Status changed', { id: newSale.id, from: oldSale.status, to: newSale.status });

    switch (newSale.status) {
      case 'pending':
        await this.transitionService.onPending(newSale);
        break;
      case 'paid':
        await this.transitionService.onPaid(newSale);
        break;
      case 'partially_paid':
        await this.transitionService.onPartiallyPaid(newSale);
        break;
      case 'cancelled':
        await this.transitionService.onCancelled(newSale, oldSale.status);
        break;
      default:
        // other statuses (e.g., 'initiated') have no side effects
        break;
    }
  }

  async beforeRemove(entity) {
    logger.info('[SaleSubscriber] beforeRemove (hard delete)', { id: entity.id });
  }

  async afterRemove(event) {
    logger.info('[SaleSubscriber] afterRemove (hard delete)', { id: event.entityId });
  }
}

module.exports = SaleSubscriber;