const appointmentService = require('../../services/appointment.service');

module.exports = async (params, queryRunner = null, user = 'system') => {
  try {
    const id = parseInt(params.id);
    if (isNaN(id) || id <= 0) throw new Error('Invalid appointment ID');
    const { id: _, ...updateData } = params;
    const updated = await appointmentService.update(id, updateData, user, queryRunner);
    return { status: true, message: 'Appointment updated', data: updated };
  } catch (err) {
    return { status: false, message: err.message, data: null };
  }
};