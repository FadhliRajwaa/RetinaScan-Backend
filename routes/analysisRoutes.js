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
        imageData: analysis.imageData,
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

// Endpoint baru untuk mengambil riwayat analisis berdasarkan ID pasien
router.get('/history/patient/:patientId', authMiddleware, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Validasi patientId
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID diperlukan' });
    }
    
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    const Patient = req.app.get('models').Patient;
    
    // Cek apakah pasien ada
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Pasien tidak ditemukan' });
    }
    
    // Ambil semua analisis untuk pasien ini
    const analyses = await RetinaAnalysis.find({
      doctorId: req.user.id,
      patientId: patientId
    }).sort({ createdAt: -1 });
    
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
        patientId: patientId,
        patientName: patient.fullName || patient.name,
        imageUrl: `/uploads/${analysis.imageDetails.filename}`,
        imageData: analysis.imageData,
        createdAt: analysis.createdAt,
        severity: severity,
        originalSeverity: classification,
        severityLevel: severityLevel,
        confidence: analysis.results.confidence,
        recommendation: analysis.recommendation,
        notes: analysis.notes || analysis.recommendation,
        isSimulation: analysis.results.isSimulation || false
      };
    });
    
    // Kirim respons dengan data pasien dan riwayat analisisnya
    res.json({
      patient: {
        id: patient._id,
        name: patient.name,
        fullName: patient.fullName,
        gender: patient.gender,
        age: patient.age,
        dateOfBirth: patient.dateOfBirth
      },
      analyses: mappedAnalyses,
      totalAnalyses: mappedAnalyses.length
    });
  } catch (error) {
    console.error('Error saat mengambil riwayat analisis pasien:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat analisis pasien', error: error.message });
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
      imageData: latestAnalysis.imageData,
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
    const classification = analysis.results.classification;
    const severity = severityMapping[classification] || classification;
    
    // Tentukan severityLevel berdasarkan severity
    const severityLevel = severityLevelMapping[classification] || 
                          severityLevelMapping[severity] || 0;
    
    res.json({
      id: analysis._id,
      patientId: analysis.patientId ? analysis.patientId._id : null,
      patientName: analysis.patientId ? analysis.patientId.fullName || analysis.patientId.name : 'Unknown',
      patientGender: analysis.patientId ? analysis.patientId.gender : null,
      patientAge: analysis.patientId ? analysis.patientId.age : null,
      patientDOB: analysis.patientId ? analysis.patientId.dateOfBirth : null,
      imageUrl: `/uploads/${analysis.imageDetails.filename}`,
      imageData: analysis.imageData,
      createdAt: analysis.createdAt,
      classification: analysis.results.classification, // Nilai asli
      severity: severity, // Nilai yang sudah diterjemahkan
      severityLevel: severityLevel,
      confidence: analysis.results.confidence,
      recommendation: analysis.recommendation,
      additionalNotes: analysis.notes || analysis.recommendation,
      raw_prediction: analysis.results,
      isSimulation: analysis.results.isSimulation || false
    });
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
    
    // Siapkan data analisis untuk chart Analisis Tingkat Kepercayaan AI
    const analysesForChart = analyses.map(analysis => {
      // Pastikan data analisis memiliki format yang benar
      return {
        id: analysis._id || analysis.id,
        createdAt: analysis.createdAt,
        timestamp: analysis.timestamp || analysis.createdAt,
        results: {
          confidence: analysis.results.confidence,
          classification: analysis.results.classification
        },
        patientId: analysis.patientId ? {
          id: analysis.patientId._id || analysis.patientId.id,
          name: analysis.patientId.fullName || analysis.patientId.name,
          age: analysis.patientId.age,
          gender: analysis.patientId.gender
        } : null
      };
    });
    
    // Membuat objek data dashboard
    const dashboardData = {
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
      })),
      // Tambahkan data analisis untuk chart Analisis Tingkat Kepercayaan AI
      analyses: analysesForChart
    };
    
    // Mengirim data dashboard
    res.json(dashboardData);
    
    // Mendapatkan objek io dari app
    const io = req.app.get('io');
    
    // Jika io tersedia, broadcast update ke semua client yang terhubung
    if (io) {
      try {
        // Broadcast ke semua klien di room authenticated_users
        io.to('authenticated_users').emit('dashboard_update', dashboardData);
        console.log('Dashboard update emitted to authenticated users');
      } catch (error) {
        console.error('Error broadcasting dashboard update:', error);
      }
    }
  } catch (error) {
    console.error('Error mendapatkan data dashboard:', error);
    res.status(500).json({ message: 'Gagal mendapatkan data dashboard', error: error.message });
  }
});

// Fungsi utilitas untuk mengirim update dashboard
const emitDashboardUpdate = async (req) => {
  try {
    // Dapatkan io dari app
    const io = req.app.get('io');
    if (!io) {
      console.log('Socket.io tidak tersedia untuk emitDashboardUpdate');
      return;
    }
    
    // Dapatkan userId dari req.user yang disediakan oleh authMiddleware
    const userId = req.user.id;
    if (!userId) {
      console.log('User ID tidak tersedia untuk emitDashboardUpdate');
      return;
    }
    
    // Agar tidak memblokir endpoint yang memanggil fungsi ini,
    // jalankan proses pengumpulan data di latar belakang
    setTimeout(async () => {
      try {
        const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
        
        // Dapatkan data analisis terbaru
        const analyses = await RetinaAnalysis.find({
          doctorId: userId
        })
        .populate({
          path: 'patientId',
          select: 'name fullName gender age'
        })
        .sort({ createdAt: -1 });
        
        // Proses dan transformasi data untuk dashboard
        // Logika yang sama dengan endpoint /dashboard/stats
        
        // Simpan hasil ke objek dashboardData
        // (logika yang sama dengan endpoint dashboard/stats)
        
        // Broadcast update
        io.to('authenticated_users').emit('dashboard_update', {
          message: 'Dashboard data updated',
          timestamp: new Date().toISOString()
          // Tambahkan data dashboard di sini jika diperlukan
        });
        
        console.log('Dashboard update emitted after data change');
      } catch (error) {
        console.error('Error in background dashboard update:', error);
      }
    }, 1000); // Delay 1 detik agar tidak memblokir operasi utama
    
  } catch (error) {
    console.error('Error in emitDashboardUpdate:', error);
  }
};

// Tambahkan emitDashboardUpdate ke router untuk digunakan di endpoint lain
router.emitDashboardUpdate = emitDashboardUpdate;

export default router;