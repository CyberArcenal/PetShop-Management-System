
const { AppDataSource } = require("../../../db/datasource");

class AppointmentService {
  constructor() {
    this.appointmentRepo = null;
    this.clientRepo = null;
    this.petRepo = null;
    this.productRepo = null;
  }

  async initialize() {
    if (this.appointmentRepo) return;

    const { AppointmentEntity } = require('../entities/appointment.entity');
    const { ClientEntity } = require('../../clients/entities/client.entity');
    const { PetEntity } = require('../../pets/entities/pet.entity');
    const { ProductEntity } = require('../../products/entities/product.entity');

    this.appointmentRepo = AppDataSource.getRepository(AppointmentEntity);
    this.clientRepo = AppDataSource.getRepository(ClientEntity);
    this.petRepo = AppDataSource.getRepository(PetEntity);
    this.productRepo = AppDataSource.getRepository(ProductEntity);

    console.log('AppointmentService initialized');
  }

  async getRepositories() {
    if (!this.appointmentRepo) await this.initialize();
    return {
      appointment: this.appointmentRepo,
      client: this.clientRepo,
      pet: this.petRepo,
      product: this.productRepo,
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
     * @param {{ client: any; id: any; }} appointment
     */
  async _loadRelations(appointment) {
    if (!appointment) return null;
    if (appointment.client) return appointment; // already loaded
    return await this.appointmentRepo.findOne({
      where: { id: appointment.id },
      relations: ['client', 'pet', 'product'],
    });
  }

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------

  /**
   * Create a new appointment
   * @param {Object} data
   * @param {string} user
   */
  async create(data, user = 'system') {
    const { saveDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { appointment: repo, client: clientRepo, pet: petRepo, product: productRepo } = await this.getRepositories();

    try {
      // Validate required fields
      if (!data.clientId) throw new Error('Client ID is required');
      if (!data.serviceType) throw new Error('Service type is required');
      if (!data.appointmentDate) throw new Error('Appointment date is required');

      // Resolve relations
      const client = await clientRepo.findOne({ where: { id: data.clientId, is_deleted: false } });
      if (!client) throw new Error(`Client with ID ${data.clientId} not found`);

      let pet = null;
      if (data.petId) {
        pet = await petRepo.findOne({ where: { id: data.petId, is_deleted: false } });
        if (!pet) throw new Error(`Pet with ID ${data.petId} not found`);
        // Ensure pet belongs to the client
        if (pet.client_id !== data.clientId) throw new Error('Pet does not belong to the client');
      }

      let product = null;
      if (data.productId) {
        product = await productRepo.findOne({ where: { id: data.productId, is_deleted: false } });
        if (!product) throw new Error(`Product with ID ${data.productId} not found`);
      }

      // Build appointment entity
      const appointment = repo.create({
        client_id: data.clientId,
        pet_id: data.petId || null,
        product_id: data.productId || null,
        service_type: data.serviceType,
        appointment_date: data.appointmentDate,
        status: data.status || 'Scheduled',
        notes: data.notes || null,
      });

      const saved = await saveDb(repo, appointment);
      const savedWithRelations = await repo.findOne({
        where: { id: saved.id },
        relations: ['client', 'pet', 'product'],
      });

      await auditLogger.logCreate('Appointment', saved.id, savedWithRelations, user);
      return savedWithRelations;
    } catch (error) {
      console.error('Failed to create appointment:', error.message);
      throw error;
    }
  }

  /**
   * Update an appointment
   * @param {number} id
   * @param {Object} data
   * @param {string} user
   */
  async update(id, data, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { appointment: repo, client: clientRepo, pet: petRepo, product: productRepo } = await this.getRepositories();

    try {
      const existing = await repo.findOne({
        where: { id, is_deleted: false },
        relations: ['client', 'pet', 'product'],
      });
      if (!existing) throw new Error(`Appointment with ID ${id} not found`);
      const oldData = { ...existing };

      // Update simple fields
      if (data.serviceType) existing.service_type = data.serviceType;
      if (data.appointmentDate) existing.appointment_date = data.appointmentDate;
      if (data.status) existing.status = data.status;
      if (data.notes !== undefined) existing.notes = data.notes;

      // Update relations
      if (data.clientId !== undefined) {
        if (!data.clientId) {
          existing.client = null;
          existing.client_id = null;
        } else {
          const client = await clientRepo.findOne({ where: { id: data.clientId, is_deleted: false } });
          if (!client) throw new Error(`Client with ID ${data.clientId} not found`);
          existing.client = client;
          existing.client_id = client.id;
        }
      }

      if (data.petId !== undefined) {
        if (!data.petId) {
          existing.pet = null;
          existing.pet_id = null;
        } else {
          const pet = await petRepo.findOne({ where: { id: data.petId, is_deleted: false } });
          if (!pet) throw new Error(`Pet with ID ${data.petId} not found`);
          // Optionally check client match (if clientId also changed, validate later)
          existing.pet = pet;
          existing.pet_id = pet.id;
        }
      }

      if (data.productId !== undefined) {
        if (!data.productId) {
          existing.product = null;
          existing.product_id = null;
        } else {
          const product = await productRepo.findOne({ where: { id: data.productId, is_deleted: false } });
          if (!product) throw new Error(`Product with ID ${data.productId} not found`);
          existing.product = product;
          existing.product_id = product.id;
        }
      }

      // Ensure pet belongs to client if both are being updated
      if (existing.client && existing.pet && existing.pet.client_id !== existing.client.id) {
        throw new Error('Pet does not belong to the selected client');
      }

      const updated = await updateDb(repo, existing);
      const updatedWithRelations = await repo.findOne({
        where: { id: updated.id },
        relations: ['client', 'pet', 'product'],
      });

      await auditLogger.logUpdate('Appointment', id, oldData, updatedWithRelations, user);
      return updatedWithRelations;
    } catch (error) {
      console.error('Failed to update appointment:', error.message);
      throw error;
    }
  }

  /**
   * Soft delete an appointment (set is_deleted = true)
   * @param {number} id
   * @param {string} user
   */
  async delete(id, user = 'system') {
    const { updateDb } = require('../../../common/utils/dbUtils/dbActions');
    const auditLogger = require('../../../common/utils/auditLogger');
    const { appointment: repo } = await this.getRepositories();

    try {
      const appointment = await repo.findOne({ where: { id, is_deleted: false } });
      if (!appointment) throw new Error(`Appointment with ID ${id} not found`);
      if (appointment.is_deleted) throw new Error(`Appointment #${id} is already deleted`);

      const oldData = { ...appointment };
      appointment.is_deleted = true;
      appointment.updated_at = new Date();

      const updated = await updateDb(repo, appointment);
      await auditLogger.logDelete('Appointment', id, oldData, user);
      return updated;
    } catch (error) {
      console.error('Failed to delete appointment:', error.message);
      throw error;
    }
  }

  /**
   * Find appointment by ID with relations
   * @param {number} id
   */
  async findById(id) {
    const { appointment: repo } = await this.getRepositories();

    try {
      const appointment = await repo.findOne({
        where: { id, is_deleted: false },
        relations: ['client', 'pet', 'product'],
      });
      if (!appointment) throw new Error(`Appointment with ID ${id} not found`);
      // auditLogger.logView('Appointment', id, 'system'); // optional
      return appointment;
    } catch (error) {
      console.error('Failed to find appointment:', error.message);
      throw error;
    }
  }

  /**
   * Find all appointments with filters, pagination, sorting
   * @param {Object} options
   * @param {number} [options.page]
   * @param {number} [options.limit]
   * @param {string} [options.status]
   * @param {number} [options.clientId]
   * @param {number} [options.petId]
   * @param {Date} [options.fromDate]
   * @param {Date} [options.toDate]
   * @param {string} [options.sortBy]
   * @param {string} [options.sortOrder]
   */
  async findAll(options = {}) {
    const { appointment: repo } = await this.getRepositories();

    try {
      const qb = repo
        .createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.client', 'client')
        .leftJoinAndSelect('appointment.pet', 'pet')
        .leftJoinAndSelect('appointment.product', 'product')
        .where('appointment.is_deleted = :deleted', { deleted: false });

      if (options.status) {
        qb.andWhere('appointment.status = :status', { status: options.status });
      }
      if (options.clientId) {
        qb.andWhere('appointment.client_id = :clientId', { clientId: options.clientId });
      }
      if (options.petId) {
        qb.andWhere('appointment.pet_id = :petId', { petId: options.petId });
      }
      if (options.fromDate) {
        qb.andWhere('appointment.appointment_date >= :fromDate', { fromDate: options.fromDate });
      }
      if (options.toDate) {
        qb.andWhere('appointment.appointment_date <= :toDate', { toDate: options.toDate });
      }

      // Sorting
      const sortBy = options.sortBy || 'appointment_date';
      const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
      qb.orderBy(`appointment.${sortBy}`, sortOrder);

      // Pagination
      if (options.page && options.limit) {
        const skip = (options.page - 1) * options.limit;
        qb.skip(skip).take(options.limit);
      }

      const appointments = await qb.getMany();
      return appointments;
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      throw error;
    }
  }

  /**
   * Get statistics for appointments
   */
  async getStatistics() {
    const { appointment: repo } = await this.getRepositories();

    try {
      const total = await repo.count({ where: { is_deleted: false } });
      const scheduled = await repo.count({ where: { status: 'Scheduled', is_deleted: false } });
      const confirmed = await repo.count({ where: { status: 'Confirmed', is_deleted: false } });
      const completed = await repo.count({ where: { status: 'Completed', is_deleted: false } });
      const cancelled = await repo.count({ where: { status: 'Cancelled', is_deleted: false } });
      const noShow = await repo.count({ where: { status: 'NoShow', is_deleted: false } });

      return { total, scheduled, confirmed, completed, cancelled, noShow };
    } catch (error) {
      console.error('Failed to get appointment statistics:', error);
      throw error;
    }
  }
}

const appointmentService = new AppointmentService();
module.exports = appointmentService;