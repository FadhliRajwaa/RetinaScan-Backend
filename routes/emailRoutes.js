import express from 'express';
import { sendResetPasswordEmailHandler } from '../controllers/emailController.js';

const router = express.Router();

router.post('/send-reset-password', sendResetPasswordEmailHandler);

export default router; 