const appointmentService = require('../../../services/appointment.service');

module.exports = async (params, queryRunner = null, user = 'system') => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) throw new Error('Invalid appointment ID');
    const appointment = await appointmentService.findById(id);
    return { status: true, message: 'Appointment found', data: appointment };
  } catch (err) {
    return { status: false, message: err.message, data: null };
  }
};