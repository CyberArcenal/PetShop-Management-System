const appointmentService = require('../services/appointment.service');

module.exports = async (params, queryRunner = null, user = 'system') => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) throw new Error('Invalid appointment ID');
    const deleted = await appointmentService.delete(id, user);
    return { status: true, message: 'Appointment deleted', data: deleted };
  } catch (err) {
    return { status: false, message: err.message, data: null };
  }
};