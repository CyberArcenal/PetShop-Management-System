// src/modules/clients/routes/base.routes.js
const { Router } = require('express');
const ClientController = require('../controllers/client.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();

// Lahat ng client routes ay nangangailangan ng authentication (gaya ng nasa app.js)
router.get('/', authenticateToken, ClientController.getAll);
router.get('/:id', authenticateToken, ClientController.getById);
router.post('/', authenticateToken, ClientController.create);
router.put('/:id', authenticateToken, ClientController.update);
router.delete('/:id', authenticateToken, ClientController.delete);

module.exports = router;