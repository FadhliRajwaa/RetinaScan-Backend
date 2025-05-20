import express from 'express';
import { uploadImage, getUserAnalyses, getAnalysisById, getFlaskApiStatus } from '../controllers/analysisController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/upload', authMiddleware, upload.single('image'), uploadImage);
router.get('/history', authMiddleware, getUserAnalyses);
router.get('/api-status/flask', authMiddleware, getFlaskApiStatus);
router.get('/:id', authMiddleware, getAnalysisById);

export default router;