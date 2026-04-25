//@ts-check
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

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new client
   * @param {Object} data
   * @param {string} user
   */
  async create(data, user = 'system') {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { client: repo } = await this.getRepositories();

    try {
      if (!data.name) throw new Error('Client name is required');
      if (!data.email) throw new Error('Email is required');

      // Check unique email
      const existing = await repo.findOne({ where: { email: data.email } });
      if (existing) throw new Error(`Email "${data.email}" is already used`);

      const client = repo.create({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        address: data.address || null,
      });

      const saved = await saveDb(repo, client);
      await auditLogger.logCreate('Client', saved.id, saved, user);
      return saved;
    } catch (error) {
      console.error('Failed to create client:', error.message);
      throw error;
    }
  }

  /**
   * Update a client
   * @param {number} id
   * @param {Object} data
   * @param {string} user
   */
  async update(id, data, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { client: repo } = await this.getRepositories();

    try {
      const existing = await repo.findOne({ where: { id, is_deleted: false } });
      if (!existing) throw new Error(`Client with ID ${id} not found`);
      const oldData = { ...existing };

      // Check email uniqueness if changed
      if (data.email && data.email !== existing.email) {
        const emailExists = await repo.findOne({ where: { email: data.email } });
        if (emailExists) throw new Error(`Email "${data.email}" is already used`);
      }

      // Apply updates
      if (data.name !== undefined) existing.name = data.name;
      if (data.email !== undefined) existing.email = data.email;
      if (data.phone !== undefined) existing.phone = data.phone;
      if (data.address !== undefined) existing.address = data.address;

      const updated = await updateDb(repo, existing);
      await auditLogger.logUpdate('Client', id, oldData, updated, user);
      return updated;
    } catch (error) {
      console.error('Failed to update client:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete a client
   * @param {number} id
   * @param {string} user
   */
  async delete(id, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { client: repo } = await this.getRepositories();

    try {
      const client = await repo.findOne({ where: { id, is_deleted: false } });
      if (!client) throw new Error(`Client with ID ${id} not found`);
      if (client.is_deleted) throw new Error(`Client #${id} is already deleted`);

      const oldData = { ...client };
      client.is_deleted = true;
      client.updated_at = new Date();

      const updated = await updateDb(repo, client);
      await auditLogger.logDelete('Client', id, oldData, user);
      return updated;
    } catch (error) {
      console.error('Failed to delete client:', error.message);
      throw error;
    }
  }

  /**
   * Find client by ID
   * @param {number} id
   */
  async findById(id) {
    const { client: repo } = await this.getRepositories();

    try {
      const client = await repo.findOne({ where: { id, is_deleted: false } });
      if (!client) throw new Error(`Client with ID ${id} not found`);
      return client;
    } catch (error) {
      console.error('Failed to find client:', error.message);
      throw error;
    }
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
    const { client: repo } = await this.getRepositories();

    const qb = repo.createQueryBuilder('client').where('client.is_deleted = false');

    if (options.search) {
      qb.andWhere(
        '(client.name LIKE :search OR client.email LIKE :search OR client.phone LIKE :search)',
        { search: `%${options.search}%` }
      );
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`client.${sortBy}`, sortOrder);

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;
      qb.skip(skip).take(options.limit);
    }

    const clients = await qb.getMany();
    return clients;
  }

  /**
   * Get client statistics
   */
  async getStatistics() {
    const { client: repo } = await this.getRepositories();

    try {
      const total = await repo.count({ where: { is_deleted: false } });
      // You could add more stats later, like clients with pets, etc.
      return { total };
    } catch (error) {
      console.error('Failed to get client statistics:', error);
      throw error;
    }
  }
}

const clientService = new ClientService();
module.exports = clientService;