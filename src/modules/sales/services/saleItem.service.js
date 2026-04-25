const { AppDataSource } = require("../../../db/datasource");

class SaleItemService {
  constructor() {
    this.saleItemRepo = null;
    this.saleService = null;
    this.productService = null;
  }

  async initialize() {
    if (this.saleItemRepo) return;
    const { SaleItemEntity } = require("../entities/saleItem.entity");
    const saleService = require("./sale.service");
    const productService = require("../../products/services/product.service");

    this.saleItemRepo = AppDataSource.getRepository(SaleItemEntity);
    this.saleService = saleService;
    this.productService = productService;

    await this.saleService.initialize();
    await this.productService.initialize();
    console.log("SaleItemService initialized");
  }

  async getRepositories() {
    if (!this.saleItemRepo) await this.initialize();
    return { saleItem: this.saleItemRepo };
  }

  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { SaleItemEntity } = require("../entities/saleItem.entity");
      return queryRunner.manager.getRepository(SaleItemEntity);
    }
    return (await this.getRepositories()).saleItem;
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

  async _recalculateSaleTotal(saleId, queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    const items = await repo.find({
      where: { sale_id: saleId, is_deleted: false },
    });
    const newTotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const { sale: saleRepo } = await this.saleService.getRepositories();
    const targetRepo = queryRunner
      ? queryRunner.manager.getRepository(saleRepo.target)
      : saleRepo;
    await targetRepo.update(saleId, {
      total_amount: newTotal,
      updated_at: new Date(),
    });
    return newTotal;
  }

  async addItem(saleId, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const sale = await this.saleService.findById(saleId, queryRunner);
    if (!sale) throw new Error(`Sale with ID ${saleId} not found`);
    if (sale.status === "paid" || sale.status === "cancelled") {
      throw new Error(
        `Cannot add items to a sale with status "${sale.status}"`
      );
    }
    if (data.quantity <= 0) throw new Error("Quantity must be positive");
    if (data.unitPrice <= 0) throw new Error("Unit price must be positive");

    await this.productService.findById(data.productId); // exists check

    const item = repo.create({
      sale_id: saleId,
      product_id: data.productId,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      total_price: data.quantity * data.unitPrice,
    });
    const savedItem = await this._save(repo, item, queryRunner, user);

    await this.productService.removeStock(
      data.productId,
      data.quantity,
      user,
      queryRunner
    );
    await this._recalculateSaleTotal(saleId, queryRunner);

    await auditLogger.logCreate("SaleItem", savedItem.id, savedItem, user.id);
    return savedItem;
  }

  async updateItem(itemId, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const item = await repo.findOne({
      where: { id: itemId, is_deleted: false },
    });
    if (!item) throw new Error(`SaleItem with ID ${itemId} not found`);
    const sale = await this.saleService.findById(item.sale_id, queryRunner);
    if (sale.status === "paid" || sale.status === "cancelled") {
      throw new Error(
        `Cannot modify items of a sale with status "${sale.status}"`
      );
    }
    const oldQuantity = item.quantity;
    const oldUnitPrice = item.unit_price;
    let quantityDelta = 0;

    if (data.quantity !== undefined) {
      if (data.quantity <= 0) throw new Error("Quantity must be positive");
      quantityDelta = data.quantity - oldQuantity;
      item.quantity = data.quantity;
    }
    if (data.unitPrice !== undefined) {
      if (data.unitPrice <= 0) throw new Error("Unit price must be positive");
      item.unit_price = data.unitPrice;
    }
    item.total_price = item.quantity * item.unit_price;

    if (quantityDelta !== 0) {
      if (quantityDelta > 0) {
        await this.productService.removeStock(
          item.product_id,
          quantityDelta,
          user,
          queryRunner
        );
      } else {
        await this.productService.addStock(
          item.product_id,
          -quantityDelta,
          user,
          queryRunner
        );
      }
    }

    const updatedItem = await this._update(repo, item, queryRunner, user);
    await this._recalculateSaleTotal(item.sale_id, queryRunner);
    await auditLogger.logUpdate(
      "SaleItem",
      itemId,
      { quantity: oldQuantity, unitPrice: oldUnitPrice },
      updatedItem,
      user.id
    );
    return updatedItem;
  }

  async removeItem(itemId, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const item = await repo.findOne({
      where: { id: itemId, is_deleted: false },
    });
    if (!item) throw new Error(`SaleItem with ID ${itemId} not found`);
    const sale = await this.saleService.findById(item.sale_id, queryRunner);
    if (sale.status === "paid" || sale.status === "cancelled") {
      throw new Error(
        `Cannot remove items from a sale with status "${sale.status}"`
      );
    }

    await this.productService.addStock(
      item.product_id,
      item.quantity,
      user,
      queryRunner
    );
    item.is_deleted = true;
    item.updated_at = new Date();
    const deletedItem = await this._update(repo, item, queryRunner, user);
    await this._recalculateSaleTotal(item.sale_id, queryRunner);
    await auditLogger.logDelete(
      "SaleItem",
      itemId,
      { quantity: item.quantity },
      user.id
    );
    return deletedItem;
  }

  async findById(id, queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    const item = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["sale", "product"],
    });
    if (!item) throw new Error(`SaleItem with ID ${id} not found`);
    return item;
  }

  async findBySaleId(saleId, queryRunner = null) {
    const repo = await this._getRepository(queryRunner);
    return await repo.find({
      where: { sale_id: saleId, is_deleted: false },
      relations: ["product"],
      order: { id: "ASC" },
    });
  }
}

const saleItemService = new SaleItemService();
module.exports = saleItemService;
