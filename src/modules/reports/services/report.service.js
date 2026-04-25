//@ts-check
const { AppDataSource } = require('../../../db/datasource');

class ReportService {
  constructor() {
    this.reportLogRepo = null;
    // lazy load other services
    this.clientService = null;
    this.petService = null;
    this.appointmentService = null;
    this.saleService = null;
    this.productService = null;
  }

  async initialize() {
    if (this.reportLogRepo) return;
    const { ReportLogEntity } = require('../entities/reportLog.entity');
    this.reportLogRepo = AppDataSource.getRepository(ReportLogEntity);

    // Load required services
    const clientService = require('../../clients/services/client.service');
    const petService = require('../../pets/services/pet.service');
    const appointmentService = require('../../appointments/services/appointment.service');
    const saleService = require('../../sales/services/sale.service');
    const productService = require('../../products/services/product.service');

    this.clientService = clientService;
    this.petService = petService;
    this.appointmentService = appointmentService;
    this.saleService = saleService;
    this.productService = productService;

    // Initialize each service (so repositories are ready)
    await this.clientService.initialize();
    await this.petService.initialize();
    await this.appointmentService.initialize();
    await this.saleService.initialize();
    await this.productService.initialize();

    console.log('ReportService initialized');
  }

  async getRepositories() {
    if (!this.reportLogRepo) await this.initialize();
    return { reportLog: this.reportLogRepo };
  }

  // ------------------------------------------------------------------
  // Report generation helpers
  // ------------------------------------------------------------------

  async _logReport(reportName, parameters, generatedBy, dataSummary, filePath = null) {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const { reportLog: repo } = await this.getRepositories();
    const logEntry = repo.create({
      report_name: reportName,
      parameters: parameters ? JSON.stringify(parameters) : null,
      generated_by: generatedBy || null,
      data_summary: dataSummary,
      file_path: filePath,
    });
    const saved = await saveDb(repo, logEntry);
    return saved;
  }

  // ------------------------------------------------------------------
  // Individual report methods
  // ------------------------------------------------------------------

  /**
   * Sales summary report (total sales, total revenue, average order value, counts by status)
   * @param {Object} dateRange - { startDate, endDate } (optional)
   * @param {number|null} generatedBy - user ID who requested the report
   */
  async getSalesSummary(dateRange = null, generatedBy = null) {
    await this.initialize();
    const sales = await this.saleService.findAll({
      fromDate: dateRange?.startDate,
      toDate: dateRange?.endDate,
    });

    let totalRevenue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalCancelled = 0;
    let totalPartiallyPaid = 0;
    let orderCount = sales.length;

    for (const sale of sales) {
      totalRevenue += sale.total_amount;
      switch (sale.status) {
        case 'Paid':
          totalPaid += sale.total_amount;
          break;
        case 'Pending':
          totalPending += sale.total_amount;
          break;
        case 'PartiallyPaid':
          totalPartiallyPaid += sale.total_amount;
          break;
        case 'Cancelled':
          totalCancelled += sale.total_amount;
          break;
      }
    }

    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    const result = {
      period: dateRange || { startDate: null, endDate: null },
      totalOrders: orderCount,
      totalRevenue,
      averageOrderValue: avgOrderValue,
      byStatus: {
        Paid: totalPaid,
        Pending: totalPending,
        PartiallyPaid: totalPartiallyPaid,
        Cancelled: totalCancelled,
      },
    };

    // Log report
    const summary = `${orderCount} orders, total revenue ${totalRevenue.toFixed(2)}`;
    await this._logReport('sales_summary', dateRange, generatedBy, summary);
    return result;
  }

  /**
   * Appointment summary report
   * @param {Object} dateRange - { startDate, endDate } (optional)
   * @param {number|null} generatedBy
   */
  async getAppointmentSummary(dateRange = null, generatedBy = null) {
    await this.initialize();
    const appointments = await this.appointmentService.findAll({
      fromDate: dateRange?.startDate,
      toDate: dateRange?.endDate,
    });

    const total = appointments.length;
    const scheduled = appointments.filter(a => a.status === 'Scheduled').length;
    const confirmed = appointments.filter(a => a.status === 'Confirmed').length;
    const completed = appointments.filter(a => a.status === 'Completed').length;
    const cancelled = appointments.filter(a => a.status === 'Cancelled').length;
    const noShow = appointments.filter(a => a.status === 'NoShow').length;

    const result = {
      period: dateRange,
      total,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow,
    };

    const summary = `Total appointments: ${total}, Completed: ${completed}, Cancelled: ${cancelled}`;
    await this._logReport('appointment_summary', dateRange, generatedBy, summary);
    return result;
  }

