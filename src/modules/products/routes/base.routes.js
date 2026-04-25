// src/modules/products/routes/base.routes.js
const { Router } = require('express');
const ProductController = require('../controllers/product.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(authenticateToken);

router.get('/', ProductController.getAll);
router.get('/low-stock', ProductController.getLowStock);
router.get('/stats', ProductController.getStats);
router.get('/:id', ProductController.getById);
router.post('/', ProductController.create);
router.put('/:id', ProductController.update);
router.delete('/:id', ProductController.delete);
router.post('/:id/add-stock', ProductController.addStock);
router.post('/:id/remove-stock', ProductController.removeStock);

module.exports = router;