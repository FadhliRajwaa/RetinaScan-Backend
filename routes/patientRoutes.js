import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { 
  getAllPatients, 
  getPatientById, 
  createPatient, 
  updatePatient, 
  deletePatient 
} from '../controllers/patientController.js';

const router = express.Router();

// Endpoint manajemen pasien
router.get('/', authMiddleware, getAllPatients);
router.get('/:id', authMiddleware, getPatientById);
router.post('/', authMiddleware, createPatient);
router.put('/:id', authMiddleware, updatePatient);
router.delete('/:id', authMiddleware, deletePatient);

export default router; 