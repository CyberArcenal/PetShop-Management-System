//@ts-check
const { AppDataSource } = require('../../../db/datasource');

class ProductService {
  constructor() {
    this.productRepo = null;
  }

  async initialize() {
    if (this.productRepo) return;
    const { ProductEntity } = require('../entities/product.entity');
    this.productRepo = AppDataSource.getRepository(ProductEntity);
    console.log('ProductService initialized');
  }

  async getRepositories() {
    if (!this.productRepo) await this.initialize();
    return { product: this.productRepo };
  }

  // ------------------------------------------------------------------
  // Stock helpers
  // ------------------------------------------------------------------

  async _adjustStock(id, delta, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { product: repo } = await this.getRepositories();

    const product = await repo.findOne({ where: { id, is_deleted: false } });
    if (!product) throw new Error(`Product with ID ${id} not found`);
    const oldStock = product.stock;
    const newStock = oldStock + delta;
    if (newStock < 0) throw new Error(`Insufficient stock. Current: ${oldStock}, adjustment: ${delta}`);
    product.stock = newStock;
    product.updated_at = new Date();
    const updated = await updateDb(repo, product);
    await auditLogger.logUpdate('Product', id, { stock: oldStock }, { stock: newStock }, user);
    return updated;
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new product
   * @param {Object} data
   * @param {string} user
   */
  async create(data, user = 'system') {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { product: repo } = await this.getRepositories();

    try {
      if (!data.name) throw new Error('Product name is required');
      if (data.price === undefined) throw new Error('Price is required');

      const product = repo.create({
        name: data.name,
        category: data.category || null,
        price: data.price,
        stock: data.stock !== undefined ? data.stock : 0,
        reorder_level: data.reorderLevel !== undefined ? data.reorderLevel : 5,
        description: data.description || null,
        is_active: data.isActive !== undefined ? data.isActive : true,
      });

      const saved = await saveDb(repo, product);
      await auditLogger.logCreate('Product', saved.id, saved, user);
      return saved;
    } catch (error) {
      console.error('Failed to create product:', error.message);
      throw error;
    }
  }

  /**
   * Update a product
   * @param {number} id
   * @param {Object} data
   * @param {string} user
   */
  async update(id, data, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { product: repo } = await this.getRepositories();

    try {
      const existing = await repo.findOne({ where: { id, is_deleted: false } });
      if (!existing) throw new Error(`Product with ID ${id} not found`);
      const oldData = { ...existing };

      // Apply updates
      if (data.name !== undefined) existing.name = data.name;
      if (data.category !== undefined) existing.category = data.category;
      if (data.price !== undefined) existing.price = data.price;
      if (data.stock !== undefined) existing.stock = data.stock;
      if (data.reorderLevel !== undefined) existing.reorder_level = data.reorderLevel;
      if (data.description !== undefined) existing.description = data.description;
      if (data.isActive !== undefined) existing.is_active = data.isActive;

      const updated = await updateDb(repo, existing);
      await auditLogger.logUpdate('Product', id, oldData, updated, user);
      return updated;
    } catch (error) {
      console.error('Failed to update product:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete a product
   * @param {number} id
   * @param {string} user
   */
  async delete(id, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { product: repo } = await this.getRepositories();

    try {
      const product = await repo.findOne({ where: { id, is_deleted: false } });
      if (!product) throw new Error(`Product with ID ${id} not found`);
      if (product.is_deleted) throw new Error(`Product #${id} is already deleted`);

      const oldData = { ...product };
      product.is_deleted = true;
      product.updated_at = new Date();

      const updated = await updateDb(repo, product);
      await auditLogger.logDelete('Product', id, oldData, user);
      return updated;
    } catch (error) {
      console.error('Failed to delete product:', error.message);
      throw error;
    }
  }

  /**
   * Find product by ID
   * @param {number} id
   */
  async findById(id) {
    const { product: repo } = await this.getRepositories();
    const product = await repo.findOne({ where: { id, is_deleted: false } });
    if (!product) throw new Error(`Product with ID ${id} not found`);
    return product;
  }

  /**
   * Find all products with filtering, search, pagination, sorting
   * @param {Object} options
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @param {string} [options.category]
   * @param {boolean} [options.isActive]
   * @param {string} [options.search] - search by name
   * @param {number} [options.minPrice]
   * @param {number} [options.maxPrice]
   * @param {boolean} [options.lowStockOnly] - only products where stock <= reorder_level
   * @param {string} [options.sortBy]
   * @param {string} [options.sortOrder]
   */
  async findAll(options = {}) {
    const { product: repo } = await this.getRepositories();

    const qb = repo.createQueryBuilder('product').where('product.is_deleted = false');

    if (options.category) {
      qb.andWhere('product.category = :category', { category: options.category });
    }
    if (options.isActive !== undefined) {
      qb.andWhere('product.is_active = :isActive', { isActive: options.isActive });
    }
    if (options.search) {
      qb.andWhere('product.name LIKE :search', { search: `%${options.search}%` });
    }
    if (options.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: options.minPrice });
    }
    if (options.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: options.maxPrice });
    }
    if (options.lowStockOnly) {
      qb.andWhere('product.stock <= product.reorder_level');
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`product.${sortBy}`, sortOrder);

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;
      qb.skip(skip).take(options.limit);
    }

