
const { AppDataSource } = require("../../../db/datasource");

class ProductService {
  constructor() {
    this.productRepo = null;
  }

  async initialize() {
    if (this.productRepo) return;
    const { ProductEntity } = require("../entities/product.entity");
    this.productRepo = AppDataSource.getRepository(ProductEntity);
    console.log("ProductService initialized");
  }

  async getRepositories() {
    if (!this.productRepo) await this.initialize();
    return { product: this.productRepo };
  }

  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { ProductEntity } = require("../entities/product.entity");
      return queryRunner.manager.getRepository(ProductEntity);
    }
    return (await this.getRepositories()).product;
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

  // ------------------------------------------------------------------
  // Stock helpers
  // ------------------------------------------------------------------

  async _adjustStock(id, delta, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const product = await repo.findOne({ where: { id, is_deleted: false } });
    if (!product) throw new Error(`Product with ID ${id} not found`);
    const oldStock = product.stock;
    const newStock = oldStock + delta;
    if (newStock < 0)
      throw new Error(
        `Insufficient stock. Current: ${oldStock}, adjustment: ${delta}`
      );
    product.stock = newStock;
    product.updated_at = new Date();
    const updated = await this._update(repo, product, queryRunner, user);
    await auditLogger.logUpdate(
      "Product",
      id,
      { stock: oldStock },
      { stock: newStock },
      user.id
    );
    return updated;
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new product
   * @param {Object} data
   * @param {Object} user - { id, ... } from JWT
   * @param {Object} queryRunner - optional transaction runner
   */
  async create(data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    if (!data.name) throw new Error("Product name is required");
    if (data.price === undefined) throw new Error("Price is required");

    const product = repo.create({
      name: data.name,
      category: data.category || null,
      price: data.price,
      stock: data.stock !== undefined ? data.stock : 0,
      reorder_level: data.reorderLevel !== undefined ? data.reorderLevel : 5,
      description: data.description || null,
      is_active: data.isActive !== undefined ? data.isActive : true,
    });

    const saved = await this._save(repo, product, queryRunner, user);
    await auditLogger.logCreate("Product", saved.id, saved, user.id);
    return saved;
  }

  /**
   * Update a product
   * @param {number} id
   * @param {Object} data
   * @param {Object} user
   * @param {Object} queryRunner
   */
  async update(id, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const existing = await repo.findOne({ where: { id, is_deleted: false } });
    if (!existing) throw new Error(`Product with ID ${id} not found`);
    const oldData = { ...existing };

    if (data.name !== undefined) existing.name = data.name;
    if (data.category !== undefined) existing.category = data.category;
    if (data.price !== undefined) existing.price = data.price;
    if (data.stock !== undefined) existing.stock = data.stock;
    if (data.reorderLevel !== undefined)
      existing.reorder_level = data.reorderLevel;
    if (data.description !== undefined) existing.description = data.description;
    if (data.isActive !== undefined) existing.is_active = data.isActive;

    const updated = await this._update(repo, existing, queryRunner, user);
    await auditLogger.logUpdate("Product", id, oldData, updated, user.id);
    return updated;
  }

  /**
   * Soft delete a product
   * @param {number} id
   * @param {Object} user
   * @param {Object} queryRunner
   */
  async delete(id, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const product = await repo.findOne({ where: { id, is_deleted: false } });
    if (!product) throw new Error(`Product with ID ${id} not found`);
    if (product.is_deleted)
      throw new Error(`Product #${id} is already deleted`);

    const oldData = { ...product };
    product.is_deleted = true;
    product.updated_at = new Date();

    const updated = await this._update(repo, product, queryRunner, user);
    await auditLogger.logDelete("Product", id, oldData, user.id);
    return updated;
  }

  /**
   * Find product by ID
   * @param {number} id
   */
  async findById(id) {
    const repo = await this._getRepository();
    const product = await repo.findOne({ where: { id, is_deleted: false } });
    if (!product) throw new Error(`Product with ID ${id} not found`);
    return product;
  }

  /**
   * Find all products with filtering, search, pagination, sorting
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {string} [options.category]
   * @param {boolean} [options.isActive]
   * @param {string} [options.search]
   * @param {number} [options.minPrice]
   * @param {number} [options.maxPrice]
   * @param {boolean} [options.lowStockOnly]
   * @param {string} [options.sortBy]
   * @param {string} [options.sortOrder]
   */
  async findAll(options = {}) {
    const repo = await this._getRepository();
    const {
      page = 1,
      limit = 10,
      category,
      isActive,
      search,
      minPrice,
      maxPrice,
      lowStockOnly,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = options;

    const qb = repo
      .createQueryBuilder("product")
      .where("product.is_deleted = false");

    if (category) qb.andWhere("product.category = :category", { category });
    if (isActive !== undefined)
      qb.andWhere("product.is_active = :isActive", { isActive });
    if (search)
      qb.andWhere("product.name LIKE :search", { search: `%${search}%` });
    if (minPrice !== undefined)
      qb.andWhere("product.price >= :minPrice", { minPrice });
    if (maxPrice !== undefined)
      qb.andWhere("product.price <= :maxPrice", { maxPrice });
    if (lowStockOnly) qb.andWhere("product.stock <= product.reorder_level");

    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`product.${sortBy}`, order);

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

  // ------------------------------------------------------------------
  // Stock management (with optional transaction)
  // ------------------------------------------------------------------

  async addStock(id, quantity, user, queryRunner = null) {
    if (quantity <= 0) throw new Error("Quantity must be positive");
    return await this._adjustStock(id, quantity, user, queryRunner);
  }

  async removeStock(id, quantity, user, queryRunner = null) {
    if (quantity <= 0) throw new Error("Quantity must be positive");
    return await this._adjustStock(id, -quantity, user, queryRunner);
  }

  async getLowStockProducts() {
    const repo = await this._getRepository();
    const qb = repo
      .createQueryBuilder("product")
      .where("product.is_deleted = false")
      .andWhere("product.is_active = true")
      .andWhere("product.stock <= product.reorder_level");
    return await qb.getMany();
  }

  // ------------------------------------------------------------------
  // Statistics
  // ------------------------------------------------------------------

  async getStatistics() {
    const repo = await this._getRepository();
    const totalActive = await repo.count({
      where: { is_deleted: false, is_active: true },
    });
    const totalInactive = await repo.count({
      where: { is_deleted: false, is_active: false },
    });

    const totalValueResult = await repo
      .createQueryBuilder("product")
      .select("SUM(product.stock * product.price)", "totalValue")
      .where("product.is_deleted = false")
      .getRawOne();
    const totalStockValue = parseFloat(totalValueResult?.totalValue) || 0;

    const avgPriceResult = await repo
      .createQueryBuilder("product")
      .select("AVG(product.price)", "averagePrice")
      .where("product.is_deleted = false")
      .andWhere("product.is_active = true")
      .getRawOne();
    const averagePrice = parseFloat(avgPriceResult?.averagePrice) || 0;

    const lowStockCount = await repo
      .createQueryBuilder("product")
      .where("product.is_deleted = false")
      .andWhere("product.is_active = true")
      .andWhere("product.stock <= product.reorder_level")
      .getCount();

    return {
      totalActive,
      totalInactive,
      totalStockValue,
      averagePrice,
      lowStockCount,
    };
  }
}

const productService = new ProductService();
module.exports = productService;
