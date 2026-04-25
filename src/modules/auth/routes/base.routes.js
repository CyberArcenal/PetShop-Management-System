const { Router } = require('express');
const UserController = require('../controllers/user.controller');
const AuthController = require('../controllers/auth.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');
const router = Router();



router.get('/', authenticateToken, UserController.getAll);
router.get('/:id', authenticateToken, UserController.getById);
router.post('/', authenticateToken, UserController.create);
router.put('/:id', authenticateToken, UserController.update);
router.delete('/:id', authenticateToken, UserController.delete);

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);
router.post('/change-password', AuthController.changePassword); // protected route

module.exports = router;