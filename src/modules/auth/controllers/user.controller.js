// src/modules/users/controllers/user.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const userService = require('../services/user.service');
const {
  withTransaction,
} = require("../../../common/utils/dbUtils/transactionWrapper");

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required') || err.message.includes('already')) return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  role: query.role,
  isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
  search: query.search,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class UserController {
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const result = await userService.findAll(options);
      sendResponse(res, 200, result, 'Users retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid user ID');
      const user = await userService.findById(id);
      sendResponse(res, 200, user, 'User found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async create(req, res) {
    try {
      const { username, email, password } = req.body;
      if (!username) throw new Error('Username is required');
      if (!email) throw new Error('Email is required');
      if (!password) throw new Error('Password is required');

      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await userService.create(req.body, currentUser, queryRunner),
        { name: 'CreateUser' }
      );
      sendResponse(res, 201, data, 'User created');
    } catch (err) {
      const status = getErrorStatus(err);
      sendResponse(res, status, null, err.message);
    }
  }

  static async update(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid user ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await userService.update(id, req.body, currentUser, queryRunner),
        { name: 'UpdateUser' }
      );
      sendResponse(res, 200, data, 'User updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid user ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await userService.delete(id, currentUser, queryRunner),
        { name: 'DeleteUser' }
      );
      sendResponse(res, 200, data, 'User deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = UserController;