// src/modules/products/controllers/product.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const productService = require('../services/product.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const toFloat = (value) => (value !== undefined ? parseFloat(value) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required') || err.message.includes('must be positive') || err.message.includes('Insufficient stock')) return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  category: query.category,
  isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
  search: query.search,
  minPrice: toFloat(query.minPrice),
  maxPrice: toFloat(query.maxPrice),
  lowStockOnly: query.lowStockOnly === 'true',
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class ProductController {
  // GET /api/v1/products
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const result = await productService.findAll(options);
      sendResponse(res, 200, result, 'Products retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/products/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid product ID');
      const product = await productService.findById(id);
      sendResponse(res, 200, product, 'Product found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/products
  static async create(req, res) {
    try {
      const { name, price } = req.body;
      if (!name) throw new Error('Product name is required');
      if (price === undefined) throw new Error('Price is required');

      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await productService.create(req.body, currentUser, queryRunner),
        { name: 'CreateProduct' }
      );
      sendResponse(res, 201, data, 'Product created');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // PUT /api/v1/products/:id
  static async update(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid product ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await productService.update(id, req.body, currentUser, queryRunner),
        { name: 'UpdateProduct' }
      );
      sendResponse(res, 200, data, 'Product updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // DELETE /api/v1/products/:id
  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid product ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await productService.delete(id, currentUser, queryRunner),
        { name: 'DeleteProduct' }
      );
      sendResponse(res, 200, data, 'Product deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/products/:id/add-stock
  static async addStock(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid product ID');
      const { quantity } = req.body;
      if (quantity === undefined) throw new Error('Quantity is required');
      if (quantity <= 0) throw new Error('Quantity must be positive');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await productService.addStock(id, quantity, currentUser, queryRunner),
        { name: 'AddProductStock' }
      );
      sendResponse(res, 200, data, `Added ${quantity} to stock`);
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/products/:id/remove-stock
  static async removeStock(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid product ID');
      const { quantity } = req.body;
      if (quantity === undefined) throw new Error('Quantity is required');
      if (quantity <= 0) throw new Error('Quantity must be positive');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await productService.removeStock(id, quantity, currentUser, queryRunner),
        { name: 'RemoveProductStock' }
      );
      sendResponse(res, 200, data, `Removed ${quantity} from stock`);
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/products/low-stock
  static async getLowStock(req, res) {
    try {
      const products = await productService.getLowStockProducts();
      sendResponse(res, 200, products, 'Low stock products retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/products/stats
  static async getStats(req, res) {
    try {
      const stats = await productService.getStatistics();
      sendResponse(res, 200, stats, 'Product statistics retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = ProductController;