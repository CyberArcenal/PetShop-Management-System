// src/main/db/datasource.js
//@ts-check
const fs = require("fs");
const path = require("path");
const { DataSource } = require("typeorm");
const { getDatabaseConfig } = require("./database");
const { ClientEntity } = require("../modules/clients/entities/client.entity");
const { PetEntity } = require("../modules/pets/entities/pet.entity");
const {
  ReportLogEntity,
} = require("../modules/reports/entities/reportLog.entity");
const { UserEntity } = require("../modules/auth/entities/user.entity");
const {
  AppointmentEntity,
} = require("../modules/appointments/entities/appointment.entity");
const {
  ProductEntity,
} = require("../modules/products/entities/product.entity");
const { SaleEntity } = require("../modules/sales/entities/sale.entity");
const { SaleItemEntity } = require("../modules/sales/entities/saleItem.entity");
const {
  NotificationEntity,
} = require("../modules/notifications/entities/notification.entity");
const {
  NotificationLogEntity,
} = require("../modules/notifications/entities/notificationLog.entity");

// Import Entity constants

const config = getDatabaseConfig();

const entities = [
  ClientEntity,
  PetEntity,
  ProductEntity,
  AppointmentEntity,
  SaleEntity,
  SaleItemEntity,
  UserEntity,
  ReportLogEntity,
  NotificationEntity,
  NotificationLogEntity,
];

const dataSourceOptions = {
  ...config,
  entities,
  migrations: Array.isArray(config.migrations)
    ? config.migrations
    : [config.migrations],
};

// @ts-ignore
const AppDataSource = new DataSource(dataSourceOptions);

module.exports = { AppDataSource };
