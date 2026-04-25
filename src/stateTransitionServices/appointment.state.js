// stateTransitionServices/appointment.state.js
const { logger } = require("../common/utils/logger");
const { AppDataSource } = require("../db/datasource");

class AppointmentStateTransition {
  constructor() {
    this.clientRepo = AppDataSource.getRepository("Client");
    this.petRepo = AppDataSource.getRepository("Pet");
    this.saleRepo = AppDataSource.getRepository("Sale");
    this.saleItemRepo = AppDataSource.getRepository("SaleItem");
    this.notifyLogRepo = AppDataSource.getRepository("NotifyLog");
    this.appointmentRepo = AppDataSource.getRepository("Appointment");
  }

  /**
   * Kapag nag-confirm ng appointment (Scheduled → Confirmed)
   * @param {{ id: any; client_id: any; }} appointment
   */
  async onConfirmed(appointment, user = null) {
    logger.info(`[AppointmentState] Confirming appointment ${appointment.id}`);

    const client = await this.clientRepo.findOneBy({
      id: appointment.client_id,
    });
    if (!client) {
      logger.warn(`Client not found for appointment ${appointment.id}`);
      return;
    }

    // 1. Magpadala ng confirmation email
    await this._sendEmail(client, appointment, "confirmation");

    // 2. (Optional) Internal notification para sa vet
    // Puwede kang gumawa ng in-app notification dito kung may Notification entity
    logger.info(
      `[AppointmentState] Vet notified internally for appointment ${appointment.id}`
    );
  }

  /**
   * Kapag natapos ang appointment (Confirmed → Completed)
   * @param {{ id: any; client_id: any; }} appointment
   */
  async onCompleted(appointment, user = null) {
    logger.info(`[AppointmentState] Completing appointment ${appointment.id}`);

    const client = await this.clientRepo.findOneBy({
      id: appointment.client_id,
    });
    if (!client) return;

    // 1. Gumawa ng Sale (consultation fee)
    const sale = await this._createConsultationSale(appointment, client);
    if (!sale) {
      logger.error(`Failed to create sale for appointment ${appointment.id}`);
      return;
    }

    // 2. I-update ang medical notes ng pet
    await this._updatePetMedicalNotes(appointment);

    // 3. Magpadala ng follow‑up email (survey o paalala)
    await this._sendEmail(client, appointment, "followup");

    logger.info(
      `[AppointmentState] Completed appointment ${appointment.id}, sale created: ${sale.invoice_number}`
    );
  }

  /**
   * Kapag kinansela ang appointment (Scheduled/Confirmed → Cancelled)
   * @param {{ id: any; client_id: any; notes: any; }} appointment
   * @param {string} oldStatus
   */
  async onCancelled(appointment, oldStatus, user = null) {
    logger.info(
      `[AppointmentState] Cancelling appointment ${appointment.id} from ${oldStatus}`
    );

    const client = await this.clientRepo.findOneBy({
      id: appointment.client_id,
    });
    if (!client) return;

    // 1. Magpadala ng cancellation notice
    await this._sendEmail(client, appointment, "cancellation");

    // 2. Maningil ng cancellation fee kung late cancellation
    const isLate = this._isLateCancellation(appointment);
    if (oldStatus === "Confirmed" && isLate) {
      await this._createCancellationFeeSale(appointment, client);
      logger.info(
        `Late cancellation fee applied for appointment ${appointment.id}`
      );
    }

    // 3. I-log ang dahilan kung nasa appointment.notes
    if (appointment.notes) {
      logger.info(`Cancellation reason: ${appointment.notes}`);
    }
  }

