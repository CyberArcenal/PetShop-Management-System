//@ts-check
const { AppDataSource } = require('../../../db/datasource');

class PetService {
  constructor() {
    this.petRepo = null;
  }

  async initialize() {
    if (this.petRepo) return;
    const { PetEntity } = require('../entities/pet.entity');
    this.petRepo = AppDataSource.getRepository(PetEntity);
    console.log('PetService initialized');
  }

  async getRepositories() {
    if (!this.petRepo) await this.initialize();
    return { pet: this.petRepo };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  async _validateClient(clientId) {
    const { ClientEntity } = require('../../clients/entities/client.entity');
    const clientRepo = AppDataSource.getRepository(ClientEntity);
    const client = await clientRepo.findOne({ where: { id: clientId, is_deleted: false } });
    if (!client) throw new Error(`Client with ID ${clientId} not found`);
    return client;
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new pet
   * @param {Object} data
   * @param {string} user
   */
  async create(data, user = 'system') {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { pet: repo } = await this.getRepositories();

    try {
      if (!data.clientId) throw new Error('Client ID is required');
      if (!data.name) throw new Error('Pet name is required');
      if (!data.species) throw new Error('Species is required');

      // Validate client exists
      await this._validateClient(data.clientId);

      const pet = repo.create({
        client_id: data.clientId,
        name: data.name,
        species: data.species,
        breed: data.breed || null,
        birth_date: data.birthDate || null,
        weight: data.weight || null,
        medical_notes: data.medicalNotes || null,
      });

      const saved = await saveDb(repo, pet);
      await auditLogger.logCreate('Pet', saved.id, saved, user);
      return saved;
    } catch (error) {
      console.error('Failed to create pet:', error.message);
      throw error;
    }
  }

  /**
   * Update a pet
   * @param {number} id
   * @param {Object} data
   * @param {string} user
   */
  async update(id, data, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { pet: repo } = await this.getRepositories();

    try {
      const existing = await repo.findOne({ where: { id, is_deleted: false } });
      if (!existing) throw new Error(`Pet with ID ${id} not found`);
      const oldData = { ...existing };

      // If clientId is being changed, validate new client
      if (data.clientId && data.clientId !== existing.client_id) {
        await this._validateClient(data.clientId);
      }

      // Apply updates
      if (data.clientId !== undefined) existing.client_id = data.clientId;
      if (data.name !== undefined) existing.name = data.name;
      if (data.species !== undefined) existing.species = data.species;
      if (data.breed !== undefined) existing.breed = data.breed;
      if (data.birthDate !== undefined) existing.birth_date = data.birthDate;
      if (data.weight !== undefined) existing.weight = data.weight;
      if (data.medicalNotes !== undefined) existing.medical_notes = data.medicalNotes;

      const updated = await updateDb(repo, existing);
      await auditLogger.logUpdate('Pet', id, oldData, updated, user);
      return updated;
    } catch (error) {
      console.error('Failed to update pet:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete a pet
   * @param {number} id
   * @param {string} user
   */
  async delete(id, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { pet: repo } = await this.getRepositories();

    try {
      const pet = await repo.findOne({ where: { id, is_deleted: false } });
      if (!pet) throw new Error(`Pet with ID ${id} not found`);
      if (pet.is_deleted) throw new Error(`Pet #${id} is already deleted`);

      const oldData = { ...pet };
      pet.is_deleted = true;
      pet.updated_at = new Date();

      const updated = await updateDb(repo, pet);
      await auditLogger.logDelete('Pet', id, oldData, user);
      return updated;
    } catch (error) {
      console.error('Failed to delete pet:', error.message);
      throw error;
    }
  }

  /**
   * Find pet by ID (optionally include client relation)
   * @param {number} id
   * @param {boolean} withClient
   */
  async findById(id, withClient = false) {
    const { pet: repo } = await this.getRepositories();

    try {
      const query = repo.createQueryBuilder('pet').where('pet.id = :id', { id }).andWhere('pet.is_deleted = false');
      if (withClient) {
        query.leftJoinAndSelect('pet.client', 'client');
      }
      const pet = await query.getOne();
      if (!pet) throw new Error(`Pet with ID ${id} not found`);
      return pet;
    } catch (error) {
      console.error('Failed to find pet:', error.message);
      throw error;
    }
  }

  /**
   * Find all pets with filtering, pagination, sorting
   * @param {Object} options
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @param {number} [options.clientId]
   * @param {string} [options.species]
   * @param {string} [options.search] - search by name or breed
   * @param {string} [options.sortBy]
   * @param {string} [options.sortOrder]
   */
  async findAll(options = {}) {
    const { pet: repo } = await this.getRepositories();

    const qb = repo
      .createQueryBuilder('pet')
      .leftJoinAndSelect('pet.client', 'client')
      .where('pet.is_deleted = false');

    if (options.clientId) {
      qb.andWhere('pet.client_id = :clientId', { clientId: options.clientId });
    }
    if (options.species) {
      qb.andWhere('pet.species = :species', { species: options.species });
    }
    if (options.search) {
      qb.andWhere('(pet.name LIKE :search OR pet.breed LIKE :search)', { search: `%${options.search}%` });
    }

    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`pet.${sortBy}`, sortOrder);

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;
      qb.skip(skip).take(options.limit);
    }

    const pets = await qb.getMany();
    return pets;
  }

  /**
   * Get statistics for pets
   */
  async getStatistics() {
    const { pet: repo } = await this.getRepositories();

    try {
      const total = await repo.count({ where: { is_deleted: false } });
      const bySpecies = await repo
        .createQueryBuilder('pet')
        .select('pet.species, COUNT(pet.id) as count')
        .where('pet.is_deleted = false')
        .groupBy('pet.species')
        .getRawMany();

      return { total, bySpecies };
    } catch (error) {
      console.error('Failed to get pet statistics:', error);
      throw error;
    }
  }
}

const petService = new PetService();
module.exports = petService;