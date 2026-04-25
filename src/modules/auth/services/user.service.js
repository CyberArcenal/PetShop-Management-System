
const { AppDataSource } = require("../../../db/datasource");
const bcrypt = require("bcrypt");

class UserService {
  constructor() {
    this.userRepo = null;
  }

  async initialize() {
    if (this.userRepo) return;
    const { UserEntity } = require("../entities/user.entity");
    this.userRepo = AppDataSource.getRepository(UserEntity);
    console.log("UserService initialized");
  }

  async getRepositories() {
    if (!this.userRepo) await this.initialize();
    return { user: this.userRepo };
  }

  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { UserEntity } = require("../entities/user.entity");
      // @ts-ignore
      return queryRunner.manager.getRepository(UserEntity);
    }
    return (await this.getRepositories()).user;
  }

  // @ts-ignore
  async _hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  async _save(repo, entity, queryRunner = null, currentUser) {
    const { saveDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await saveDb(queryRunner.manager, entity, {user: currentUser});
      // return await queryRunner.manager.save(entity);
    }
    return await saveDb(repo, entity, {user: currentUser});
  }

  async _update(repo, entity, queryRunner = null, currentUser) {
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

  // @ts-ignore
  async create(data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    if (!data.username) throw new Error("Username is required");
    if (!data.email) throw new Error("Email is required");
    if (!data.password) throw new Error("Password is required");

    // Check uniqueness
    const existing = await repo.findOne({
      where: [{ username: data.username }, { email: data.email }],
    });
    if (existing) {
      if (existing.username === data.username)
        throw new Error("Username already taken");
      if (existing.email === data.email)
        throw new Error("Email already registered");
    }

    const hashed = await this._hashPassword(data.password);
    const userData = {
      username: data.username,
      email: data.email,
      password_hash: hashed,
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      role: data.role || "staff",
      is_active: data.isActive !== undefined ? data.isActive : true,
    };

    const newUser = repo.create(userData);
    const saved = await this._save(repo, newUser, queryRunner, user);
    const { password_hash, ...result } = saved;
    await auditLogger.logCreate("User", saved.id, result, user.id);
    return result;
  }

  // @ts-ignore
  async update(id, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const existing = await repo.findOne({ where: { id, is_deleted: false } });
    if (!existing) throw new Error(`User with ID ${id} not found`);
    const oldData = { ...existing };

    if (data.username) existing.username = data.username;
    if (data.email) existing.email = data.email;
    if (data.firstName !== undefined) existing.first_name = data.firstName;
    if (data.lastName !== undefined) existing.last_name = data.lastName;
    if (data.role) existing.role = data.role;
    if (data.isActive !== undefined) existing.is_active = data.isActive;
    if (data.password) {
      existing.password_hash = await this._hashPassword(data.password);
    }

    const updated = await this._update(repo, existing, queryRunner, user);
    const { password_hash, ...result } = updated;
    await auditLogger.logUpdate("User", id, oldData, result, user.id);
    return result;
  }

  // @ts-ignore
  async delete(id, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const userEntity = await repo.findOne({ where: { id, is_deleted: false } });
    if (!userEntity) throw new Error(`User with ID ${id} not found`);
    const oldData = { ...userEntity };
    userEntity.is_deleted = true;
    userEntity.updated_at = new Date();

    const updated = await this._update(repo, userEntity, queryRunner, user);
    await auditLogger.logDelete("User", id, oldData, user.id);
    return { id: updated.id, is_deleted: true };
  }

  // @ts-ignore
  async findById(id) {
    const repo = await this._getRepository();
    const user = await repo.findOne({ where: { id, is_deleted: false } });
    if (!user) throw new Error(`User with ID ${id} not found`);
    const { password_hash, ...result } = user;
    return result;
  }

  // @ts-ignore
  async findByIdentifier(identifier) {
    const repo = await this._getRepository();
    const user = await repo.findOne({
      where: [{ email: identifier }, { username: identifier }],
    });
    return user; // includes password_hash
  }

  async findAll(options = {}) {
    const repo = await this._getRepository();
    const {
      // @ts-ignore
      page = 1,
      // @ts-ignore
      limit = 10,
      // @ts-ignore
      role,
      // @ts-ignore
      isActive,
      // @ts-ignore
      search,
      // @ts-ignore
      sortBy = "id",
      // @ts-ignore
      sortOrder = "DESC",
    } = options;

    const qb = repo.createQueryBuilder("user").where("user.is_deleted = false");

    if (role) qb.andWhere("user.role = :role", { role });
    if (isActive !== undefined)
      qb.andWhere("user.is_active = :isActive", { isActive });
    if (search) {
      qb.andWhere(
        "(user.username LIKE :search OR user.email LIKE :search OR user.first_name LIKE :search OR user.last_name LIKE :search)",
        { search: `%${search}%` }
      );
    }

    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`user.${sortBy}`, order);

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [users, total] = await qb.getManyAndCount();

    // @ts-ignore
    const cleanedUsers = users.map(({ password_hash, ...u }) => u);
    return {
      data: cleanedUsers,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }
}

const userService = new UserService();
module.exports = userService;
