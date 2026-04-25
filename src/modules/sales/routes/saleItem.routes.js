// src/modules/sales/routes/saleItem.routes.js
const { Router } = require('express');
const SaleItemController = require('../controllers/saleItem.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();
router.use(authenticateToken);

router.get('/by-sale/:saleId', SaleItemController.getBySaleId);
router.get('/:id', SaleItemController.getById);
router.post('/', SaleItemController.addItem);
router.put('/:id', SaleItemController.updateItem);
router.delete('/:id', SaleItemController.removeItem);

module.exports = router;