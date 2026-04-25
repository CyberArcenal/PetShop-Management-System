// src/modules/auth/controllers/auth.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const authService = require('../services/auth.service');
const {
  withTransaction,
} = require("../../../common/utils/dbUtils/transactionWrapper");

class AuthController {
  static async register(req, res) {
    try {
      const { username, email, password, firstName, lastName, role, isActive } = req.body;
      if (!username) throw new Error('Username required');
      if (!email) throw new Error('Email required');
      if (!password) throw new Error('Password required');

      const userData = { username, email, password, firstName, lastName, role, isActive };
      // Use system user as actor for registration (or maybe the unauthenticated request)
      const systemUser = { id: 'system' };
      const result = await withTransaction(
        async (queryRunner) => await authService.register(userData, systemUser, queryRunner),
        { name: 'RegisterUser' }
      );
      sendResponse(res, 201, result, 'Registration successful');
    } catch (err) {
      const status = err.message.includes('already') ? 400 : 500;
      sendResponse(res, status, null, err.message);
    }
  }

  static async login(req, res) {
    try {
      const { identifier, password } = req.body;
      if (!identifier) throw new Error('Username or email required');
      if (!password) throw new Error('Password required');

      const result = await authService.login(identifier, password);
      sendResponse(res, 200, result, 'Login successful');
    } catch (err) {
      const status = err.message === 'Invalid credentials' ? 401 : 400;
      sendResponse(res, status, null, err.message);
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) throw new Error('Refresh token required');
      const result = await authService.refreshToken(refreshToken);
      sendResponse(res, 200, result, 'Token refreshed');
    } catch (err) {
      sendResponse(res, 401, null, err.message);
    }
  }

  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.logout(refreshToken);
      sendResponse(res, 200, result, 'Logged out');
    } catch (err) {
      sendResponse(res, 500, null, err.message);
    }
  }

  static async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword) throw new Error('Current password required');
      if (!newPassword) throw new Error('New password required');
      const userId = req.user.id; // from JWT
      const result = await authService.changePassword(userId, oldPassword, newPassword, req.user);
      sendResponse(res, 200, result, 'Password changed');
    } catch (err) {
      const status = err.message.includes('incorrect') ? 401 : 400;
      sendResponse(res, status, null, err.message);
    }
  }
}

module.exports = AuthController;