  /**
   * Kapag hindi dumating ang client (Confirmed → NoShow)
   * @param {{ id: any; client_id: any; }} appointment
   */
  async onNoShow(appointment, user = null) {
    logger.info(`[AppointmentState] No-show for appointment ${appointment.id}`);

    const client = await this.clientRepo.findOneBy({
      id: appointment.client_id,
    });
    if (!client) return;

    // 1. Maningil ng no‑show fee
    await this._createNoShowFeeSale(appointment, client);

    // 2. Magpadala ng no‑show notification
    await this._sendEmail(client, appointment, "noshow");

    // 3. I-update ang client statistics (kung may no_show_count column)
    // Puwede mong idagdag ito sa Client entity sa hinaharap
    logger.info(
      `No-show recorded for client ${client.id} on appointment ${appointment.id}`
    );
  }

  // ================================
  // PRIVATE HELPERS
  // ================================

  /**
   * @param {import("typeorm").ObjectLiteral} client
   * @param {{ id: any; }} appointment
   * @param {string} type
   */
  async _sendEmail(client, appointment, type) {
    if (!client.email) {
      logger.warn(`No email for client ${client.id}, skipping ${type} email`);
      return;
    }

    const subject = this._getEmailSubject(type, appointment);
    const html = this._buildEmailHtml(type, client, appointment);

    try {
      const log = this.notifyLogRepo.create({
        channel: "email",
        recipient_email: client.email,
        subject: subject,
        payload: html,
        status: "queued",
        created_by: "system",
        metadata: {
          appointment_id: appointment.id,
          email_type: type,
        },
      });
      await this.notifyLogRepo.save(log);
      logger.info(
        `NotifyLog created for ${type} email, appointment ${appointment.id}`
      );
    } catch (err) {
      logger.error(`Failed to create NotifyLog for ${type} email`, err);
    }
  }

  /**
   * @param {any} type
   * @param {{ service_type: any; appointment_date: any; }} appointment
   */
  _getEmailSubject(type, appointment) {
    switch (type) {
      case "confirmation":
        return `Appointment Confirmed – ${
          appointment.service_type
        } on ${this._formatDate(appointment.appointment_date)}`;
      case "cancellation":
        return `Appointment Cancelled – ${appointment.service_type}`;
      case "followup":
        return `How was your visit? Feedback for ${appointment.service_type}`;
      case "noshow":
        return `You missed your appointment – No‑show fee applied`;
      default:
        return `Update regarding your appointment`;
    }
  }

  /**
   * @param {string} type
   * @param {{ name: string; }} client
   * @param {{ appointment_date: any; service_type: any; }} appointment
   */
  _buildEmailHtml(type, client, appointment) {
    const clientName = client.name || "Valued Client";
    const dateStr = this._formatDate(appointment.appointment_date);
    const service = appointment.service_type;

    if (type === "confirmation") {
      return `
        <h2>Appointment Confirmed</h2>
        <p>Dear ${clientName},</p>
        <p>Your ${service} appointment on <strong>${dateStr}</strong> is confirmed.</p>
        <p>Please arrive 10 minutes early.</p>
        <p>Thank you!</p>
      `;
    } else if (type === "cancellation") {
      return `
        <h2>Appointment Cancelled</h2>
        <p>Dear ${clientName},</p>
        <p>Your ${service} appointment on ${dateStr} has been cancelled.</p>
        <p>If this was a mistake, please contact us.</p>
      `;
    } else if (type === "followup") {
      return `
        <h2>We value your feedback</h2>
        <p>Dear ${clientName},</p>
        <p>How was your recent ${service} appointment? Please take a moment to rate us.</p>
        <p><a href="#">Click here to give feedback</a></p>
      `;
    } else if (type === "noshow") {
      return `
        <h2>You missed your appointment</h2>
        <p>Dear ${clientName},</p>
        <p>You did not show up for your ${service} appointment on ${dateStr}. A no‑show fee of ₱350 has been added to your account.</p>
        <p>Please contact us to reschedule.</p>
      `;
    }
    return "";
  }

