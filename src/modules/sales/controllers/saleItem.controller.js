// src/modules/sales/controllers/saleItem.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const saleItemService = require('../services/saleItem.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required') || err.message.includes('positive')) return 400;
  return 500;
};

class SaleItemController {
  // GET /api/v1/sale-items/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale item ID');
      const item = await saleItemService.findById(id);
      sendResponse(res, 200, item, 'Sale item found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/sale-items/by-sale/:saleId
  static async getBySaleId(req, res) {
    try {
      const saleId = toInt(req.params.saleId);
      if (isNaN(saleId)) throw new Error('Invalid sale ID');
      const items = await saleItemService.findBySaleId(saleId);
      sendResponse(res, 200, items, 'Sale items retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/sale-items
  static async addItem(req, res) {
    try {
      const { saleId, productId, quantity, unitPrice } = req.body;
      if (!saleId) throw new Error('Sale ID is required');
      if (!productId) throw new Error('Product ID is required');
      if (quantity === undefined) throw new Error('Quantity is required');
      if (unitPrice === undefined) throw new Error('Unit price is required');

      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleItemService.addItem(saleId, { productId, quantity, unitPrice }, currentUser, queryRunner),
        { name: 'AddSaleItem' }
      );
      sendResponse(res, 201, data, 'Sale item added');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // PUT /api/v1/sale-items/:id
  static async updateItem(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale item ID');
      const { quantity, unitPrice } = req.body;
      if (quantity === undefined && unitPrice === undefined) {
        throw new Error('At least one of quantity or unitPrice is required');
      }
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleItemService.updateItem(id, { quantity, unitPrice }, currentUser, queryRunner),
        { name: 'UpdateSaleItem' }
      );
      sendResponse(res, 200, data, 'Sale item updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // DELETE /api/v1/sale-items/:id
  static async removeItem(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale item ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleItemService.removeItem(id, currentUser, queryRunner),
        { name: 'RemoveSaleItem' }
      );
      sendResponse(res, 200, data, 'Sale item removed');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = SaleItemController;