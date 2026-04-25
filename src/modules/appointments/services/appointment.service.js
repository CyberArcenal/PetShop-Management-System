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

    const { AppointmentEntity } = require("../entities/appointment.entity");
    const { ClientEntity } = require("../../clients/entities/client.entity");
    const { PetEntity } = require("../../pets/entities/pet.entity");
    const { ProductEntity } = require("../../products/entities/product.entity");

    this.appointmentRepo = AppDataSource.getRepository(AppointmentEntity);
    this.clientRepo = AppDataSource.getRepository(ClientEntity);
    this.petRepo = AppDataSource.getRepository(PetEntity);
    this.productRepo = AppDataSource.getRepository(ProductEntity);
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

  // Helper: get repository based on queryRunner or default
  async _getRepository(entity, queryRunner = null) {
    if (queryRunner) {
      return queryRunner.manager.getRepository(entity);
    }
    const { AppointmentEntity } = require("../entities/appointment.entity");
    const { ClientEntity } = require("../../clients/entities/client.entity");
    const { PetEntity } = require("../../pets/entities/pet.entity");
    const { ProductEntity } = require("../../products/entities/product.entity");
    const repos = await this.getRepositories();
    switch (entity) {
      case AppointmentEntity:
        return repos.appointment;
      case ClientEntity:
        return repos.client;
      case PetEntity:
        return repos.pet;
      case ProductEntity:
        return repos.product;
      default:
        throw new Error("Unknown entity");
    }
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
  // CREATE
  // ------------------------------------------------------------------
  async create(data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const { AppointmentEntity } = require("../entities/appointment.entity");
    const { ClientEntity } = require("../../clients/entities/client.entity");
    const { PetEntity } = require("../../pets/entities/pet.entity");
    const { ProductEntity } = require("../../products/entities/product.entity");

    if (!data.clientId) throw new Error("Client ID is required");
    if (!data.serviceType) throw new Error("Service type is required");
    if (!data.appointmentDate) throw new Error("Appointment date is required");

    const clientRepo = await this._getRepository(ClientEntity, queryRunner);
    const petRepo = await this._getRepository(PetEntity, queryRunner);
    const productRepo = await this._getRepository(ProductEntity, queryRunner);
    const appointmentRepo = await this._getRepository(
      AppointmentEntity,
      queryRunner
    );

    const client = await clientRepo.findOne({
      where: { id: data.clientId, is_deleted: false },
    });
    if (!client) throw new Error(`Client with ID ${data.clientId} not found`);

    let pet = null;
    if (data.petId) {
      pet = await petRepo.findOne({
        where: { id: data.petId, is_deleted: false },
      });
      if (!pet) throw new Error(`Pet with ID ${data.petId} not found`);
      if (pet.client_id !== data.clientId)
        throw new Error("Pet does not belong to the client");
    }

    let product = null;
    if (data.productId) {
      product = await productRepo.findOne({
        where: { id: data.productId, is_deleted: false },
      });
      if (!product)
        throw new Error(`Product with ID ${data.productId} not found`);
    }

    const appointment = appointmentRepo.create({
      client_id: data.clientId,
      pet_id: data.petId || null,
      product_id: data.productId || null,
      service_type: data.serviceType,
      appointment_date: data.appointmentDate,
      status: data.status || "Scheduled",
      notes: data.notes || null,
    });

    const saved = await this._save(appointmentRepo, appointment, queryRunner, user);
    const savedWithRelations = await appointmentRepo.findOne({
      where: { id: saved.id },
      relations: ["client", "pet", "product"],
    });

    await auditLogger.logCreate(
      "Appointment",
      saved.id,
      savedWithRelations,
      user.id
    );
    return savedWithRelations;
  }

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  async update(id, data, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const { AppointmentEntity } = require("../entities/appointment.entity");
    const { ClientEntity } = require("../../clients/entities/client.entity");
    const { PetEntity } = require("../../pets/entities/pet.entity");
    const { ProductEntity } = require("../../products/entities/product.entity");

    const appointmentRepo = await this._getRepository(
      AppointmentEntity,
      queryRunner
    );
    const clientRepo = await this._getRepository(ClientEntity, queryRunner);
    const petRepo = await this._getRepository(PetEntity, queryRunner);
    const productRepo = await this._getRepository(ProductEntity, queryRunner);

    const existing = await appointmentRepo.findOne({
      where: { id, is_deleted: false },
      relations: ["client", "pet", "product"],
    });
    if (!existing) throw new Error(`Appointment with ID ${id} not found`);
    const oldData = { ...existing };

    if (data.serviceType) existing.service_type = data.serviceType;
    if (data.appointmentDate) existing.appointment_date = data.appointmentDate;
    if (data.status) existing.status = data.status;
    if (data.notes !== undefined) existing.notes = data.notes;

    if (data.clientId !== undefined) {
      if (!data.clientId) {
        existing.client = null;
        existing.client_id = null;
      } else {
        const client = await clientRepo.findOne({
          where: { id: data.clientId, is_deleted: false },
        });
        if (!client)
          throw new Error(`Client with ID ${data.clientId} not found`);
        existing.client = client;
        existing.client_id = client.id;
      }
    }

    if (data.petId !== undefined) {
      if (!data.petId) {
        existing.pet = null;
        existing.pet_id = null;
      } else {
        const pet = await petRepo.findOne({
          where: { id: data.petId, is_deleted: false },
        });
        if (!pet) throw new Error(`Pet with ID ${data.petId} not found`);
        existing.pet = pet;
        existing.pet_id = pet.id;
      }
    }

    if (data.productId !== undefined) {
      if (!data.productId) {
        existing.product = null;
        existing.product_id = null;
      } else {
        const product = await productRepo.findOne({
          where: { id: data.productId, is_deleted: false },
        });
        if (!product)
          throw new Error(`Product with ID ${data.productId} not found`);
        existing.product = product;
        existing.product_id = product.id;
      }
    }

    if (
      existing.client &&
      existing.pet &&
      existing.pet.client_id !== existing.client.id
    ) {
      throw new Error("Pet does not belong to the selected client");
    }

    const updated = await this._update(appointmentRepo, existing, queryRunner, user);
    const updatedWithRelations = await appointmentRepo.findOne({
      where: { id: updated.id },
      relations: ["client", "pet", "product"],
    });

    await auditLogger.logUpdate(
      "Appointment",
      id,
      oldData,
      updatedWithRelations,
      user.id
    );
    return updatedWithRelations;
  }

  // ------------------------------------------------------------------
  // UPDATE STATUS (reuse update)
  // ------------------------------------------------------------------
  async updateStatus(id, status, user, queryRunner = null) {
    return await this.update(id, { status }, user, queryRunner);
  }

  // ------------------------------------------------------------------
  // DELETE (soft delete)
  // ------------------------------------------------------------------
  async delete(id, user, queryRunner = null) {
    const auditLogger = require("../../../common/utils/auditLogger");
    const { AppointmentEntity } = require("../entities/appointment.entity");

    const appointmentRepo = await this._getRepository(
      AppointmentEntity,
      queryRunner
    );
    const appointment = await appointmentRepo.findOne({
      where: { id, is_deleted: false },
    });
    if (!appointment) throw new Error(`Appointment with ID ${id} not found`);
    if (appointment.is_deleted)
      throw new Error(`Appointment #${id} is already deleted`);

    const oldData = { ...appointment };
    appointment.is_deleted = true;
    appointment.updated_at = new Date();

    const updated = await this._update(
      appointmentRepo,
      appointment,
      queryRunner,
      user
    );
    await auditLogger.logDelete("Appointment", id, oldData, user.id);
    return updated;
  }

  // ------------------------------------------------------------------
  // FIND BY ID (no transaction needed)
  // ------------------------------------------------------------------
  async findById(id) {
    const { appointment: repo } = await this.getRepositories();
    const appointment = await repo.findOne({
      where: { id, is_deleted: false },
      relations: ["client", "pet", "product"],
    });
    if (!appointment) throw new Error(`Appointment with ID ${id} not found`);
    return appointment;
  }

  // ------------------------------------------------------------------
  // FIND ALL WITH PAGINATION
  // ------------------------------------------------------------------
  async findAll(options = {}) {
    const { appointment: repo } = await this.getRepositories();
    const {
      page = 1,
      limit = 10,
      clientId,
      status,
      fromDate,
      toDate,
      petId,
      sortBy = "appointment_date",
      sortOrder = "DESC",
    } = options;

    const qb = repo
      .createQueryBuilder("appointment")
      .leftJoinAndSelect("appointment.client", "client")
      .leftJoinAndSelect("appointment.pet", "pet")
      .leftJoinAndSelect("appointment.product", "product")
      .where("appointment.is_deleted = :deleted", { deleted: false });

    if (status) qb.andWhere("appointment.status = :status", { status });
    if (clientId)
      qb.andWhere("appointment.client_id = :clientId", { clientId });
    if (petId) qb.andWhere("appointment.pet_id = :petId", { petId });
    if (fromDate)
      qb.andWhere("appointment.appointment_date >= :fromDate", { fromDate });
    if (toDate)
      qb.andWhere("appointment.appointment_date <= :toDate", { toDate });

    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
    qb.orderBy(`appointment.${sortBy}`, order);

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
  // STATISTICS
  // ------------------------------------------------------------------
  async getStatistics() {
    const { appointment: repo } = await this.getRepositories();
    const total = await repo.count({ where: { is_deleted: false } });
    const scheduled = await repo.count({
      where: { status: "Scheduled", is_deleted: false },
    });
    const confirmed = await repo.count({
      where: { status: "Confirmed", is_deleted: false },
    });
    const completed = await repo.count({
      where: { status: "Completed", is_deleted: false },
    });
    const cancelled = await repo.count({
      where: { status: "Cancelled", is_deleted: false },
    });
    const noShow = await repo.count({
      where: { status: "NoShow", is_deleted: false },
    });
    return { total, scheduled, confirmed, completed, cancelled, noShow };
  }
}

const appointmentService = new AppointmentService();
module.exports = appointmentService;
