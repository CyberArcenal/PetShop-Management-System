// src/modules/reports/controllers/report.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const reportService = require('../services/report.service');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const toDate = (value) => (value ? new Date(value) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  return 500;
};

class ReportController {
  // GET /api/v1/reports/sales-summary
  static async getSalesSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate || endDate ? { startDate: toDate(startDate), endDate: toDate(endDate) } : null;
      const data = await reportService.getSalesSummary(dateRange, req.user);
      sendResponse(res, 200, data, 'Sales summary report generated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/reports/appointment-summary
  static async getAppointmentSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const dateRange = startDate || endDate ? { startDate: toDate(startDate), endDate: toDate(endDate) } : null;
      const data = await reportService.getAppointmentSummary(dateRange, req.user);
      sendResponse(res, 200, data, 'Appointment summary report generated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/reports/low-stock
  static async getLowStockReport(req, res) {
    try {
      const data = await reportService.getLowStockReport(req.user);
      sendResponse(res, 200, data, 'Low stock report generated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/reports/client-activity
  static async getClientActivityReport(req, res) {
    try {
      const limit = toInt(req.query.limit) || 10;
      const data = await reportService.getClientActivityReport(limit, req.user);
      sendResponse(res, 200, data, 'Client activity report generated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/reports/dashboard-summary
  static async getDashboardSummary(req, res) {
    try {
      const data = await reportService.getDashboardSummary(req.user);
      sendResponse(res, 200, data, 'Dashboard summary generated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/reports/daily-sales
  static async getDailySales(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error('startDate and endDate are required');
      const data = await reportService.getDailySales(toDate(startDate), toDate(endDate), req.user);
      sendResponse(res, 200, data, 'Daily sales report generated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/reports/logs
  static async getReportLogs(req, res) {
    try {
      const options = {
        page: toInt(req.query.page) || 1,
        limit: toInt(req.query.limit) || 20,
        reportName: req.query.reportName,
        fromDate: toDate(req.query.fromDate),
        toDate: toDate(req.query.toDate),
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      };
      const logs = await reportService.getReportLogs(options);
      sendResponse(res, 200, logs, 'Report logs retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = ReportController;