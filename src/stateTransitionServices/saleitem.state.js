//@ts-check

const { logger } = require("../common/utils/logger");

class SaleItemStateTransition {
  async onAdded(saleItem, user = 'system') {
    logger.info(`[SaleItemState] Item added: saleItem id=${saleItem.id}, product=${saleItem.product_id}, quantity=${saleItem.quantity}, price=${saleItem.unit_price}`);
    // Example: update product popularity, send notification if variant is low stock, etc.
  }

  async onUpdated(saleItem, oldQuantity, oldUnitPrice, user = 'system') {
    logger.info(`[SaleItemState] Item updated: id=${saleItem.id}, quantity: ${oldQuantity}→${saleItem.quantity}, price: ${oldUnitPrice}→${saleItem.unit_price}`);
    // Example: log change for audit trail
  }

  async onRemoved(saleItem, user = 'system') {
    logger.info(`[SaleItemState] Item removed: id=${saleItem.id}, product=${saleItem.product_id}, quantity=${saleItem.quantity}`);
    // Example: restore stock (already done in service), invalidate any dependent calculations
  }
}

module.exports = { SaleItemStateTransition };