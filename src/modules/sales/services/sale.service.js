//@ts-check
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

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  async _generateInvoiceNumber() {
    const { sale: repo } = await this.getRepositories();
    const count = await repo.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${(count + 1).toString().padStart(6, "0")}`;
  }

  // ------------------------------------------------------------------
  // CRUD (following PurchaseService pattern)
  // ------------------------------------------------------------------

  /**
   * Create a new sale (initiated status, without items)
   * @param {Object} data
   * @param {number} data.clientId
   * @param {number|null} data.appointmentId
   * @param {string} [data.paymentMethod] - optional, only for direct payment
   * @param {Array<{productId: number, quantity: number, unitPrice: number}>} data.items
   * @param {string} [user]
   */
  async create(data, user = "system") {
    const {
      saveDb,
      updateDb,
    } = require("../../../common/utils/dbUtils/dbActions");
    const auditLogger = require("../../../common/utils/auditLogger");
    const { sale: saleRepo } = await this.getRepositories();

    try {
      if (!data.clientId) throw new Error("Client ID is required");
      if (!data.items || data.items.length === 0)
        throw new Error("Sale must include at least one item");

      // Step 1: Create sale in 'initiated' status (no items, temporary total 0)
      const invoiceNumber = await this._generateInvoiceNumber();
      const sale = saleRepo.create({
        client_id: data.clientId,
        appointment_id: data.appointmentId || null,
        invoice_number: invoiceNumber,
        total_amount: 0, // will be recalculated after items are added
        status: "initiated", // temporary: not yet pending
        payment_method: data.paymentMethod || null,
        payment_date: data.paymentMethod ? new Date() : null,
      });
      const savedSale = await saveDb(saleRepo, sale);
      await auditLogger.logCreate("Sale", savedSale.id, savedSale, user);

      // Step 2: Add items (each addition updates total and may affect status)
      for (const item of data.items) {
        await this.saleItemService.addItem(savedSale.id, item, user);
      }

      // Step 3: After all items are added, transition status to 'pending'
      // (this triggers any state‑transition signal)
      savedSale.status = "pending";
      savedSale.updated_at = new Date();
      const finalSale = await updateDb(saleRepo, savedSale);
      await auditLogger.logUpdate(
        "Sale",
        savedSale.id,
        { status: "initiated" },
        { status: "pending" },
        user
      );

      // Reload with relations
      const fullSale = await saleRepo.findOne({
        where: { id: finalSale.id },
        relations: ["items", "client"],
      });
      return fullSale;
    } catch (error) {
      console.error("Failed to create sale:", error.message);
      throw error;
    }
  }

  /**
   * Fully update a sale: replace all items and update basic fields.
   * Only allowed if the sale status is not 'paid' or 'cancelled'.
   * @param {number} id
   * @param {Object} data
   * @param {Array<{productId: number, quantity: number, unitPrice: number}>} data.items - new items (full replacement)
   * @param {string} [data.notes] - optional notes
   * @param {string} [user]
   * @returns {Promise<Object>} updated sale with items
   */
  async update(id, data, user = "system") {
    const { updateDb } = require("../../../common/utils/dbUtils/dbActions");
    const auditLogger = require("../../../common/utils/auditLogger");
    const { sale: saleRepo } = await this.getRepositories();

    try {
      // 1. Fetch existing sale with items
      const existing = await saleRepo.findOne({
        where: { id, is_deleted: false },
        relations: ["items"],
      });
      if (!existing) throw new Error(`Sale with ID ${id} not found`);
      const oldData = { ...existing };

      // 2. Check if sale can be updated (not paid/cancelled)
      if (existing.status === "paid" || existing.status === "cancelled") {
        throw new Error(
          `Cannot update a sale with status "${existing.status}"`
        );
      }

      // 3. Restore stock for all existing items
      for (const item of existing.items) {
        await this.productService.addStock(
          item.product_id,
          item.quantity,
          user
        );
      }

      // 4. Delete all existing items (hard delete, not soft)
      const { saleItem: saleItemRepo } =
        await this.saleItemService.getRepositories();
      await saleItemRepo.delete({ sale_id: id });

      // 5. Create new items (this will adjust stock and recalculate total)
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error("Items array is required");
      }
      for (const item of data.items) {
        await this.saleItemService.addItem(id, item, user);
      }

      // 6. Update sale fields (if any)
      if (data.notes !== undefined) existing.notes = data.notes;
      existing.updated_at = new Date();

      // 7. Re‑fetch the updated sale with the new total (already recalculated by addItem)
      const updatedSale = await saleRepo.findOne({
        where: { id },
        relations: ["items", "client"],
      });

      await auditLogger.logUpdate("Sale", id, oldData, updatedSale, user);
      return updatedSale;
    } catch (error) {
      console.error("Failed to update sale:", error.message);
      throw error;
    }
  }

  /**
   * Update sale status (and payment info)
   * This is similar to PurchaseService.updateStatus but with sale‑specific transitions.
   * @param {number} id
   * @param {Object} data
   * @param {string} data.status
   * @param {string} [data.paymentMethod]
   * @param {Date} [data.paymentDate]
   * @param {string} user
   */
  async updateStatus(id, data, user = "system") {
    const { updateDb } = require("../../../common/utils/dbUtils/dbActions");
    const auditLogger = require("../../../common/utils/auditLogger");
    const { sale: repo } = await this.getRepositories();

    try {
      const existing = await repo.findOne({
        where: { id, is_deleted: false },
        relations: ["items"],
      });
      if (!existing) throw new Error(`Sale with ID ${id} not found`);

      const oldData = { ...existing };
      const oldStatus = existing.status;

      // Define allowed transitions (sale‑specific)
      const allowedTransitions = {
        initiated: ["pending", "cancelled"],
        pending: ["paid", "partially_paid", "cancelled"],
        partially_paid: ["paid", "cancelled"],
        paid: [], // cannot transition out of paid
        cancelled: [], // cannot transition out of cancelled
      };
      const allowed = allowedTransitions[oldStatus];
      if (!allowed || !allowed.includes(data.status)) {
        throw new Error(
          `Invalid status transition from ${oldStatus} to ${data.status}`
        );
      }

      // If transitioning to paid, ensure payment method is set
      if (data.status === "paid") {
        if (!data.paymentMethod && !existing.payment_method) {
          throw new Error("Payment method is required to mark sale as paid");
        }
        existing.payment_method = data.paymentMethod || existing.payment_method;
        existing.payment_date = data.paymentDate || new Date();
      }

      // If cancelling, restore stock (only if not already cancelled)
      if (data.status === "cancelled" && oldStatus !== "cancelled") {
        const items = await this.saleItemService.findBySaleId(id);
        for (const item of items) {
          await this.productService.addStock(
            item.product_id,
            item.quantity,
            user
          );
        }
      }

      // Apply new status
      existing.status = data.status;
      existing.updated_at = new Date();

      const updated = await updateDb(repo, existing);
      await auditLogger.logUpdate("Sale", id, oldData, updated, user);
      return updated;
    } catch (error) {
      console.error("Failed to update sale status:", error.message);
      throw error;
    }
  }

  /**
   * Soft delete a sale (and restore stock if necessary)
   * @param {number} id
   * @param {string} user
   */
  async delete(id, user = "system") {
    const { updateDb } = require("../../../common/utils/dbUtils/dbActions");
    const auditLogger = require("../../../common/utils/auditLogger");
    const { sale: repo } = await this.getRepositories();

    try {
      const sale = await repo.findOne({
        where: { id, is_deleted: false },
        relations: ["items"],
      });
      if (!sale) throw new Error(`Sale with ID ${id} not found`);
      if (sale.is_deleted) throw new Error(`Sale #${id} is already deleted`);
      const oldData = { ...sale };

      // Restore stock only if the sale was not already cancelled
      if (sale.status !== "cancelled") {
        for (const item of sale.items) {
          await this.productService.addStock(
            item.product_id,
            item.quantity,
            user
          );
        }
      }

      sale.is_deleted = true;
      sale.updated_at = new Date();
      const updated = await updateDb(repo, sale);
      await auditLogger.logDelete("Sale", id, oldData, user);
      return updated;
    } catch (error) {
      console.error("Failed to delete sale:", error.message);
      throw error;
    }
  }

  /**
   * Find sale by ID (with items)
   * @param {number} id
   */
  async findById(id) {
    const { sale: repo } = await this.getRepositories();
    const sale = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["items", "items.product", "client", "appointment"],
    });
    if (!sale) throw new Error(`Sale with ID ${id} not found`);
    return sale;
  }

  /**
   * Find all sales with filtering, pagination, sorting
   * @param {Object} options
   */
  async findAll(options = {}) {
    const { sale: repo } = await this.getRepositories();
    const qb = repo
      .createQueryBuilder("sale")
      .leftJoinAndSelect("sale.client", "client")
      .leftJoinAndSelect("sale.items", "items")
      .where("sale.is_deleted = false");

    if (options.clientId)
      qb.andWhere("sale.client_id = :clientId", { clientId: options.clientId });
    if (options.status)
      qb.andWhere("sale.status = :status", { status: options.status });
    if (options.fromDate)
      qb.andWhere("sale.created_at >= :fromDate", {
        fromDate: options.fromDate,
      });
    if (options.toDate)
      qb.andWhere("sale.created_at <= :toDate", { toDate: options.toDate });

    const sortBy = options.sortBy || "created_at";
    const sortOrder = options.sortOrder === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`sale.${sortBy}`, sortOrder);

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;
      qb.skip(skip).take(options.limit);
    }
    const sales = await qb.getMany();
    return sales;
  }

  // ------------------------------------------------------------------
  // Statistics
  // ------------------------------------------------------------------

  async getStatistics() {
    const { sale: repo } = await this.getRepositories();
    try {
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
    } catch (error) {
      console.error("Failed to get sale statistics:", error);
      throw error;
    }
  }
}

const saleService = new SaleService();
module.exports = saleService;
