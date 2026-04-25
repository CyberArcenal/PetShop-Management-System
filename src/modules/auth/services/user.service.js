//@ts-check
const { AppDataSource } = require('../../../db/datasource');
const bcrypt = require('bcrypt');

class UserService {
  constructor() {
    this.userRepo = null;
  }

  async initialize() {
    if (this.userRepo) return;
    const { UserEntity } = require('../entities/user.entity');
    this.userRepo = AppDataSource.getRepository(UserEntity);
    console.log('UserService initialized');
  }

  async getRepositories() {
    if (!this.userRepo) await this.initialize();
    return { user: this.userRepo };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  async _hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new user
   * @param {Object} data
   * @param {string} user
   */
  async create(data, user = 'system') {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { user: repo } = await this.getRepositories();

    try {
      if (!data.username) throw new Error('Username is required');
      if (!data.email) throw new Error('Email is required');
      if (!data.password) throw new Error('Password is required');

      // Check uniqueness
      const existing = await repo.findOne({
        where: [{ username: data.username }, { email: data.email }],
      });
      if (existing) {
        if (existing.username === data.username) throw new Error('Username already taken');
        if (existing.email === data.email) throw new Error('Email already registered');
      }

      const hashed = await this._hashPassword(data.password);
      const userData = {
        username: data.username,
        email: data.email,
        password_hash: hashed,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        role: data.role || 'staff',
        is_active: data.isActive !== undefined ? data.isActive : true,
      };

      const newUser = repo.create(userData);
      const saved = await saveDb(repo, newUser);

      // Remove password hash from returned object
      const { password_hash, ...result } = saved;
      await auditLogger.logCreate('User', saved.id, result, user);
      return result;
    } catch (error) {
      console.error('Failed to create user:', error.message);
      throw error;
    }
  }

  /**
   * Update user
   * @param {number} id
   * @param {Object} data
   * @param {string} user
   */
  async update(id, data, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { user: repo } = await this.getRepositories();

    try {
      const existing = await repo.findOne({ where: { id, is_deleted: false } });
      if (!existing) throw new Error(`User with ID ${id} not found`);
      const oldData = { ...existing };

      // Update fields
      if (data.username) existing.username = data.username;
      if (data.email) existing.email = data.email;
      if (data.firstName !== undefined) existing.first_name = data.firstName;
      if (data.lastName !== undefined) existing.last_name = data.lastName;
      if (data.role) existing.role = data.role;
      if (data.isActive !== undefined) existing.is_active = data.isActive;
      if (data.password) {
        existing.password_hash = await this._hashPassword(data.password);
      }

      const updated = await updateDb(repo, existing);
      const { password_hash, ...result } = updated;
      await auditLogger.logUpdate('User', id, oldData, result, user);
      return result;
    } catch (error) {
      console.error('Failed to update user:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete user
   * @param {number} id
   * @param {string} user
   */
  async delete(id, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { user: repo } = await this.getRepositories();

    try {
      const userEntity = await repo.findOne({ where: { id, is_deleted: false } });
      if (!userEntity) throw new Error(`User with ID ${id} not found`);
      const oldData = { ...userEntity };
      userEntity.is_deleted = true;
      userEntity.updated_at = new Date();

      const updated = await updateDb(repo, userEntity);
      await auditLogger.logDelete('User', id, oldData, user);
      return { id: updated.id, is_deleted: true };
    } catch (error) {
      console.error('Failed to delete user:', error.message);
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id
   */
  async findById(id) {
    const { user: repo } = await this.getRepositories();
    const user = await repo.findOne({ where: { id, is_deleted: false } });
    if (!user) throw new Error(`User with ID ${id} not found`);
    const { password_hash, ...result } = user;
    return result;
  }

  /**
   * Find user by email or username
   * @param {string} identifier - email or username
   */
  async findByIdentifier(identifier) {
    const { user: repo } = await this.getRepositories();
    const user = await repo.findOne({
      where: [{ email: identifier }, { username: identifier }],
      is_deleted: false,
    });
    return user; // may include password_hash
  }

  /**
   * List users with pagination and filtering
   * @param {Object} options
   */
  async findAll(options = {}) {
    const { user: repo } = await this.getRepositories();
    const qb = repo.createQueryBuilder('user').where('user.is_deleted = false');

    if (options.role) {
      qb.andWhere('user.role = :role', { role: options.role });
    }
    if (options.isActive !== undefined) {
      qb.andWhere('user.is_active = :isActive', { isActive: options.isActive });
    }
    if (options.search) {
      qb.andWhere('(user.username LIKE :search OR user.email LIKE :search OR user.first_name LIKE :search OR user.last_name LIKE :search)', {
        search: `%${options.search}%`,
      });
    }

    const sortBy = options.sortBy || 'id';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`user.${sortBy}`, sortOrder);

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;
      qb.skip(skip).take(options.limit);
    }

    const users = await qb.getMany();
    return users.map(({ password_hash, ...user }) => user);
  }
}

const userService = new UserService();
module.exports = userService;