  /**
   * Low stock report
   * @param {number|null} generatedBy
   */
  async getLowStockReport(generatedBy = null) {
    await this.initialize();
    const lowStockProducts = await this.productService.getLowStockProducts(); // using productService method
    const result = lowStockProducts.map(p => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      reorderLevel: p.reorder_level,
    }));

    const summary = `${result.length} products below or at reorder level`;
    await this._logReport('low_stock', null, generatedBy, summary);
    return result;
  }

  /**
   * Client activity report (clients with most appointments/sales)
   * @param {number|null} limit
   * @param {number|null} generatedBy
   */
  async getClientActivityReport(limit = 10, generatedBy = null) {
    await this.initialize();
    // We'll use raw queries or aggregations. Here using repositories directly.
    const clientRepo = (await this.clientService.getRepositories()).client;
    const appointmentRepo = (await this.appointmentService.getRepositories()).appointment;

    const topClientsByAppointments = await appointmentRepo
      .createQueryBuilder('appointment')
      .select('appointment.client_id', 'clientId')
      .addSelect('COUNT(appointment.id)', 'appointmentCount')
      .where('appointment.is_deleted = false')
      .groupBy('appointment.client_id')
      .orderBy('appointmentCount', 'DESC')
      .limit(limit)
      .getRawMany();

    // Fetch client names
    const enriched = [];
    for (const item of topClientsByAppointments) {
      const client = await clientRepo.findOne({ where: { id: item.clientId, is_deleted: false } });
      enriched.push({
        clientId: item.clientId,
        clientName: client ? client.name : 'Unknown',
        appointmentCount: parseInt(item.appointmentCount),
      });
    }

    const result = { topClientsByAppointments: enriched };
    const summary = `Top ${limit} clients by appointment count`;
    await this._logReport('client_activity', { limit }, generatedBy, summary);
    return result;
  }

  /**
   * Comprehensive dashboard summary (calls multiple reports and combines)
   * @param {number|null} generatedBy
   */
  async getDashboardSummary(generatedBy = null) {
    const salesSummary = await this.getSalesSummary(null, null);
    const appointmentSummary = await this.getAppointmentSummary(null, null);
    const lowStockCount = (await this.getLowStockReport(null)).length;
    const activeProducts = (await this.productService.findAll({ isActive: true })).length;
    const activeClients = (await this.clientService.findAll()).length;
    const activePets = (await this.petService.findAll()).length;

    const result = {
      sales: salesSummary,
      appointments: appointmentSummary,
      lowStockCount,
      activeProducts,
      activeClients,
      activePets,
      generatedAt: new Date(),
    };

    const summary = `Dashboard: ${activeClients} clients, ${appointmentSummary.total} appointments, ${salesSummary.totalRevenue.toFixed(2)} revenue`;
    await this._logReport('dashboard_summary', null, generatedBy, summary);
    return result;
  }

  /**
   * Daily sales report (grouped by date)
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {number|null} generatedBy
   */
  async getDailySales(startDate, endDate, generatedBy = null) {
    await this.initialize();
    const sales = await this.saleService.findAll({ fromDate: startDate, toDate: endDate });
    const dailyMap = new Map();

    for (const sale of sales) {
      const dateKey = sale.created_at.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || { date: dateKey, total: 0, count: 0 };
      existing.total += sale.total_amount;
      existing.count += 1;
      dailyMap.set(dateKey, existing);
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const result = { startDate, endDate, daily };
    const summary = `${daily.length} days, total revenue ${daily.reduce((s, d) => s + d.total, 0).toFixed(2)}`;
    await this._logReport('daily_sales', { startDate, endDate }, generatedBy, summary);
    return result;
  }

  // ------------------------------------------------------------------
  // Report Log retrieval (optional)
  // ------------------------------------------------------------------

  /**
   * Get list of generated report logs (for history)
   * @param {Object} options - pagination, filtering
   */
  async getReportLogs(options = {}) {
    const { reportLog: repo } = await this.getRepositories();
    const qb = repo.createQueryBuilder('log').where('log.is_deleted = false');
    if (options.reportName) {
      qb.andWhere('log.report_name = :reportName', { reportName: options.reportName });
    }
    if (options.fromDate) {
      qb.andWhere('log.generated_at >= :fromDate', { fromDate: options.fromDate });
    }
    if (options.toDate) {
      qb.andWhere('log.generated_at <= :toDate', { toDate: options.toDate });
    }
    const sortBy = options.sortBy || 'generated_at';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`log.${sortBy}`, sortOrder);
    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;
      qb.skip(skip).take(options.limit);
    }
    const logs = await qb.getMany();
    return logs;
  }
}

const reportService = new ReportService();
module.exports = reportService;