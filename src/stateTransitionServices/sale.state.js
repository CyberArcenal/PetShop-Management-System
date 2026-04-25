//@ts-check

const { logger } = require("../common/utils/logger");

class SaleStateTransition {
  async onPaid(sale, user = 'system') {
    logger.info(`Sale ${sale.id} (${sale.invoice_number}) paid.`);
    // e.g., send receipt, update inventory (already reduced at creation), etc.
  }

  async onCancelled(sale, oldStatus, user = 'system') {
    logger.info(`Sale ${sale.id} cancelled from ${oldStatus}`);
    // Stock will be restored automatically in service, but we can log.
  }
}

module.exports = { SaleStateTransition };