  /**
   * @param {{ service_type: string; id: any; }} appointment
   * @param {import("typeorm").ObjectLiteral} client
   */
  async _createConsultationSale(appointment, client) {
    // Kunin ang presyo ng consultation base sa service_type (dummy logic)
    let amount = 500.0;
    if (appointment.service_type === "Grooming") amount = 400;
    if (appointment.service_type === "VetCheck") amount = 600;
    if (appointment.service_type === "Training") amount = 800;
    if (appointment.service_type === "Boarding") amount = 1200;

    const invoiceNumber = `INV-${Date.now()}-${appointment.id}`;
    const sale = this.saleRepo.create({
      client_id: client.id,
      appointment_id: appointment.id,
      invoice_number: invoiceNumber,
      total_amount: amount,
      status: "pending",
      payment_method: null,
      payment_date: null,
    });
    await this.saleRepo.save(sale);

    // Gumawa ng SaleItem para sa consultation
    const saleItem = this.saleItemRepo.create({
      sale_id: sale.id,
      product_id: null, // puwedeng i-link sa isang generic product na "Consultation Fee"
      quantity: 1,
      unit_price: amount,
      total_price: amount,
    });
    await this.saleItemRepo.save(saleItem);

    return sale;
  }

  /**
   * @param {{ id: any; }} appointment
   * @param {import("typeorm").ObjectLiteral} client
   */
  async _createCancellationFeeSale(appointment, client) {
    const feeAmount = 250.0;
    const invoiceNumber = `CNCL-${Date.now()}-${appointment.id}`;
    const sale = this.saleRepo.create({
      client_id: client.id,
      appointment_id: appointment.id,
      invoice_number: invoiceNumber,
      total_amount: feeAmount,
      status: "pending",
    });
    await this.saleRepo.save(sale);

    const saleItem = this.saleItemRepo.create({
      sale_id: sale.id,
      product_id: null,
      quantity: 1,
      unit_price: feeAmount,
      total_price: feeAmount,
    });
    await this.saleItemRepo.save(saleItem);
  }

  /**
   * @param {{ id: any; }} appointment
   * @param {import("typeorm").ObjectLiteral} client
   */
  async _createNoShowFeeSale(appointment, client) {
    const feeAmount = 350.0;
    const invoiceNumber = `NOSHOW-${Date.now()}-${appointment.id}`;
    const sale = this.saleRepo.create({
      client_id: client.id,
      appointment_id: appointment.id,
      invoice_number: invoiceNumber,
      total_amount: feeAmount,
      status: "pending",
    });
    await this.saleRepo.save(sale);

    const saleItem = this.saleItemRepo.create({
      sale_id: sale.id,
      product_id: null,
      quantity: 1,
      unit_price: feeAmount,
      total_price: feeAmount,
    });
    await this.saleItemRepo.save(saleItem);
  }

  /**
   * @param {{ pet_id: any; id: any; service_type: any; notes: any; }} appointment
   */
  async _updatePetMedicalNotes(appointment) {
    if (!appointment.pet_id) return;
    const pet = await this.petRepo.findOneBy({ id: appointment.pet_id });
    if (!pet) return;

    const note = `[${new Date().toISOString()}] Appointment ${
      appointment.id
    } (${appointment.service_type}) completed. Notes: ${
      appointment.notes || "No details"
    }`;
    const currentNotes = pet.medical_notes || "";
    pet.medical_notes = currentNotes ? currentNotes + "\n" + note : note;
    await this.petRepo.save(pet);
    logger.info(`Updated medical notes for pet ${pet.id}`);
  }

  /**
   * @param {{ appointment_date: string | number | Date; }} appointment
   */
  _isLateCancellation(appointment) {
    const now = new Date();
    const appDate = new Date(appointment.appointment_date);
    const hoursDiff = (appDate - now) / (1000 * 60 * 60);
    return hoursDiff < 24; // kung less than 24 hours bago ang appointment
  }

  /**
   * @param {string | number | Date} date
   */
  _formatDate(date) {
    if (!date) return "TBD";
    const d = new Date(date);
    return d.toLocaleString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

module.exports = { AppointmentStateTransition };
