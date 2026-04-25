// src/modules/notifications/controllers/notification.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const notificationService = require('../services/notification.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required')) return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  isRead: query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined,
  type: query.type,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class NotificationController {
  // GET /api/v1/notifications
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const result = await notificationService.findAll(options);
      sendResponse(res, 200, result, 'Notifications retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/notifications/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid notification ID');
      const notification = await notificationService.findById(id);
      sendResponse(res, 200, notification, 'Notification found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/notifications
  static async create(req, res) {
    try {
      const { title, message, type, metadata } = req.body;
      if (!title) throw new Error('Title is required');
      if (!message) throw new Error('Message is required');

      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await notificationService.create({ title, message, type, metadata }, currentUser, queryRunner),
        { name: 'CreateNotification' }
      );
      sendResponse(res, 201, data, 'Notification created');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // PATCH /api/v1/notifications/:id/read
  static async markAsRead(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid notification ID');
      const { isRead = true } = req.body;
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await notificationService.markAsRead(id, isRead, currentUser, queryRunner),
        { name: 'MarkNotificationAsRead' }
      );
      sendResponse(res, 200, data, `Notification marked as ${isRead ? 'read' : 'unread'}`);
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/notifications/mark-all-read
  static async markAllAsRead(req, res) {
    try {
      const currentUser = req.user;
      const count = await withTransaction(
        async (queryRunner) => await notificationService.markAllAsRead(currentUser, queryRunner),
        { name: 'MarkAllNotificationsAsRead' }
      );
      sendResponse(res, 200, { count }, `${count} notifications marked as read`);
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // DELETE /api/v1/notifications/:id
  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid notification ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await notificationService.delete(id, currentUser, queryRunner),
        { name: 'DeleteNotification' }
      );
      sendResponse(res, 200, data, 'Notification deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/notifications/stats/unread-count
  static async getUnreadCount(req, res) {
    try {
      const count = await notificationService.getUnreadCount();
      sendResponse(res, 200, { unreadCount: count }, 'Unread count retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/notifications/stats
  static async getStats(req, res) {
    try {
      const stats = await notificationService.getStats();
      sendResponse(res, 200, stats, 'Notification stats retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = NotificationController;