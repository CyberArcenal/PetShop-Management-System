// src/modules/sales/controllers/sale.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const saleService = require('../services/sale.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const toDate = (value) => (value ? new Date(value) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required') || err.message.includes('positive') || err.message.includes('transition')) return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  clientId: toInt(query.clientId),
  status: query.status,
  fromDate: toDate(query.fromDate),
  toDate: toDate(query.toDate),
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class SaleController {
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const result = await saleService.findAll(options);
      sendResponse(res, 200, result, 'Sales retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale ID');
      const sale = await saleService.findById(id);
      sendResponse(res, 200, sale, 'Sale found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async create(req, res) {
    try {
      const { clientId, items } = req.body;
      if (!clientId) throw new Error('Client ID is required');
      if (!items || items.length === 0) throw new Error('At least one item is required');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleService.create(req.body, currentUser, queryRunner),
        { name: 'CreateSale' }
      );
      sendResponse(res, 201, data, 'Sale created');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async update(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleService.update(id, req.body, currentUser, queryRunner),
        { name: 'UpdateSale' }
      );
      sendResponse(res, 200, data, 'Sale updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async updateStatus(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale ID');
      const { status, paymentMethod, paymentDate } = req.body;
      if (!status) throw new Error('Status is required');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleService.updateStatus(id, { status, paymentMethod, paymentDate }, currentUser, queryRunner),
        { name: 'UpdateSaleStatus' }
      );
      sendResponse(res, 200, data, 'Sale status updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid sale ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await saleService.delete(id, currentUser, queryRunner),
        { name: 'DeleteSale' }
      );
      sendResponse(res, 200, data, 'Sale deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async getStats(req, res) {
    try {
      const stats = await saleService.getStatistics();
      sendResponse(res, 200, stats, 'Sale statistics retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = SaleController;