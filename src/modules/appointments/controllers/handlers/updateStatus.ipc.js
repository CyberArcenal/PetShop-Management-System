const appointmentService = require('../services/appointment.service');

module.exports = async (params, queryRunner = null, user = 'system') => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) throw new Error('Invalid appointment ID');
    if (!params.status) throw new Error('Status is required');
    const updated = await appointmentService.updateStatus(id, params.status, user, queryRunner);
    return { status: true, message: 'Appointment status updated', data: updated };
  } catch (err) {
    return { status: false, message: err.message, data: null };
  }
};