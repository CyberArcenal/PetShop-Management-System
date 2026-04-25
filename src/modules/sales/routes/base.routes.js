// src/modules/sales/routes/base.routes.js
const { Router } = require('express');
const SaleController = require('../controllers/sale.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authenticateToken);

router.get('/', SaleController.getAll);
router.get('/stats', SaleController.getStats);
router.get('/:id', SaleController.getById);
router.post('/', SaleController.create);
router.put('/:id', SaleController.update);
router.patch('/:id/status', SaleController.updateStatus);
router.delete('/:id', SaleController.delete);

module.exports = router;