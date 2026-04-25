

const { logger } = require("../common/utils/logger");
const { ProductStateTransition } = require("../stateTransitionServices/product.state");

class ProductSubscriber {
  constructor() {
    this.stateTransition = new ProductStateTransition();
  }

  listenTo() {
    return 'Product'; // entity name from EntitySchema
  }

  /**
   * @param {{ id: any; }} entity
   */
  async beforeInsert(entity) {
    logger.debug('[ProductSubscriber] beforeInsert', { id: entity.id });
  }

  /**
   * @param {Object} entity
   */
  async afterInsert(entity) {
    logger.info('[ProductSubscriber] afterInsert', { id: entity.id, name: entity.name });
    await this.stateTransition.onCreated(entity);
  }

  /** @param {{ databaseEntity?: any; entity: any }} event */
  async afterUpdate(event) {
    if (!event.entity) return;

    const oldProduct = event.databaseEntity;
    const newProduct = event.entity;
    const user = event.user

    if (!oldProduct) return;

    // 1. Soft delete detection
    if (oldProduct.is_deleted !== newProduct.is_deleted && newProduct.is_deleted === true) {
      await this.stateTransition.onDeleted(newProduct);
    }

    // 2. Price change
    if (oldProduct.price !== newProduct.price && newProduct.is_deleted === false) {
      await this.stateTransition.onPriceChanged(newProduct, oldProduct.price);
    }

    // 3. Activation / deactivation
    if (oldProduct.is_active !== newProduct.is_active && newProduct.is_deleted === false) {
      if (newProduct.is_active) {
        await this.stateTransition.onActivated(newProduct);
      } else {
        await this.stateTransition.onDeactivated(newProduct);
      }
    }

    // 4. Low stock condition: stock <= reorder_level (and product is active, not deleted)
    if (newProduct.is_deleted === false && newProduct.is_active === true) {
      // Check if newly crossed the threshold (optional: also trigger if already low but we can trigger every time or use a flag)
      const wasNotLow = oldProduct.stock > oldProduct.reorder_level;
      const isNowLow = newProduct.stock <= newProduct.reorder_level;
      if (wasNotLow && isNowLow) {
        await this.stateTransition.onLowStock(newProduct);
      }
    }

    // Optional: log any other changes (e.g., name, category, description)
    // Not triggering separate events unless needed.
  }

  /**
   * @param {{ id: any; }} entity
   */
  async beforeRemove(entity) {
    logger.info('[ProductSubscriber] beforeRemove (hard delete)', { id: entity.id });
  }

  /**
   * @param {{ entityId: any; }} event
   */
  async afterRemove(event) {
    logger.info('[ProductSubscriber] afterRemove (hard delete)', { id: event.entityId });
  }
}

module.exports = ProductSubscriber;