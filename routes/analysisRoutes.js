import express from 'express';
import axios from 'axios';
import { processRetinaImage, getFlaskApiStatus, testFlaskConnection } from '../controllers/analysisController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/upload', authMiddleware, upload.single('image'), processRetinaImage);
router.get('/api-status/flask', authMiddleware, getFlaskApiStatus);
router.get('/test-flask-connection', authMiddleware, testFlaskConnection);
router.get('/flask-info', authMiddleware, async (req, res) => {
  try {
    const FLASK_API_URL = process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com';
    const FLASK_API_INFO_URL = `${FLASK_API_URL}/`;
    
    console.log(`Mengambil info dari Flask API: ${FLASK_API_INFO_URL}`);
    
    const axiosConfig = {
      timeout: 20000,
      retry: 3,
      retryDelay: 1000
    };
    
    let currentRetry = 0;
    let lastError = null;
    
    while (currentRetry < axiosConfig.retry) {
      try {
        const response = await axios.get(FLASK_API_INFO_URL, {
          timeout: axiosConfig.timeout
        });
        
        return res.json({
          success: true,
          flaskApiUrl: FLASK_API_URL,
          info: response.data
        });
      } catch (error) {
        lastError = error;
        console.log(`Retry ${currentRetry + 1}/${axiosConfig.retry} gagal: ${error.message}`);
        currentRetry++;
        
        if (currentRetry < axiosConfig.retry) {
          await new Promise(resolve => setTimeout(resolve, axiosConfig.retryDelay));
        }
      }
    }
    
    console.error('Error saat mengambil info Flask API setelah beberapa percobaan:', lastError);
    res.status(503).json({
      success: false,
      error: lastError.message,
      flaskApiUrl: FLASK_API_URL
    });
  } catch (error) {
    console.error('Error tidak terduga saat mengambil info Flask API:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      flaskApiUrl: process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com'
    });
  }
});
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    const latestAnalysis = await RetinaAnalysis.findOne({ 
      doctorId: req.user.id
    })
    .populate({
      path: 'patientId',
      select: 'name fullName gender age'
    })
    .sort({ createdAt: -1 });
    
    if (!latestAnalysis) {
      return res.status(404).json({ message: 'Belum ada analisis yang dilakukan' });
    }
    
    const result = {
      classification: latestAnalysis.results.classification,
      confidence: latestAnalysis.results.confidence,
      recommendation: latestAnalysis.recommendation,
      analysisId: latestAnalysis._id,
      patientId: latestAnalysis.patientId,
      patientName: latestAnalysis.patientId ? latestAnalysis.patientId.fullName || latestAnalysis.patientId.name : 'Unknown',
      imageUrl: `/uploads/${latestAnalysis.imageDetails.filename}`,
      createdAt: latestAnalysis.createdAt,
      isSimulation: latestAnalysis.results.isSimulation || false
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error saat mengambil analisis terbaru:', error);
    res.status(500).json({ message: 'Gagal mengambil analisis terbaru', error: error.message });
  }
});
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    const analysis = await RetinaAnalysis.findOne({
      _id: req.params.id,
      doctorId: req.user.id
    }).populate({
      path: 'patientId',
      select: 'name fullName gender age dateOfBirth'
    });
    
    if (!analysis) {
      return res.status(404).json({ message: 'Analisis tidak ditemukan' });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error saat mengambil detail analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil detail analisis', error: error.message });
  }
});
router.get('/', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    const analyses = await RetinaAnalysis.find({
      doctorId: req.user.id
    })
    .populate({
      path: 'patientId',
      select: 'name fullName gender age'
    })
    .sort({ createdAt: -1 });
    
    res.json(analyses);
  } catch (error) {
    console.error('Error saat mengambil daftar analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil daftar analisis', error: error.message });
  }
});
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    const analysis = await RetinaAnalysis.findOneAndDelete({
      _id: req.params.id,
      doctorId: req.user.id
    });
    
    if (!analysis) {
      return res.status(404).json({ message: 'Analisis tidak ditemukan' });
    }
    
    res.json({ message: 'Analisis berhasil dihapus' });
  } catch (error) {
    console.error('Error saat menghapus analisis:', error);
    res.status(500).json({ message: 'Gagal menghapus analisis', error: error.message });
  }
});

// Endpoint untuk menguji semua URL Flask API potensial
router.get('/debug-flask-urls', authMiddleware, async (req, res) => {
  try {
    // Daftar semua URL potensial
    const urls = [
      process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com',
      'https://retinopathy-api.onrender.com',
      'https://retinascan-flask-api.onrender.com',
      'http://localhost:5001',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://192.168.100.7:5000'
    ];
    
    const results = [];
    
    // Uji setiap URL
    for (const baseUrl of urls) {
      const infoUrl = `${baseUrl}/`;
      
      try {
        console.log(`Testing connection to ${infoUrl}...`);
        const startTime = Date.now();
        const response = await axios.get(infoUrl, { timeout: 10000 });
        const endTime = Date.now();
        
        results.push({
          url: baseUrl,
          status: 'success',
          responseTime: endTime - startTime,
          data: response.data,
          statusCode: response.status
        });
        
        console.log(`✅ Connection to ${infoUrl} successful`);
      } catch (error) {
        results.push({
          url: baseUrl,
          status: 'error',
          error: error.message,
          code: error.code,
          statusCode: error.response?.status
        });
        
        console.log(`❌ Connection to ${infoUrl} failed: ${error.message}`);
      }
    }
    
    // Return hasil pengujian
    res.json({
      results,
      env: {
        FLASK_API_URL: process.env.FLASK_API_URL || '(not set)'
      }
    });
  } catch (error) {
    console.error('Error testing Flask API URLs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;