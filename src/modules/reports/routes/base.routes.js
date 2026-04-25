// src/modules/reports/routes/base.routes.js
const { Router } = require('express');
const ReportController = require('../controllers/report.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticateToken);

router.get('/sales-summary', ReportController.getSalesSummary);
router.get('/appointment-summary', ReportController.getAppointmentSummary);
router.get('/low-stock', ReportController.getLowStockReport);
router.get('/client-activity', ReportController.getClientActivityReport);
router.get('/dashboard-summary', ReportController.getDashboardSummary);
router.get('/daily-sales', ReportController.getDailySales);
router.get('/logs', ReportController.getReportLogs);

module.exports = router;