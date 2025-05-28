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
    
    // Mapping dari kelas bahasa Inggris ke Indonesia
    const severityMapping = {
      'No DR': 'Tidak ada',
      'Mild': 'Ringan',
      'Moderate': 'Sedang',
      'Severe': 'Berat',
      'Proliferative DR': 'Sangat Berat'
    };
    
    // Mapping untuk severityLevel
    const severityLevelMapping = {
      'Tidak ada': 0,
      'No DR': 0,
      'Ringan': 1,
      'Mild': 1,
      'Sedang': 2,
      'Moderate': 2,
      'Berat': 3,
      'Severe': 3,
      'Sangat Berat': 4,
      'Proliferative DR': 4
    };
    
    // Tentukan severity dalam bahasa Indonesia
    const classification = latestAnalysis.results.classification;
    const severity = severityMapping[classification] || classification;
    
    // Tentukan severityLevel berdasarkan severity
    const severityLevel = severityLevelMapping[classification] || 
                          severityLevelMapping[severity] || 0;
    
    const result = {
      classification: latestAnalysis.results.classification, // Nilai asli
      severity: severity, // Nilai yang sudah diterjemahkan
      severityLevel: severityLevel,
      confidence: latestAnalysis.results.confidence,
      recommendation: latestAnalysis.recommendation,
      notes: latestAnalysis.notes || latestAnalysis.recommendation,
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
router.get('/history', authMiddleware, async (req, res) => {
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
    
    // Mapping dari kelas bahasa Inggris ke Indonesia
    const severityMapping = {
      'No DR': 'Tidak ada',
      'Mild': 'Ringan',
      'Moderate': 'Sedang',
      'Severe': 'Berat',
      'Proliferative DR': 'Sangat Berat'
    };
    
    // Mapping untuk severityLevel
    const severityLevelMapping = {
      'Tidak ada': 0,
      'No DR': 0,
      'Ringan': 1,
      'Mild': 1,
      'Sedang': 2,
      'Moderate': 2,
      'Berat': 3,
      'Severe': 3,
      'Sangat Berat': 4,
      'Proliferative DR': 4
    };
    
    // Map hasil untuk format yang konsisten dengan frontend
    const mappedAnalyses = analyses.map(analysis => {
      // Tentukan severity dalam bahasa Indonesia
      const classification = analysis.results.classification;
      const severity = severityMapping[classification] || classification;
      
      // Tentukan severityLevel berdasarkan severity
      const severityLevel = severityLevelMapping[classification] || 
                            severityLevelMapping[severity] || 0;
      
      return {
        id: analysis._id,
        patientId: analysis.patientId ? analysis.patientId._id : null,
        patientName: analysis.patientId ? analysis.patientId.fullName || analysis.patientId.name : 'Unknown',
        imageUrl: `/uploads/${analysis.imageDetails.filename}`,
        createdAt: analysis.createdAt,
        severity: severity, // Gunakan nilai yang sudah diterjemahkan
        originalSeverity: classification, // Simpan nilai asli
        severityLevel: severityLevel, // Tambahkan severityLevel
        confidence: analysis.results.confidence,
        recommendation: analysis.recommendation,
        notes: analysis.notes || analysis.recommendation, // Pastikan notes ada
        isSimulation: analysis.results.isSimulation || false
      };
    });
    
    res.json(mappedAnalyses);
  } catch (error) {
    console.error('Error saat mengambil riwayat analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat analisis', error: error.message });
  }
});
router.get('/report', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    const latestAnalysis = await RetinaAnalysis.findOne({ 
      doctorId: req.user.id
    })
    .populate({
      path: 'patientId',
      select: 'name fullName gender age dateOfBirth'
    })
    .sort({ createdAt: -1 });
    
    if (!latestAnalysis) {
      return res.status(404).json({ message: 'Belum ada analisis yang dilakukan' });
    }
    
    // Mapping dari kelas bahasa Inggris ke Indonesia
    const severityMapping = {
      'No DR': 'Tidak ada',
      'Mild': 'Ringan',
      'Moderate': 'Sedang',
      'Severe': 'Berat',
      'Proliferative DR': 'Sangat Berat'
    };
    
    // Mapping untuk severityLevel
    const severityLevelMapping = {
      'Tidak ada': 0,
      'No DR': 0,
      'Ringan': 1,
      'Mild': 1,
      'Sedang': 2,
      'Moderate': 2,
      'Berat': 3,
      'Severe': 3,
      'Sangat Berat': 4,
      'Proliferative DR': 4
    };
    
    // Tentukan severity dalam bahasa Indonesia
    const classification = latestAnalysis.results.classification;
    const severity = severityMapping[classification] || classification;
    
    // Tentukan severityLevel berdasarkan severity
    const severityLevel = severityLevelMapping[classification] || 
                          severityLevelMapping[severity] || 0;
    
    // Format data untuk laporan
    const report = {
      id: latestAnalysis._id,
      patientId: latestAnalysis.patientId ? latestAnalysis.patientId._id : null,
      patientName: latestAnalysis.patientId ? latestAnalysis.patientId.fullName || latestAnalysis.patientId.name : 'Unknown',
      patientGender: latestAnalysis.patientId ? latestAnalysis.patientId.gender : null,
      patientAge: latestAnalysis.patientId ? latestAnalysis.patientId.age : null,
      patientDOB: latestAnalysis.patientId ? latestAnalysis.patientId.dateOfBirth : null,
      imageUrl: `/uploads/${latestAnalysis.imageDetails.filename}`,
      createdAt: latestAnalysis.createdAt,
      classification: latestAnalysis.results.classification, // Nilai asli
      severity: severity, // Nilai yang sudah diterjemahkan
      severityLevel: severityLevel,
      confidence: latestAnalysis.results.confidence,
      recommendation: latestAnalysis.recommendation,
      additionalNotes: latestAnalysis.notes || latestAnalysis.recommendation,
      raw_prediction: latestAnalysis.results,
      isSimulation: latestAnalysis.results.isSimulation || false
    };
    
    res.json(report);
  } catch (error) {
    console.error('Error saat mengambil laporan analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil laporan analisis', error: error.message });
  }
});
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

