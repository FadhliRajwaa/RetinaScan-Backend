import express from 'express';
import axios from 'axios'; // Tambahkan import axios
import { uploadImage, getUserAnalyses, getAnalysisById, getFlaskApiStatus, deleteAnalysis, testFlaskConnection } from '../controllers/analysisController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/upload', authMiddleware, upload.single('image'), uploadImage);
router.get('/history', authMiddleware, getUserAnalyses);
router.get('/api-status/flask', authMiddleware, getFlaskApiStatus);
router.get('/test-flask-connection', authMiddleware, testFlaskConnection);
router.get('/flask-info', authMiddleware, async (req, res) => {
  try {
    const FLASK_API_URL = process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com';
    const FLASK_API_INFO_URL = `${FLASK_API_URL}/`;
    
    console.log(`Mengambil info dari Flask API: ${FLASK_API_INFO_URL}`);
    
    const response = await axios.get(FLASK_API_INFO_URL, {
      timeout: 10000
    });
    
    res.json({
      success: true,
      flaskApiUrl: FLASK_API_URL,
      info: response.data
    });
  } catch (error) {
    console.error('Error saat mengambil info Flask API:', error);
    res.status(503).json({
      success: false,
      error: error.message,
      flaskApiUrl: process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com'
    });
  }
});
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    // Cari analisis terbaru untuk user yang sedang login
    const latestAnalysis = await RetinaAnalysis.findOne({ 
      userId: req.user.id,
      isSimulation: false // Pastikan hanya mengambil hasil analisis asli, bukan simulasi
    })
    .populate({
      path: 'patientId',
      select: 'name fullName gender age'
    })
    .sort({ createdAt: -1 });
    
    if (!latestAnalysis) {
      return res.status(404).json({ message: 'Belum ada analisis yang dilakukan' });
    }
    
    // Format hasil untuk frontend
    const result = {
      severity: latestAnalysis.severity,
      severityLevel: latestAnalysis.severityLevel,
      confidence: latestAnalysis.confidence,
      recommendation: latestAnalysis.notes,
      analysisId: latestAnalysis._id,
      patientId: latestAnalysis.patientId,
      patientName: latestAnalysis.patientId ? latestAnalysis.patientId.fullName || latestAnalysis.patientId.name : 'Unknown',
      imageData: latestAnalysis.imageData,
      createdAt: latestAnalysis.createdAt,
      isSimulation: false // Pastikan selalu mengembalikan false
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error saat mengambil analisis terbaru:', error);
    res.status(500).json({ message: 'Gagal mengambil analisis terbaru', error: error.message });
  }
});
router.get('/:id', authMiddleware, getAnalysisById);
router.delete('/:id', authMiddleware, deleteAnalysis);

export default router;