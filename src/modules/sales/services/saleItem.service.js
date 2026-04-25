//@ts-check
const { AppDataSource } = require('../../../db/datasource');

class SaleItemService {
  constructor() {
    this.saleItemRepo = null;
    this.saleService = null;
    this.productService = null;
  }

  async initialize() {
    if (this.saleItemRepo) return;
    const { SaleItemEntity } = require('../entities/saleItem.entity');
    const saleService = require('./sale.service');
    const productService = require('../../products/services/product.service');

    this.saleItemRepo = AppDataSource.getRepository(SaleItemEntity);
    this.saleService = saleService;
    this.productService = productService;

    await this.saleService.initialize();
    await this.productService.initialize();
    console.log('SaleItemService initialized');
  }

  async getRepositories() {
    if (!this.saleItemRepo) await this.initialize();
    return { saleItem: this.saleItemRepo };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  async _recalculateSaleTotal(saleId) {
    const { saleItem: repo } = await this.getRepositories();
    const items = await repo.find({ where: { sale_id: saleId, is_deleted: false } });
    const newTotal = items.reduce((sum, item) => sum + item.total_price, 0);
    // Update sale total without triggering full updateDb (use direct update)
    const { sale: saleRepo } = await this.saleService.getRepositories();
    await saleRepo.update(saleId, { total_amount: newTotal, updated_at: new Date() });
    return newTotal;
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Add an item to an existing sale
   * @param {number} saleId
   * @param {Object} data
   * @param {number} data.productId
   * @param {number} data.quantity
   * @param {number} data.unitPrice
   * @param {string} user
   */
  async addItem(saleId, data, user = 'system') {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { saleItem: repo } = await this.getRepositories();

    try {
      // Verify sale exists and is not in a final state
      const sale = await this.saleService.findById(saleId);
      if (!sale) throw new Error(`Sale with ID ${saleId} not found`);
      // Do NOT allow adding items to paid or cancelled sales
      if (sale.status === 'paid' || sale.status === 'cancelled') {
        throw new Error(`Cannot add items to a sale with status "${sale.status}"`);
      }

      if (data.quantity <= 0) throw new Error('Quantity must be positive');
      if (data.unitPrice <= 0) throw new Error('Unit price must be positive');

      // Check product existence
      await this.productService.findById(data.productId);

      const item = repo.create({
        sale_id: saleId,
        product_id: data.productId,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        total_price: data.quantity * data.unitPrice,
      });
      const savedItem = await saveDb(repo, item);

      // Adjust stock (reduce)
      await this.productService.removeStock(data.productId, data.quantity, user);

      // Recalculate sale total (but do NOT change sale status)
      await this._recalculateSaleTotal(saleId);

      await auditLogger.logCreate('SaleItem', savedItem.id, savedItem, user);
      return savedItem;
    } catch (error) {
      console.error('Failed to add sale item:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing sale item (quantity, unitPrice)
   * @param {number} itemId
   * @param {Object} data
   * @param {number} [data.quantity]
   * @param {number} [data.unitPrice]
   * @param {string} user
   */
  async updateItem(itemId, data, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { saleItem: repo } = await this.getRepositories();

    try {
      const item = await repo.findOne({ where: { id: itemId, is_deleted: false } });
      if (!item) throw new Error(`SaleItem with ID ${itemId} not found`);
      const sale = await this.saleService.findById(item.sale_id);
      if (sale.status === 'paid' || sale.status === 'cancelled') {
        throw new Error(`Cannot modify items of a sale with status "${sale.status}"`);
      }

      const oldQuantity = item.quantity;
      const oldUnitPrice = item.unit_price;

      let quantityDelta = 0;
      if (data.quantity !== undefined) {
        if (data.quantity <= 0) throw new Error('Quantity must be positive');
        quantityDelta = data.quantity - oldQuantity;
        item.quantity = data.quantity;
      }
      if (data.unitPrice !== undefined) {
        if (data.unitPrice <= 0) throw new Error('Unit price must be positive');
        item.unit_price = data.unitPrice;
      }
      item.total_price = item.quantity * item.unit_price;

      // Adjust stock
      if (quantityDelta !== 0) {
        if (quantityDelta > 0) {
          await this.productService.removeStock(item.product_id, quantityDelta, user);
        } else {
          await this.productService.addStock(item.product_id, -quantityDelta, user);
        }
      }

      const updatedItem = await updateDb(repo, item);
      await this._recalculateSaleTotal(item.sale_id);
      await auditLogger.logUpdate('SaleItem', itemId, { quantity: oldQuantity, unitPrice: oldUnitPrice }, updatedItem, user);
      return updatedItem;
    } catch (error) {
      console.error('Failed to update sale item:', error.message);
      throw error;
    }
  }

  /**
   * Remove an item from a sale (soft delete)
   * @param {number} itemId
   * @param {string} user
   */
  async removeItem(itemId, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { saleItem: repo } = await this.getRepositories();

    try {
      const item = await repo.findOne({ where: { id: itemId, is_deleted: false } });
      if (!item) throw new Error(`SaleItem with ID ${itemId} not found`);
      const sale = await this.saleService.findById(item.sale_id);
      if (sale.status === 'paid' || sale.status === 'cancelled') {
        throw new Error(`Cannot remove items from a sale with status "${sale.status}"`);
      }

      // Restore stock
      await this.productService.addStock(item.product_id, item.quantity, user);

      // Soft delete the item
      item.is_deleted = true;
      item.updated_at = new Date();
      const deletedItem = await updateDb(repo, item);
      await this._recalculateSaleTotal(item.sale_id);
      await auditLogger.logDelete('SaleItem', itemId, { quantity: item.quantity }, user);
      return deletedItem;
    } catch (error) {
      console.error('Failed to remove sale item:', error.message);
      throw error;
    }
  }

  /**
   * Find sale item by ID (with relations)
   * @param {number} id
   */
  async findById(id) {
    const { saleItem: repo } = await this.getRepositories();
    const item = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ['sale', 'product'],
    });
    if (!item) throw new Error(`SaleItem with ID ${id} not found`);
    return item;
  }

  /**
   * Find all sale items for a sale
   * @param {number} saleId
   */
  async findBySaleId(saleId) {
    const { saleItem: repo } = await this.getRepositories();
    return await repo.find({
      where: { sale_id: saleId, is_deleted: false },
      relations: ['product'],
      order: { id: 'ASC' },
    });
  }
}

const saleItemService = new SaleItemService();
module.exports = saleItemService;