// Endpoint untuk mendapatkan data statistik dashboard
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    // Mendapatkan semua analisis untuk dokter yang login
    const analyses = await RetinaAnalysis.find({
      doctorId: req.user.id
    })
    .populate({
      path: 'patientId',
      select: 'name fullName gender age'
    })
    .sort({ createdAt: -1 });
    
    // Menghitung distribusi tingkat keparahan
    const severityCounts = {
      'Tidak ada': 0,
      'Ringan': 0,
      'Sedang': 0,
      'Berat': 0,
      'Sangat Berat': 0
    };
    
    // Mapping dari kelas bahasa Inggris ke Indonesia
    const severityMapping = {
      'No DR': 'Tidak ada',
      'Mild': 'Ringan',
      'Moderate': 'Sedang',
      'Severe': 'Berat',
      'Proliferative DR': 'Sangat Berat'
    };
    
    analyses.forEach(analysis => {
      const severity = analysis.results.classification;
      const indonesianSeverity = severityMapping[severity] || severity;
      
      if (severityCounts.hasOwnProperty(indonesianSeverity)) {
        severityCounts[indonesianSeverity]++;
      } else {
        // Jika tidak cocok dengan kategori yang ada, masukkan ke "Tidak ada"
        severityCounts['Tidak ada']++;
      }
    });
    
    // Hitung persentase untuk setiap tingkat keparahan
    const total = analyses.length || 1; // Hindari pembagian dengan nol
    const severityDistribution = [
      Math.round((severityCounts['Tidak ada'] / total) * 100),
      Math.round((severityCounts['Ringan'] / total) * 100),
      Math.round((severityCounts['Sedang'] / total) * 100),
      Math.round((severityCounts['Berat'] / total) * 100),
      Math.round((severityCounts['Sangat Berat'] / total) * 100)
    ];
    
    // Menghitung tren analisis bulanan
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthlyData = Array(12).fill(0);
    
    analyses.forEach(analysis => {
      const analysisDate = new Date(analysis.createdAt);
      if (analysisDate.getFullYear() === currentYear) {
        const month = analysisDate.getMonth();
        monthlyData[month]++;
      }
    });
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Menghitung distribusi umur
    const ageGroups = {
      '0-10': 0,
      '11-20': 0,
      '21-30': 0,
      '31-40': 0,
      '41-50': 0,
      '51-60': 0,
      '61+': 0
    };
    
    const patientsWithAge = analyses.filter(a => a.patientId && a.patientId.age);
    
    patientsWithAge.forEach(analysis => {
      const age = analysis.patientId.age;
      
      if (age <= 10) ageGroups['0-10']++;
      else if (age <= 20) ageGroups['11-20']++;
      else if (age <= 30) ageGroups['21-30']++;
      else if (age <= 40) ageGroups['31-40']++;
      else if (age <= 50) ageGroups['41-50']++;
      else if (age <= 60) ageGroups['51-60']++;
      else ageGroups['61+']++;
    });
    
    // Hitung persentase untuk setiap kelompok umur
    const totalPatients = patientsWithAge.length || 1; // Hindari pembagian dengan nol
    const ageDistribution = Object.values(ageGroups).map(count => 
      Math.round((count / totalPatients) * 100)
    );
    
    // Menghitung distribusi gender
    let maleCount = 0;
    let femaleCount = 0;
    
    patientsWithAge.forEach(analysis => {
      const gender = analysis.patientId.gender;
      if (gender === 'Laki-laki') maleCount++;
      else if (gender === 'Perempuan') femaleCount++;
    });
    
    const genderDistribution = [
      Math.round((maleCount / totalPatients) * 100),
      Math.round((femaleCount / totalPatients) * 100)
    ];
    
    // Menghitung tingkat kepercayaan AI
    let totalConfidence = 0;
    let highestConfidence = 0;
    let lowestConfidence = 100;
    
    analyses.forEach(analysis => {
      const confidence = analysis.results.confidence * 100;
      totalConfidence += confidence;
      highestConfidence = Math.max(highestConfidence, confidence);
      lowestConfidence = Math.min(lowestConfidence, confidence);
    });
    
    const avgConfidence = analyses.length ? Math.round(totalConfidence / analyses.length) : 0;
    
    const confidenceLevels = {
      average: avgConfidence,
      highest: Math.round(highestConfidence),
      lowest: Math.round(lowestConfidence)
    };
    
    // Mengirim data dashboard
    res.json({
      severityDistribution,
      monthlyTrend: {
        categories: monthNames,
        data: monthlyData
      },
      ageGroups: {
        categories: Object.keys(ageGroups),
        data: ageDistribution
      },
      genderDistribution,
      confidenceLevels,
      patients: patientsWithAge.map(a => ({
        id: a.patientId._id,
        name: a.patientId.fullName || a.patientId.name,
        age: a.patientId.age,
        gender: a.patientId.gender,
        severity: severityMapping[a.results.classification] || a.results.classification
      }))
    });
  } catch (error) {
    console.error('Error mendapatkan data dashboard:', error);
    res.status(500).json({ message: 'Gagal mendapatkan data dashboard', error: error.message });
  }
});

export default router;