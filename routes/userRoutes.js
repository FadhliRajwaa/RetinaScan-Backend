import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { 
  getProfile, 
  updateProfile, 
  getAllPatients, 
  getPatientById, 
  createPatient, 
  updatePatient, 
  deletePatient,
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile, 
  changePassword,
  requestPasswordReset,
  resetPassword,
  updateNotificationSettings,
  getNotificationSettings
} from '../controllers/userController.js';

const router = express.Router();

// Endpoint profil pengguna
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

// Endpoint manajemen pasien
router.get('/patients', authMiddleware, getAllPatients);
router.get('/patients/:id', authMiddleware, getPatientById);
router.post('/patients', authMiddleware, createPatient);
router.put('/patients/:id', authMiddleware, updatePatient);
router.delete('/patients/:id', authMiddleware, deletePatient);

// Routes untuk pengaturan notifikasi
router.get('/notification-settings', authMiddleware, getNotificationSettings);
router.put('/notification-settings', authMiddleware, updateNotificationSettings);

export default router;