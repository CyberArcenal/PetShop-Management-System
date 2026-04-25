//@ts-check

const { logger } = require("../common/utils/logger");

class ProductStateTransition {
  /**
   * Called after a product is created
   * @param {Object} product
   * @param {string} user
   */
  async onCreated(product, user = 'system') {
    logger.info(`[ProductState] Product created: id=${product.id}, name=${product.name}, price=${product.price}`);
    // Example: send notification to inventory manager, etc.
  }

  /**
   * Called when product price changes
   * @param {Object} product
   * @param {number} oldPrice
   * @param {string} user
   */
  async onPriceChanged(product, oldPrice, user = 'system') {
    logger.info(`[ProductState] Price changed for product ${product.id}: ${oldPrice} → ${product.price}`);
    // Example: update price lists, notify sales team
  }

  /**
   * Called when product stock drops below or equal to reorder level (low stock)
   * @param {Object} product
   * @param {string} user
   */
  async onLowStock(product, user = 'system') {
    logger.warn(`[ProductState] LOW STOCK for product ${product.id} (${product.name}): stock=${product.stock}, reorder_level=${product.reorder_level}`);
    // Example: create purchase order, send alert to purchasing department
  }

  /**
   * Called when product is activated (is_active changes from false to true)
   * @param {Object} product
   * @param {string} user
   */
  async onActivated(product, user = 'system') {
    logger.info(`[ProductState] Product ${product.id} (${product.name}) activated.`);
  }

  /**
   * Called when product is deactivated (is_active changes from true to false)
   * @param {Object} product
   * @param {string} user
   */
  async onDeactivated(product, user = 'system') {
    logger.info(`[ProductState] Product ${product.id} (${product.name}) deactivated.`);
  }

  /**
   * Called after a product is soft-deleted
   * @param {Object} product
   * @param {string} user
   */
  async onDeleted(product, user = 'system') {
    logger.info(`[ProductState] Product soft-deleted: id=${product.id}, name=${product.name}`);
    // Example: archive product, remove from active listings
  }
}

module.exports = { ProductStateTransition };