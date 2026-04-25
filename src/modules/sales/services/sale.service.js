const { AppDataSource } = require("../../../db/datasource");

class SaleService {
  constructor() {
    this.saleRepo = null;
    this.saleItemService = null;
    this.productService = null;
  }

  async initialize() {
    if (this.saleRepo) return;
    const { SaleEntity } = require("../entities/sale.entity");
    const saleItemService = require("./saleItem.service");
    const productService = require("../../products/services/product.service");

    this.saleRepo = AppDataSource.getRepository(SaleEntity);
    this.saleItemService = saleItemService;
    this.productService = productService;

    await this.saleItemService.initialize();
    await this.productService.initialize();
    console.log("SaleService initialized");
  }

  async getRepositories() {
    if (!this.saleRepo) await this.initialize();
    return { sale: this.saleRepo };
  }

  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { SaleEntity } = require("../entities/sale.entity");
      return queryRunner.manager.getRepository(SaleEntity);
    }
    return (await this.getRepositories()).sale;
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

  async _generateInvoiceNumber(queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    const count = await repo.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${(count + 1).toString().padStart(6, "0")}`;
  }

  async create(data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    if (!data.clientId) throw new Error("Client ID is required");
    if (!data.items || data.items.length === 0)
      throw new Error("Sale must include at least one item");

    const invoiceNumber = await this._generateInvoiceNumber(queryRunner);
    const sale = repo.create({
      client_id: data.clientId,
      appointment_id: data.appointmentId || null,
      invoice_number: invoiceNumber,
      total_amount: 0,
      status: "initiated",
      payment_method: data.paymentMethod || null,
      payment_date: data.paymentMethod ? new Date() : null,
    });
    const savedSale = await this._save(repo, sale, queryRunner, user);
    await auditLogger.logCreate("Sale", savedSale.id, savedSale, user.id);

    for (const item of data.items) {
      await this.saleItemService.addItem(savedSale.id, item, user, queryRunner);
    }

    savedSale.status = "pending";
    savedSale.updated_at = new Date();
    const finalSale = await this._update(repo, savedSale, queryRunner, user);
    await auditLogger.logUpdate(
      "Sale",
      savedSale.id,
      { status: "initiated" },
      { status: "pending" },
      user.id
    );

    const fullSale = await repo.findOne({
      where: { id: finalSale.id },
      relations: ["items", "client"],
    });
    return fullSale;
  }

  async update(id, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const existing = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["items"],
    });
    if (!existing) throw new Error(`Sale with ID ${id} not found`);
    const oldData = { ...existing };

    if (existing.status === "paid" || existing.status === "cancelled") {
      throw new Error(`Cannot update a sale with status "${existing.status}"`);
    }

    for (const item of existing.items) {
      await this.productService.addStock(
        item.product_id,
        item.quantity,
        user,
        queryRunner
      );
    }

    const { saleItem: saleItemRepo } =
      await this.saleItemService.getRepositories();
    const targetItemRepo = queryRunner
      ? queryRunner.manager.getRepository(saleItemRepo.target)
      : saleItemRepo;
    await targetItemRepo.delete({ sale_id: id });

    if (!data.items || !Array.isArray(data.items))
      throw new Error("Items array is required");
    for (const item of data.items) {
      await this.saleItemService.addItem(id, item, user, queryRunner);
    }

    if (data.notes !== undefined) existing.notes = data.notes;
    existing.updated_at = new Date();
    const updatedSale = await repo.findOne({
      where: { id },
      relations: ["items", "client"],
    });
    await auditLogger.logUpdate("Sale", id, oldData, updatedSale, user.id);
    return updatedSale;
  }

  async updateStatus(id, statusData, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const existing = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["items"],
    });
    if (!existing) throw new Error(`Sale with ID ${id} not found`);
    const oldData = { ...existing };
    const oldStatus = existing.status;

    const allowedTransitions = {
      initiated: ["pending", "cancelled"],
      pending: ["paid", "partially_paid", "cancelled"],
      partially_paid: ["paid", "cancelled"],
      paid: [],
      cancelled: [],
    };
    if (
      !allowedTransitions[oldStatus] ||
      !allowedTransitions[oldStatus].includes(statusData.status)
    ) {
      throw new Error(
        `Invalid status transition from ${oldStatus} to ${statusData.status}`
      );
    }

    if (statusData.status === "paid") {
      if (!statusData.paymentMethod && !existing.payment_method) {
        throw new Error("Payment method is required to mark sale as paid");
      }
      existing.payment_method =
        statusData.paymentMethod || existing.payment_method;
      existing.payment_date = statusData.paymentDate || new Date();
    }

    if (statusData.status === "cancelled" && oldStatus !== "cancelled") {
      const items = await this.saleItemService.findBySaleId(id, queryRunner);
      for (const item of items) {
        await this.productService.addStock(
          item.product_id,
          item.quantity,
          user,
          queryRunner
        );
      }
    }

    existing.status = statusData.status;
    existing.updated_at = new Date();
    const updated = await this._update(repo, existing, queryRunner, user);
    await auditLogger.logUpdate("Sale", id, oldData, updated, user.id);
    return updated;
  }

  async delete(id, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const sale = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["items"],
    });
    if (!sale) throw new Error(`Sale with ID ${id} not found`);
    if (sale.is_deleted) throw new Error(`Sale #${id} is already deleted`);
    const oldData = { ...sale };

    if (sale.status !== "cancelled") {
      for (const item of sale.items) {
        await this.productService.addStock(
          item.product_id,
          item.quantity,
          user,
          queryRunner
        );
      }
    }

    sale.is_deleted = true;
    sale.updated_at = new Date();
    const updated = await this._update(repo, sale, queryRunner, user);
    await auditLogger.logDelete("Sale", id, oldData, user.id);
    return updated;
  }

  async findById(id, queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    const sale = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["items", "items.product", "client", "appointment"],
    });
    if (!sale) throw new Error(`Sale with ID ${id} not found`);
    return sale;
  }

  async findAll(options = {}, queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    const {
      page = 1,
      limit = 10,
      clientId,
      status,
      fromDate,
      toDate,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = options;

    const qb = repo
      .createQueryBuilder("sale")
      .leftJoinAndSelect("sale.client", "client")
      .leftJoinAndSelect("sale.items", "items")
      .where("sale.is_deleted = false");

    if (clientId) qb.andWhere("sale.client_id = :clientId", { clientId });
    if (status) qb.andWhere("sale.status = :status", { status });
    if (fromDate) qb.andWhere("sale.created_at >= :fromDate", { fromDate });
    if (toDate) qb.andWhere("sale.created_at <= :toDate", { toDate });

    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`sale.${sortBy}`, order);

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

  async getStatistics(queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    const totalOrders = await repo.count({ where: { is_deleted: false } });
    const paidOrders = await repo.count({
      where: { is_deleted: false, status: "paid" },
    });
    const pendingOrders = await repo.count({
      where: { is_deleted: false, status: "pending" },
    });
    const partiallyPaidOrders = await repo.count({
      where: { is_deleted: false, status: "partially_paid" },
    });
    const revenueResult = await repo
      .createQueryBuilder("sale")
      .select("SUM(sale.total_amount)", "total")
      .where("sale.status = :status", { status: "paid" })
      .andWhere("sale.is_deleted = false")
      .getRawOne();
    const totalRevenue = parseFloat(revenueResult?.total) || 0;
    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      partiallyPaidOrders,
      totalRevenue,
    };
  }
}

const saleService = new SaleService();
module.exports = saleService;
