const { AppDataSource } = require("../../../db/datasource");

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
    const { ReportLogEntity } = require("../entities/reportLog.entity");
    this.reportLogRepo = AppDataSource.getRepository(ReportLogEntity);

    const clientService = require("../../clients/services/client.service");
    const petService = require("../../pets/services/pet.service");
    const appointmentService = require("../../appointments/services/appointment.service");
    const saleService = require("../../sales/services/sale.service");
    const productService = require("../../products/services/product.service");

    this.clientService = clientService;
    this.petService = petService;
    this.appointmentService = appointmentService;
    this.saleService = saleService;
    this.productService = productService;

    await this.clientService.initialize();
    await this.petService.initialize();
    await this.appointmentService.initialize();
    await this.saleService.initialize();
    await this.productService.initialize();

    console.log("ReportService initialized");
  }

  async getRepositories() {
    if (!this.reportLogRepo) await this.initialize();
    return { reportLog: this.reportLogRepo };
  }

  // Helper para sa common repository
  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { ReportLogEntity } = require("../entities/reportLog.entity");
      return queryRunner.manager.getRepository(ReportLogEntity);
    }
    return (await this.getRepositories()).reportLog;
  }

  async _save(repo, entity, queryRunner = null, currentUser = null) {
    const { saveDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await saveDb(queryRunner.manager, entity, { user: currentUser });
      // return await queryRunner.manager.save(entity);
    }
    return await saveDb(repo, entity, { user: currentUser });
  }

  async _update(repo, entity, queryRunner = null, currentUser = null) {
    const { updateDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await updateDb(queryRunner.manager, entity, { user: currentUser });
      // return await queryRunner.manager.save(entity);
    }
    return await updateDb(repo, entity, { user: currentUser });
  }

  async _remove(repo, entity, queryRunner = null, currentUser = null) {
    const { removeDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await removeDb(queryRunner.manager, entity, { user: currentUser });
      // return await queryRunner.manager.remove(entity);
    }

    return await removeDb(repo, entity, { user: currentUser });
  }

  async _logReport(reportName, parameters, user, dataSummary, filePath = null) {
    const repo = await this._getRepository();
    const logEntry = repo.create({
      report_name: reportName,
      parameters: parameters ? JSON.stringify(parameters) : null,
      generated_by: user?.id || null,
      data_summary: dataSummary,
      file_path: filePath,
    });
    const saved = await this._save(repo, logEntry, user);
    return saved;
  }

  // ------------------------------------------------------------------
  // Individual report methods (all accept user object)
  // ------------------------------------------------------------------

  async getSalesSummary(dateRange = null, user = null) {
    await this.initialize();
    const result = await this.saleService.findAll({
      fromDate: dateRange?.startDate,
      toDate: dateRange?.endDate,
    });
    const sales = result.data; // extract array from paginated result

    let totalRevenue = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalCancelled = 0;
    let totalPartiallyPaid = 0;
    const orderCount = sales.length;

    for (const sale of sales) {
      totalRevenue += sale.total_amount;
      switch (sale.status) {
        case "Paid":
          totalPaid += sale.total_amount;
          break;
        case "Pending":
          totalPending += sale.total_amount;
          break;
        case "PartiallyPaid":
          totalPartiallyPaid += sale.total_amount;
          break;
        case "Cancelled":
          totalCancelled += sale.total_amount;
          break;
      }
    }

    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    const reportData = {
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

    const summary = `${orderCount} orders, total revenue ${totalRevenue.toFixed(
      2
    )}`;
    await this._logReport("sales_summary", dateRange, user, summary);
    return reportData;
  }

  async getAppointmentSummary(dateRange = null, user = null) {
    await this.initialize();
    const result = await this.appointmentService.findAll({
      fromDate: dateRange?.startDate,
      toDate: dateRange?.endDate,
    });
    const appointments = result.data;

    const total = appointments.length;
    const scheduled = appointments.filter(
      (a) => a.status === "Scheduled"
    ).length;
    const confirmed = appointments.filter(
      (a) => a.status === "Confirmed"
    ).length;
    const completed = appointments.filter(
      (a) => a.status === "Completed"
    ).length;
    const cancelled = appointments.filter(
      (a) => a.status === "Cancelled"
    ).length;
    const noShow = appointments.filter((a) => a.status === "NoShow").length;

    const reportData = {
      period: dateRange,
      total,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow,
    };

    const summary = `Total appointments: ${total}, Completed: ${completed}, Cancelled: ${cancelled}`;
    await this._logReport("appointment_summary", dateRange, user, summary);
    return reportData;
  }

  async getLowStockReport(user = null) {
    await this.initialize();
    const lowStockProducts = await this.productService.getLowStockProducts();
    const reportData = lowStockProducts.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      reorderLevel: p.reorder_level,
    }));

    const summary = `${reportData.length} products below or at reorder level`;
    await this._logReport("low_stock", null, user, summary);
    return reportData;
  }

  async getClientActivityReport(limit = 10, user = null) {
    await this.initialize();
    const clientRepo = (await this.clientService.getRepositories()).client;
    const appointmentRepo = (await this.appointmentService.getRepositories())
      .appointment;

    const topClientsByAppointments = await appointmentRepo
      .createQueryBuilder("appointment")
      .select("appointment.client_id", "clientId")
      .addSelect("COUNT(appointment.id)", "appointmentCount")
      .where("appointment.is_deleted = false")
      .groupBy("appointment.client_id")
      .orderBy("appointmentCount", "DESC")
      .limit(limit)
      .getRawMany();

    const enriched = [];
    for (const item of topClientsByAppointments) {
      const client = await clientRepo.findOne({
        where: { id: item.clientId, is_deleted: false },
      });
      enriched.push({
        clientId: item.clientId,
        clientName: client ? client.name : "Unknown",
        appointmentCount: parseInt(item.appointmentCount),
      });
    }

    const reportData = { topClientsByAppointments: enriched };
    const summary = `Top ${limit} clients by appointment count`;
    await this._logReport("client_activity", { limit }, user, summary);
    return reportData;
  }

  async getDashboardSummary(user = null) {
    const salesSummary = await this.getSalesSummary(null, user);
    const appointmentSummary = await this.getAppointmentSummary(null, user);
    const lowStockList = await this.getLowStockReport(user);
    const lowStockCount = lowStockList.length;

    const activeProductsResult = await this.productService.findAll({
      isActive: true,
    });
    const activeProducts =
      activeProductsResult.total || activeProductsResult.data?.length || 0;

    const activeClientsResult = await this.clientService.findAll();
    const activeClients =
      activeClientsResult.total || activeClientsResult.data?.length || 0;

    const activePetsResult = await this.petService.findAll();
    const activePets =
      activePetsResult.total || activePetsResult.data?.length || 0;

    const reportData = {
      sales: salesSummary,
      appointments: appointmentSummary,
      lowStockCount,
      activeProducts,
      activeClients,
      activePets,
      generatedAt: new Date(),
    };

    const summary = `Dashboard: ${activeClients} clients, ${
      appointmentSummary.total
    } appointments, ${salesSummary.totalRevenue.toFixed(2)} revenue`;
    await this._logReport("dashboard_summary", null, user, summary);
    return reportData;
  }

  async getDailySales(startDate, endDate, user = null) {
    await this.initialize();
    const result = await this.saleService.findAll({
      fromDate: startDate,
      toDate: endDate,
    });
    const sales = result.data;

    const dailyMap = new Map();
    for (const sale of sales) {
      const dateKey = sale.created_at.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey) || {
        date: dateKey,
        total: 0,
        count: 0,
      };
      existing.total += sale.total_amount;
      existing.count += 1;
      dailyMap.set(dateKey, existing);
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const reportData = { startDate, endDate, daily };
    const summary = `${daily.length} days, total revenue ${daily
      .reduce((s, d) => s + d.total, 0)
      .toFixed(2)}`;
    await this._logReport("daily_sales", { startDate, endDate }, user, summary);
    return reportData;
  }

  // ------------------------------------------------------------------
  // Report Log retrieval (paginated)
  // ------------------------------------------------------------------

  async getReportLogs(options = {}) {
    const repo = await this._getRepository();
    const {
      page = 1,
      limit = 20,
      reportName,
      fromDate,
      toDate,
      sortBy = "generated_at",
      sortOrder = "DESC",
    } = options;

    const qb = repo.createQueryBuilder("log").where("log.is_deleted = false");
    if (reportName)
      qb.andWhere("log.report_name = :reportName", { reportName });
    if (fromDate) qb.andWhere("log.generated_at >= :fromDate", { fromDate });
    if (toDate) qb.andWhere("log.generated_at <= :toDate", { toDate });

    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`log.${sortBy}`, order);

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }
}

const reportService = new ReportService();
module.exports = reportService;
