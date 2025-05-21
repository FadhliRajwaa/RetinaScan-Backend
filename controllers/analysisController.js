import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import RetinaAnalysis from '../models/RetinaAnalysis.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FLASK_API_URL = process.env.FLASK_API_URL ? `${process.env.FLASK_API_URL}/predict` : 'http://localhost:5001/predict';
const FLASK_API_INFO_URL = process.env.FLASK_API_URL ? `${process.env.FLASK_API_URL}/info` : 'http://localhost:5001/info';

// Periksa status Flask API
let flaskApiStatus = {
  available: false,
  checked: false,
  lastCheck: null,
  info: null
};

// Periksa apakah Flask API tersedia
const checkFlaskApiStatus = async () => {
  if (!flaskApiStatus.checked || Date.now() - flaskApiStatus.lastCheck > 60000) { // Periksa setiap 1 menit
    try {
      const response = await axios.get(FLASK_API_INFO_URL, {
        timeout: 5000
      });
      flaskApiStatus.available = true;
      flaskApiStatus.info = response.data;
      console.log('Flask API tersedia:', flaskApiStatus.info.model_name);
      console.log('Mode simulasi:', flaskApiStatus.info.simulation_mode ? 'Ya' : 'Tidak');
    } catch (error) {
      console.error('Flask API tidak tersedia:', error.message);
      flaskApiStatus.available = false;
      flaskApiStatus.info = null;
    }
    flaskApiStatus.checked = true;
    flaskApiStatus.lastCheck = Date.now();
  }
  return flaskApiStatus.available;
};

// Periksa status awal
checkFlaskApiStatus().then(() => {
  console.log('Status awal Flask API:', flaskApiStatus.available ? 'Tersedia' : 'Tidak tersedia');
});

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Tidak ada file yang diunggah' });
    if (!req.body.patientId) return res.status(400).json({ message: 'ID pasien diperlukan' });

    console.log('File diterima:', req.file);
    console.log('ID Pasien:', req.body.patientId);
    
    // Pastikan direktori uploads ada
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      console.log('Membuat direktori uploads...');
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Simpan path relatif untuk database
    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/');
    
    // Periksa apakah Flask API tersedia
    const apiAvailable = await checkFlaskApiStatus();
    
    let predictionResult;
    
    // Jika Flask API tersedia, kirim gambar untuk analisis
    if (apiAvailable) {
      try {
        // Buat form data untuk dikirim ke Flask API
        const formData = new FormData();
        const fileStream = fs.createReadStream(req.file.path);
        formData.append('file', fileStream);

        console.log('Mengirim request ke Flask API...');
        // Kirim request ke Flask API
        const response = await axios.post(FLASK_API_URL, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 30000 // 30 detik timeout
        });

        // Ambil hasil prediksi
        predictionResult = response.data;
        console.log('Hasil prediksi dari Flask API:', predictionResult);
        
        // Tampilkan peringatan jika menggunakan mode simulasi
        if (predictionResult.raw_prediction && predictionResult.raw_prediction.is_simulation) {
          console.warn('PERHATIAN: Menggunakan hasil simulasi dari Flask API, bukan prediksi model yang sebenarnya');
        }
      } catch (flaskError) {
        console.error('Error saat menghubungi Flask API:', flaskError.message);
        
        // Gunakan data mock untuk fallback
        console.log('Menggunakan data mock untuk testing...');
        predictionResult = {
          severity: 'Sedang',
          severity_level: 2,
          confidence: 0.85,
          raw_prediction: {
            is_simulation: true
          }
        };
      }
    } else {
      // Jika Flask API tidak tersedia, gunakan data mock
      console.log('Flask API tidak tersedia, menggunakan data mock...');
      predictionResult = {
        severity: 'Sedang',
        severity_level: 2,
        confidence: 0.85,
        raw_prediction: {
          is_simulation: true
        }
      };
    }

    // Simpan hasil analisis ke database dengan path relatif
    try {
      console.log('Menyimpan hasil analisis ke database...');
      const analysis = new RetinaAnalysis({
        userId: req.user.id,
        patientId: req.body.patientId,
        imagePath: relativePath,
        originalFilename: req.file.originalname,
        severity: predictionResult.severity,
        severityLevel: predictionResult.severity_level || 0,
        confidence: predictionResult.confidence || 0
      });

      await analysis.save();
      console.log('Analisis berhasil disimpan dengan ID:', analysis._id);

      // Kirim respons ke client dengan URL lengkap
      const apiBaseUrl = process.env.VITE_API_URL || 'http://localhost:5000';
      res.json({
        message: 'Analisis berhasil',
        prediction: {
          severity: predictionResult.severity,
          confidence: predictionResult.confidence,
          analysisId: analysis._id,
          patientId: analysis.patientId,
          imageUrl: `${apiBaseUrl}/uploads/${relativePath}`,
          isSimulation: predictionResult.raw_prediction && predictionResult.raw_prediction.is_simulation
        }
      });

      // Emit socket event for real-time update
      req.app.get('io').emit('analysisUpdated');
    } catch (dbError) {
      console.error('Error saat menyimpan ke database:', dbError);
      return res.status(500).json({ 
        message: 'Gagal menyimpan hasil analisis', 
        error: dbError.message 
      });
    }
  } catch (error) {
    console.error('Error in analysis:', error);
    console.error('Error stack:', error.stack);
    
    // Hapus file jika terjadi error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    return res.status(500).json({ 
      message: 'Terjadi kesalahan saat analisis', 
      error: error.message 
    });
  }
};

