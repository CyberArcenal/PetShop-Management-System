
const { AppDataSource } = require('../../../db/datasource');

class ClientService {
  constructor() {
    this.clientRepo = null;
  }

  async initialize() {
    if (this.clientRepo) return;
    const { ClientEntity } = require('../entities/client.entity');
    this.clientRepo = AppDataSource.getRepository(ClientEntity);
    console.log('ClientService initialized');
  }

  async getRepositories() {
    if (!this.clientRepo) await this.initialize();
    return { client: this.clientRepo };
  }

  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { ClientEntity } = require('../entities/client.entity');
      return queryRunner.manager.getRepository(ClientEntity);
    }
    return (await this.getRepositories()).client;
  }

  async _save(repo, entity, queryRunner = null, currentUser=null) {
    const { saveDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      
      return await saveDb(queryRunner.manager, entity, {user: currentUser});
      // return await queryRunner.manager.save(entity);
    }
    return await saveDb(repo, entity, {user: currentUser});
  }

  async _update(repo, entity, queryRunner = null, currentUser=null) {
    const { updateDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      
      return await updateDb(queryRunner.manager, entity, {user: currentUser});
      // return await queryRunner.manager.save(entity);
    }
    return await updateDb(repo, entity, {user: currentUser});
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new client
   * @param {Object} data
   * @param {Object} user - { id, ... } from JWT
   * @param {Object} queryRunner - optional transaction runner
   */
  async create(data, user, queryRunner = null) {
    const auditLogger = require('../../../common/utils/auditLogger');
    const repo = await this._getRepository(queryRunner);

    if (!data.name) throw new Error('Client name is required');
    if (!data.email) throw new Error('Email is required');

    const existing = await repo.findOne({ where: { email: data.email } });
    if (existing) throw new Error(`Email "${data.email}" is already used`);

    const client = repo.create({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
    });

    const saved = await this._save(repo, client, queryRunner, user);
    await auditLogger.logCreate('Client', saved.id, saved, user.id);
    return saved;
  }

  /**
   * Update a client
   * @param {number} id
   * @param {Object} data
   * @param {Object} user
   * @param {Object} queryRunner
   */
  async update(id, data, user, queryRunner = null) {
    const auditLogger = require('../../../common/utils/auditLogger');
    const repo = await this._getRepository(queryRunner);

    const existing = await repo.findOne({ where: { id, is_deleted: false } });
    if (!existing) throw new Error(`Client with ID ${id} not found`);
    const oldData = { ...existing };

    if (data.email && data.email !== existing.email) {
      const emailExists = await repo.findOne({ where: { email: data.email } });
      if (emailExists) throw new Error(`Email "${data.email}" is already used`);
    }

    if (data.name !== undefined) existing.name = data.name;
    if (data.email !== undefined) existing.email = data.email;
    if (data.phone !== undefined) existing.phone = data.phone;
    if (data.address !== undefined) existing.address = data.address;

    const updated = await this._update(repo, existing, queryRunner, user);
    await auditLogger.logUpdate('Client', id, oldData, updated, user.id);
    return updated;
  }

  /**
   * Soft delete a client
   * @param {number} id
   * @param {Object} user
   * @param {Object} queryRunner
   */
  async delete(id, user, queryRunner = null) {
    const auditLogger = require('../../../common/utils/auditLogger');
    const repo = await this._getRepository(queryRunner);

    const client = await repo.findOne({ where: { id, is_deleted: false } });
    if (!client) throw new Error(`Client with ID ${id} not found`);
    if (client.is_deleted) throw new Error(`Client #${id} is already deleted`);

    const oldData = { ...client };
    client.is_deleted = true;
    client.updated_at = new Date();

    const updated = await this._update(repo, client, queryRunner, user);
    await auditLogger.logDelete('Client', id, oldData, user.id);
    return updated;
  }

  /**
   * Find client by ID
   * @param {number} id
   */
  async findById(id) {
    const repo = await this._getRepository();
    const client = await repo.findOne({ where: { id, is_deleted: false } });
    if (!client) throw new Error(`Client with ID ${id} not found`);
    return client;
  }

  /**
   * Find all clients with filtering, search, pagination, sorting
   * @param {Object} options
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @param {string} [options.search]
   * @param {string} [options.sortBy]
   * @param {string} [options.sortOrder]
   */
  async findAll(options = {}) {
    const repo = await this._getRepository();
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    const qb = repo.createQueryBuilder('client').where('client.is_deleted = false');

    if (search) {
      qb.andWhere(
        '(client.name LIKE :search OR client.email LIKE :search OR client.phone LIKE :search)',
        { search: `%${search}%` }
      );
    }

    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`client.${sortBy}`, order);

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

  /**
   * Get client statistics
   */
  async getStatistics() {
    const repo = await this._getRepository();
    const total = await repo.count({ where: { is_deleted: false } });
    return { total };
  }
}

const clientService = new ClientService();
module.exports = clientService;