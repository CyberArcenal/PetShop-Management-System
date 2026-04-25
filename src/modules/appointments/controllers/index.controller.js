// src/modules/appointments/controllers/index.controller.js
const { sendResponse } = require("../../shared/utils/response.util");
const appointmentService = require("../services/appointment.service");
const {
  withTransaction,
} = require("../../../common/utils/dbUtils/transactionWrapper"); // adjust path

const toInt = (value) =>
  value !== undefined ? parseInt(value, 10) : undefined;
const getErrorStatus = (err) => {
  if (err.message.includes("not found")) return 404;
  if (err.message.includes("required") || err.message.includes("belong to"))
    return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  clientId: toInt(query.clientId),
  status: query.status,
  fromDate: query.fromDate,
  toDate: query.toDate,
  petId: toInt(query.petId),
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class AppointmentController {
  // GET /api/v1/appointments
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const paginatedResult = await appointmentService.findAll(options);
      sendResponse(res, 200, paginatedResult, "Appointments retrieved");
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/appointments/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error("Invalid appointment ID");
      const data = await appointmentService.findById(id);
      sendResponse(res, 200, data, "Appointment found");
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/appointments
  static async create(req, res) {
    try {
      const { clientId, serviceType, appointmentDate } = req.body;
      if (!clientId) throw new Error("Client ID is required");
      if (!serviceType) throw new Error("Service type is required");
      if (!appointmentDate) throw new Error("Appointment date is required");

      const user = req.user; // full user object from JWT
      const data = await withTransaction(
        async (queryRunner) =>
          await appointmentService.create(req.body, user, queryRunner),
        { name: "CreateAppointment" }
      );
      sendResponse(res, 201, data, "Appointment created");
    } catch (err) {
      const status = err.message.includes("not found") ? 404 : 400;
      sendResponse(res, status, null, err.message);
    }
  }

  // PUT /api/v1/appointments/:id
  static async update(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error("Invalid appointment ID");
      const user = req.user;
      const data = await withTransaction(
        async (queryRunner) =>
          await appointmentService.update(id, req.body, user, queryRunner),
        { name: "UpdateAppointment" }
      );
      sendResponse(res, 200, data, "Appointment updated");
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // PATCH /api/v1/appointments/:id/status
  static async updateStatus(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error("Invalid appointment ID");
      const { status } = req.body;
      if (!status) throw new Error("Status is required");
      const user = req.user;
      const data = await withTransaction(
        async (queryRunner) =>
          await appointmentService.updateStatus(id, status, user, queryRunner),
        { name: "UpdateAppointmentStatus" }
      );
      sendResponse(res, 200, data, "Status updated");
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // DELETE /api/v1/appointments/:id
  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error("Invalid appointment ID");
      const user = req.user;
      const data = await withTransaction(
        async (queryRunner) =>
          await appointmentService.delete(id, user, queryRunner),
        { name: "DeleteAppointment" }
      );
      sendResponse(res, 200, data, "Appointment deleted");
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = AppointmentController;
