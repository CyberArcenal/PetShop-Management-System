const appointmentService = require('../services/appointment.service');

module.exports = async (params, queryRunner = null, user = 'system') => {
  try {
    // Basic validation
    if (!params.clientId) throw new Error('Client ID is required');
    if (!params.serviceType) throw new Error('Service type is required');
    if (!params.appointmentDate) throw new Error('Appointment date is required');

    const appointment = await appointmentService.create(params, user);
    return { status: true, message: 'Appointment created', data: appointment };
  } catch (err) {
    return { status: false, message: err.message, data: null };
  }
};