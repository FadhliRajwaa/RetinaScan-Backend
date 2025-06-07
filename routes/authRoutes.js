import express from 'express';
import { register, login, forgotPassword, resetPassword, verifyToken, changePassword } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify', authMiddleware, verifyToken);
router.post('/change-password', authMiddleware, changePassword);

export default router;