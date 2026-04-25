//@ts-check

const { logger } = require("../common/utils/logger");

class SaleStateTransition {
  /**
   * Called when sale status changes to 'pending' (after items are added)
   * @param {Object} sale
   * @param {string} user
   */
  async onPending(sale, user = 'system') {
    logger.info(`[SaleState] Pending: sale ${sale.id} (${sale.invoice_number}) created with total ${sale.total_amount}`);
    // Example: generate draft invoice, notify customer
  }

  /**
   * Called when sale status changes to 'paid'
   * @param {Object} sale
   * @param {string} user
   */
  async onPaid(sale, user = 'system') {
    logger.info(`[SaleState] Paid: sale ${sale.id} (${sale.invoice_number}) paid at ${sale.payment_date}`);
    // Example: send receipt, update accounting, trigger loyalty points
  }

  /**
   * Called when sale status changes to 'partially_paid'
   * @param {Object} sale
   * @param {string} user
   */
  async onPartiallyPaid(sale, user = 'system') {
    logger.info(`[SaleState] Partially paid: sale ${sale.id} (${sale.invoice_number})`);
    // Example: send reminder email, record deposit
  }

  /**
   * Called when sale status changes to 'cancelled'
   * @param {Object} sale
   * @param {string} oldStatus
   * @param {string} user
   */
  async onCancelled(sale, oldStatus, user = 'system') {
    logger.info(`[SaleState] Cancelled: sale ${sale.id} (from ${oldStatus})`);
    // Stock restoration is handled by the sale service (or you can call it here).
    // Example: send cancellation email, update inventory adjustments.
  }
}

module.exports = { SaleStateTransition };