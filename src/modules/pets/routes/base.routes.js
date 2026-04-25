// src/modules/pets/routes/base.routes.js
const { Router } = require('express');
const PetController = require('../controllers/pet.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');

const router = Router();

// Lahat ng pet routes ay nangangailangan ng authentication (gaya ng nasa app.js)
router.get('/', authenticateToken, PetController.getAll);
router.get('/stats', authenticateToken, PetController.getStats);
router.get('/:id', authenticateToken, PetController.getById);
router.post('/', authenticateToken, PetController.create);
router.put('/:id', authenticateToken, PetController.update);
router.delete('/:id', authenticateToken, PetController.delete);

module.exports = router;