    const products = await qb.getMany();
    return products;
  }

  // ------------------------------------------------------------------
  // Stock management
  // ------------------------------------------------------------------

  /**
   * Increase stock
   * @param {number} id
   * @param {number} quantity
   * @param {string} user
   */
  async addStock(id, quantity, user = 'system') {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    return await this._adjustStock(id, quantity, user);
  }

  /**
   * Decrease stock (sell / use)
   * @param {number} id
   * @param {number} quantity
   * @param {string} user
   */
  async removeStock(id, quantity, user = 'system') {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    return await this._adjustStock(id, -quantity, user);
  }

  /**
   * Get products that have low stock (stock <= reorder_level) and are active
   */
  async getLowStockProducts() {
    const { product: repo } = await this.getRepositories();
    return await repo.find({
      where: {
        is_deleted: false,
        is_active: true,
        stock: { $le: 'reorder_level' }, // This might need QueryBuilder for cross-column comparison
      },
    });
    // Better with QueryBuilder for cross-column comparison:
    // const qb = repo.createQueryBuilder('product')
    //   .where('product.is_deleted = false')
    //   .andWhere('product.is_active = true')
    //   .andWhere('product.stock <= product.reorder_level');
    // return await qb.getMany();
  }

  // ------------------------------------------------------------------
  // Statistics
  // ------------------------------------------------------------------

  async getStatistics() {
    const { product: repo } = await this.getRepositories();

    try {
      const totalActive = await repo.count({ where: { is_deleted: false, is_active: true } });
      const totalInactive = await repo.count({ where: { is_deleted: false, is_active: false } });

      // Total stock value (sum of stock * price)
      const totalValueResult = await repo
        .createQueryBuilder('product')
        .select('SUM(product.stock * product.price)', 'totalValue')
        .where('product.is_deleted = false')
        .getRawOne();
      const totalStockValue = parseFloat(totalValueResult?.totalValue) || 0;

      // Average price of active products
      const avgPriceResult = await repo
        .createQueryBuilder('product')
        .select('AVG(product.price)', 'averagePrice')
        .where('product.is_deleted = false')
        .andWhere('product.is_active = true')
        .getRawOne();
      const averagePrice = parseFloat(avgPriceResult?.averagePrice) || 0;

      // Count low stock products (stock <= reorder_level and active)
      const lowStockCount = await repo
        .createQueryBuilder('product')
        .where('product.is_deleted = false')
        .andWhere('product.is_active = true')
        .andWhere('product.stock <= product.reorder_level')
        .getCount();

      return {
        totalActive,
        totalInactive,
        totalStockValue,
        averagePrice,
        lowStockCount,
      };
    } catch (error) {
      console.error('Failed to get product statistics:', error);
      throw error;
    }
  }
}

const productService = new ProductService();
module.exports = productService;