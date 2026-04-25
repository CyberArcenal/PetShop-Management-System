const { Router } = require('express');
const AppointmentController = require('../controllers/index.controller');

const router = Router();

router.get('/', AppointmentController.getAll);
router.get('/:id', AppointmentController.getById);
router.post('/', AppointmentController.create);
router.put('/:id', AppointmentController.update);
router.patch('/:id/status', AppointmentController.updateStatus);
router.delete('/:id', AppointmentController.delete);

module.exports = router;