// src/modules/clients/controllers/client.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const clientService = require('../services/client.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required') || err.message.includes('already used')) return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  search: query.search,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class ClientController {
  // GET /api/v1/clients
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const result = await clientService.findAll(options);
      sendResponse(res, 200, result, 'Clients retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/clients/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid client ID');
      const client = await clientService.findById(id);
      sendResponse(res, 200, client, 'Client found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/clients
  static async create(req, res) {
    try {
      const { name, email, phone, address } = req.body;
      if (!name) throw new Error('Client name is required');
      if (!email) throw new Error('Email is required');

      const currentUser = req.user; // from JWT middleware
      const data = await withTransaction(
        async (queryRunner) => await clientService.create(req.body, currentUser, queryRunner),
        { name: 'CreateClient' }
      );
      sendResponse(res, 201, data, 'Client created');
    } catch (err) {
      const status = getErrorStatus(err);
      sendResponse(res, status, null, err.message);
    }
  }

  // PUT /api/v1/clients/:id
  static async update(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid client ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await clientService.update(id, req.body, currentUser, queryRunner),
        { name: 'UpdateClient' }
      );
      sendResponse(res, 200, data, 'Client updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // DELETE /api/v1/clients/:id
  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid client ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await clientService.delete(id, currentUser, queryRunner),
        { name: 'DeleteClient' }
      );
      sendResponse(res, 200, data, 'Client deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = ClientController;