export const getUserAnalyses = async (req, res, next) => {
  try {
    const analyses = await RetinaAnalysis.find({ userId: req.user.id })
      .populate('patientId', 'name fullName gender age')
      .sort({ createdAt: -1 });
    
    res.json(analyses);
  } catch (error) {
    console.error('Error saat mengambil riwayat analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat analisis', error: error.message });
  }
};

export const getAnalysisById = async (req, res, next) => {
  try {
    const analysis = await RetinaAnalysis.findOne({ 
      _id: req.params.id,
      userId: req.user.id
    }).populate('patientId', 'name fullName gender age dateOfBirth bloodType');
    
    if (!analysis) {
      return res.status(404).json({ message: 'Analisis tidak ditemukan' });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error saat mengambil detail analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil detail analisis', error: error.message });
  }
};

// Endpoint untuk mendapatkan status Flask API
export const getFlaskApiStatus = async (req, res) => {
  try {
    const apiAvailable = await checkFlaskApiStatus();
    res.json({
      available: apiAvailable,
      lastCheck: flaskApiStatus.lastCheck,
      info: flaskApiStatus.info
    });
  } catch (error) {
    console.error('Error saat memeriksa status Flask API:', error);
    res.status(500).json({ 
      message: 'Gagal memeriksa status Flask API', 
      error: error.message 
    });
  }
};

const createAnalysis = async (req, res) => {
  try {
    const { patientId, severity, confidence, notes } = req.body;
    const imagePath = req.file ? req.file.path : null;
    const originalFilename = req.file ? req.file.originalname : null;

    const analysis = new RetinaAnalysis({
      patientId,
      severity,
      confidence,
      notes,
      imagePath,
      originalFilename
    });

    await analysis.save();

    // Emit socket event for real-time update
    req.app.get('io').emit('analysisUpdated');

    res.status(201).json(analysis);
  } catch (error) {
    console.error('Error creating analysis:', error);
    res.status(500).json({ message: 'Error creating analysis' });
  }
};

const updateAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    const analysis = await RetinaAnalysis.findByIdAndUpdate(id, update, { new: true });
    
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    // Emit socket event for real-time update
    req.app.get('io').emit('analysisUpdated');

    res.json(analysis);
  } catch (error) {
    console.error('Error updating analysis:', error);
    res.status(500).json({ message: 'Error updating analysis' });
  }
};

export const deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await RetinaAnalysis.findByIdAndDelete(id);
    
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    // Delete associated image if exists
    if (analysis.imagePath) {
      try {
        await fs.promises.unlink(analysis.imagePath);
      } catch (err) {
        console.error('Error deleting image file:', err);
      }
    }

    // Emit socket event for real-time update
    req.app.get('io').emit('analysisUpdated');

    res.json({ message: 'Analysis deleted successfully' });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({ message: 'Error deleting analysis' });
  }
};