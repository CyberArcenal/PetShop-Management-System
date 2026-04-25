
const { AppDataSource } = require("../../../db/datasource");

class PetService {
  constructor() {
    this.petRepo = null;
  }

  async initialize() {
    if (this.petRepo) return;
    const { PetEntity } = require("../entities/pet.entity");
    this.petRepo = AppDataSource.getRepository(PetEntity);
    console.log("PetService initialized");
  }

  async getRepositories() {
    if (!this.petRepo) await this.initialize();
    return { pet: this.petRepo };
  }

  async _getRepository(queryRunner = null) {
    if (queryRunner) {
      const { PetEntity } = require("../entities/pet.entity");
      return queryRunner.manager.getRepository(PetEntity);
    }
    return (await this.getRepositories()).pet;
  }

  async _getClientRepository(queryRunner = null) {
    if (queryRunner) {
      const { ClientEntity } = require("../../clients/entities/client.entity");
      return queryRunner.manager.getRepository(ClientEntity);
    }
    const { ClientEntity } = require("../../clients/entities/client.entity");
    return AppDataSource.getRepository(ClientEntity);
  }

  async _save(repo, entity, queryRunner = null, currentUser=null) {
    const { saveDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await saveDb(queryRunner.manager, entity, {user:currentUser});
      // return await queryRunner.manager.save(entity);
    }
    return await saveDb(repo, entity, {user:currentUser});
  }

  async _update(repo, entity, queryRunner = null, currentUser=null) {
    const { updateDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await updateDb(queryRunner.manager, entity, {user:currentUser});
      // return await queryRunner.manager.save(entity);
    }
    return await updateDb(repo, entity, {user:currentUser});
  }

  async _remove(repo, entity, queryRunner = null, currentUser=null) {
    const { removeDb } = require("../../../common/utils/dbUtils/dbActions");
    if (queryRunner) {
      return await removeDb(queryRunner.manager, entity, {user:currentUser});
      // return await queryRunner.manager.remove(entity);
    }

    return await removeDb(repo, entity, {user:currentUser});
  }

  async _validateClient(clientId, queryRunner = null) {
    const clientRepo = await this._getClientRepository(queryRunner);
    const client = await clientRepo.findOne({
      where: { id: clientId, is_deleted: false },
    });
    if (!client) throw new Error(`Client with ID ${clientId} not found`);
    return client;
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new pet
   * @param {Object} data
   * @param {Object} user - { id, ... } from JWT
   * @param {Object} queryRunner - optional transaction runner
   */
  async create(data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    if (!data.clientId) throw new Error("Client ID is required");
    if (!data.name) throw new Error("Pet name is required");
    if (!data.species) throw new Error("Species is required");

    await this._validateClient(data.clientId, queryRunner);

    const pet = repo.create({
      client_id: data.clientId,
      name: data.name,
      species: data.species,
      breed: data.breed || null,
      birth_date: data.birthDate || null,
      weight: data.weight || null,
      medical_notes: data.medicalNotes || null,
    });

    const saved = await this._save(repo, pet, queryRunner, user);
    await auditLogger.logCreate("Pet", saved.id, saved, user.id);
    return saved;
  }

  /**
   * Update a pet
   * @param {number} id
   * @param {Object} data
   * @param {Object} user
   * @param {Object} queryRunner
   */
  async update(id, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const existing = await repo.findOne({ where: { id, is_deleted: false } });
    if (!existing) throw new Error(`Pet with ID ${id} not found`);
    const oldData = { ...existing };

    if (data.clientId && data.clientId !== existing.client_id) {
      await this._validateClient(data.clientId, queryRunner);
    }

    if (data.clientId !== undefined) existing.client_id = data.clientId;
    if (data.name !== undefined) existing.name = data.name;
    if (data.species !== undefined) existing.species = data.species;
    if (data.breed !== undefined) existing.breed = data.breed;
    if (data.birthDate !== undefined) existing.birth_date = data.birthDate;
    if (data.weight !== undefined) existing.weight = data.weight;
    if (data.medicalNotes !== undefined)
      existing.medical_notes = data.medicalNotes;

    const updated = await this._update(repo, existing, queryRunner, user);
    await auditLogger.logUpdate("Pet", id, oldData, updated, user.id);
    return updated;
  }

  /**
   * Soft delete a pet
   * @param {number} id
   * @param {Object} user
   * @param {Object} queryRunner
   */
  async delete(id, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const repo = await this._getRepository(queryRunner);

    const pet = await repo.findOne({ where: { id, is_deleted: false } });
    if (!pet) throw new Error(`Pet with ID ${id} not found`);
    if (pet.is_deleted) throw new Error(`Pet #${id} is already deleted`);

    const oldData = { ...pet };
    pet.is_deleted = true;
    pet.updated_at = new Date();

    const updated = await this._update(repo, pet, queryRunner);
    await auditLogger.logDelete("Pet", id, oldData, user.id);
    return updated;
  }

  /**
   * Find pet by ID (optionally include client relation)
   * @param {number} id
   * @param {boolean} withClient
   */
  async findById(id, withClient = false) {
    const repo = await this._getRepository();
    const query = repo
      .createQueryBuilder("pet")
      .where("pet.id = :id", { id })
      .andWhere("pet.is_deleted = false");
    if (withClient) {
      query.leftJoinAndSelect("pet.client", "client");
    }
    const pet = await query.getOne();
    if (!pet) throw new Error(`Pet with ID ${id} not found`);
    return pet;
  }

  /**
   * Find all pets with filtering, pagination, sorting
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {number} [options.clientId]
   * @param {string} [options.species]
   * @param {string} [options.search]
   * @param {string} [options.sortBy]
   * @param {string} [options.sortOrder]
   */
  async findAll(options = {}) {
    const repo = await this._getRepository();
    const {
      page = 1,
      limit = 10,
      clientId,
      species,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = options;

    const qb = repo
      .createQueryBuilder("pet")
      .leftJoinAndSelect("pet.client", "client")
      .where("pet.is_deleted = false");

    if (clientId) qb.andWhere("pet.client_id = :clientId", { clientId });
    if (species) qb.andWhere("pet.species = :species", { species });
    if (search) {
      qb.andWhere("(pet.name LIKE :search OR pet.breed LIKE :search)", {
        search: `%${search}%`,
      });
    }

    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`pet.${sortBy}`, order);

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
   * Get statistics for pets
   */
  async getStatistics() {
    const repo = await this._getRepository();
    const total = await repo.count({ where: { is_deleted: false } });
    const bySpecies = await repo
      .createQueryBuilder("pet")
      .select("pet.species", "species")
      .addSelect("COUNT(pet.id)", "count")
      .where("pet.is_deleted = false")
      .groupBy("pet.species")
      .getRawMany();
    return { total, bySpecies };
  }
}

const petService = new PetService();
module.exports = petService;
