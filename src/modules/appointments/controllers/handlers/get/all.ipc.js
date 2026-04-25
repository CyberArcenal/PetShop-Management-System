const appointmentService = require('../../../services/appointment.service');

module.exports = async (params, queryRunner = null, user = 'system') => {
  try {
    const {
      page = 1,
      limit = 10,
      clientId,
      status,
      fromDate,
      toDate,
      petId,
      sortBy = 'appointment_date',
      sortOrder = 'DESC',
    } = params;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      clientId: clientId ? parseInt(clientId) : undefined,
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      petId: petId ? parseInt(petId) : undefined,
      sortBy,
      sortOrder,
    };

    const appointments = await appointmentService.findAll(options);
    return { status: true, message: 'Appointments retrieved', data: appointments };
  } catch (err) {
    return { status: false, message: err.message, data: null };
  }
};