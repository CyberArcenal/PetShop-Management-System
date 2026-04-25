

const { logger } = require("../common/utils/logger");
const { SaleItemStateTransition } = require("../stateTransitionServices/saleitem.state");

class SaleItemSubscriber {
  constructor() {
    this.stateTransition = new SaleItemStateTransition();
  }

  listenTo() {
    return 'SaleItem';
  }

  /**
   * @param {{ id: any; }} entity
   */
  async afterInsert(entity) {
    logger.info('[SaleItemSubscriber] afterInsert', { id: entity.id });
    await this.stateTransition.onAdded(entity);
  }

  /**
   * @param {{ entity: any; databaseEntity: any; user: any; }} event
   */
  async afterUpdate(event) {
    if (!event.entity) return;
    const oldItem = event.databaseEntity;
    const newItem = event.entity;
    const user = event.user
    if (!oldItem) return;

    // Soft delete detection (is_deleted becomes true)
    if (oldItem.is_deleted !== newItem.is_deleted && newItem.is_deleted === true) {
      await this.stateTransition.onRemoved(newItem);
    } 
    // Quantity or unit price change (only if not deleted)
    else if (!newItem.is_deleted && (oldItem.quantity !== newItem.quantity || oldItem.unit_price !== newItem.unit_price)) {
      await this.stateTransition.onUpdated(newItem, oldItem.quantity, oldItem.unit_price);
    }
  }
}

module.exports = SaleItemSubscriber;