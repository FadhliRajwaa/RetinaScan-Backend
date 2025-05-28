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

// Gunakan environment variable FLASK_API_URL yang sudah diatur di Render
// Tambahkan URL alternatif jika URL utama tidak tersedia
const FLASK_API_BASE_URLS = [
  process.env.FLASK_API_URL || 'https://fadhlirajwaa-retinascan-api.hf.space',
  'https://fadhlirajwaa-retinascan-api.hf.space',
  'http://localhost:5001',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://192.168.100.7:5000'
];

// Mulai dengan URL pertama
let currentUrlIndex = 0;
let FLASK_API_BASE_URL = FLASK_API_BASE_URLS[currentUrlIndex];
let FLASK_API_URL = `${FLASK_API_BASE_URL}/predict`;
let FLASK_API_INFO_URL = `${FLASK_API_BASE_URL}/`;

// Konfigurasi axios dengan timeout yang lebih tinggi dan retry
const axiosInstance = axios.create({
  timeout: 30000, // 30 detik timeout
  maxRetries: 3,
  retryDelay: 1000
});

// Interceptor untuk retry otomatis
axiosInstance.interceptors.response.use(null, async (error) => {
  const config = error.config;
  
  // Jika tidak ada konfigurasi atau retry sudah maksimal, throw error
  if (!config || !config.maxRetries) return Promise.reject(error);
  
  // Set retry count
  config.retryCount = config.retryCount || 0;
  
  // Jika sudah mencapai batas retry, throw error
  if (config.retryCount >= config.maxRetries) {
    console.log(`Gagal setelah ${config.maxRetries} kali retry:`, error.message);
    return Promise.reject(error);
  }
  
  // Increment retry count
  config.retryCount += 1;
  
  console.log(`Retry ke-${config.retryCount} untuk ${config.url}`);
  
  // Delay retry dengan backoff
  const delay = config.retryDelay || 1000;
  await new Promise(resolve => setTimeout(resolve, delay * config.retryCount));
  
  // Retry request
  return axiosInstance(config);
});

// Fungsi untuk beralih ke URL berikutnya
const switchToNextFlaskApiUrl = () => {
  currentUrlIndex = (currentUrlIndex + 1) % FLASK_API_BASE_URLS.length;
  FLASK_API_BASE_URL = FLASK_API_BASE_URLS[currentUrlIndex];
  FLASK_API_URL = `${FLASK_API_BASE_URL}/predict`;
  FLASK_API_INFO_URL = `${FLASK_API_BASE_URL}/`;
  console.log(`Beralih ke Flask API URL alternatif: ${FLASK_API_BASE_URL}`);
  return FLASK_API_BASE_URL;
};

// Periksa status Flask API
let flaskApiStatus = {
  available: false,
  checked: false,
  lastCheck: null,
  info: null,
  simulation: false, // Flag untuk mode simulasi jika Flask API tidak tersedia
  retryCount: 0
};

// Periksa apakah Flask API tersedia dengan mekanisme retry yang lebih robust
const checkFlaskApiStatus = async () => {
  // Jika sudah diperiksa dalam 60 detik terakhir, gunakan hasil cache
  if (flaskApiStatus.checked && Date.now() - flaskApiStatus.lastCheck < 60000) {
    return flaskApiStatus.available;
  }
  
  console.log(`Memeriksa status Flask API di: ${FLASK_API_INFO_URL}`);
  
  // Coba semua URL alternatif jika perlu
  let allUrlsTried = false;
  let startingUrlIndex = currentUrlIndex; // Simpan URL awal untuk menghindari loop tak terbatas
  
  while (!allUrlsTried) {
    // Implementasi retry logic untuk URL saat ini
    let retries = 3;
    let success = false;
    let lastError = null;
    
    while (retries > 0 && !success) {
      try {
        console.log(`Mencoba koneksi ke Flask API di ${FLASK_API_BASE_URL} (percobaan ke-${4-retries}/3)...`);
        
        const response = await axiosInstance.get(FLASK_API_INFO_URL, {
          timeout: 20000 // 20 detik timeout
        });
        
        // Verifikasi bahwa respons memiliki format yang diharapkan
        if (response.data && (response.data.status === 'online' || response.data.service === 'retinopathy-api')) {
          flaskApiStatus.available = true;
          flaskApiStatus.info = response.data;
          flaskApiStatus.lastSuccessfulResponse = response.data;
          flaskApiStatus.lastCheck = Date.now();
          flaskApiStatus.checked = true;
          flaskApiStatus.retryCount = 0; // Reset retry counter
          flaskApiStatus.fallbackMode = false; // Pastikan fallback mode dinonaktifkan
          flaskApiStatus.activeUrl = FLASK_API_BASE_URL; // Simpan URL yang aktif
          flaskApiStatus.simulation = response.data.simulation_mode_enabled === true;
          
          console.log('Flask API tersedia:', flaskApiStatus.info.model_name || 'Tidak diketahui');
          console.log('Kelas model:', flaskApiStatus.info.classes ? flaskApiStatus.info.classes.join(', ') : 'Tidak diketahui');
          console.log('Versi API:', flaskApiStatus.info.api_version || '1.0.0');
          console.log('Mode Simulasi:', flaskApiStatus.simulation ? 'Ya' : 'Tidak');
          
          success = true;
          return true;
        } else {
          console.log('Flask API merespons tetapi format tidak sesuai:', response.data);
          lastError = new Error('Invalid API response format');
          retries--;
        }
      } catch (error) {
        console.log(`Koneksi ke Flask API gagal (${error.message})`);
        
        // Jika error adalah timeout atau koneksi ditolak, coba URL berikutnya
        if (
          error.code === 'ECONNABORTED' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ENOTFOUND' ||
          (error.response && error.response.status >= 500)
        ) {
          lastError = error;
          retries--;
          
          // Tunggu sebentar sebelum mencoba lagi
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // Jika error bukan masalah koneksi, coba URL berikutnya
          lastError = error;
          retries = 0; // Langsung coba URL berikutnya
        }
      }
    }
    
    // Jika gagal dengan URL saat ini, coba URL berikutnya
    if (!success) {
      console.log(`Gagal terhubung ke ${FLASK_API_BASE_URL} setelah beberapa percobaan. Beralih ke URL berikutnya...`);
      switchToNextFlaskApiUrl();
      
      // Jika sudah kembali ke URL awal, berarti semua URL sudah dicoba
      if (currentUrlIndex === startingUrlIndex) {
        allUrlsTried = true;
      }
    }
  }
  
  // Jika semua URL telah dicoba dan semuanya gagal, aktifkan mode simulasi sebagai fallback terakhir
  console.log(`Semua URL Flask API (${FLASK_API_BASE_URLS.join(', ')}) telah dicoba dan gagal.`);
  
  flaskApiStatus.available = false;
  flaskApiStatus.simulation = true; // Aktifkan mode simulasi
  flaskApiStatus.lastError = {
    message: "Semua URL Flask API tidak tersedia",
    timestamp: Date.now()
  };
  flaskApiStatus.retryCount = (flaskApiStatus.retryCount || 0) + 1;
  flaskApiStatus.lastCheck = Date.now();
  flaskApiStatus.checked = true;
  
  // Coba gunakan URL terakhir yang berhasil jika ada
  if (flaskApiStatus.activeUrl) {
    console.log(`Mencoba menggunakan URL terakhir yang berhasil: ${flaskApiStatus.activeUrl}`);
    FLASK_API_BASE_URL = flaskApiStatus.activeUrl;
    FLASK_API_URL = `${FLASK_API_BASE_URL}/predict`;
    FLASK_API_INFO_URL = `${FLASK_API_BASE_URL}/`;
    
    // Perbarui currentUrlIndex
    currentUrlIndex = FLASK_API_BASE_URLS.indexOf(FLASK_API_BASE_URL);
    if (currentUrlIndex === -1) currentUrlIndex = 0;
  }
  
  console.log('Semua URL Flask API tidak tersedia setelah beberapa percobaan');
  console.log('Mode simulasi diaktifkan. Prediksi akan menggunakan fallback data');
  
  // Kembalikan false karena Flask API tidak tersedia
  return false;
};

// Fungsi untuk menguji koneksi ke Flask API secara menyeluruh
async function testFlaskApiConnection() {
  try {
    console.log('Menguji koneksi ke Flask API...');
    console.log(`URL yang diuji: ${FLASK_API_INFO_URL}`);
    
    // Simpan URL awal untuk kembali jika semua URL alternatif gagal
    const originalUrlIndex = currentUrlIndex;
    const originalBaseUrl = FLASK_API_BASE_URL;
    const originalInfoUrl = FLASK_API_INFO_URL;
    
    const alternativeResults = [];
    
    const startTime = Date.now();
    try {
      const response = await axiosInstance.get(FLASK_API_INFO_URL, {
        timeout: 20000
      });
      
      const endTime = Date.now();
      
      console.log(`Koneksi berhasil. Waktu respons: ${endTime - startTime}ms`);
      console.log('Detail Flask API:');
      console.log(`- Status: ${response.status}`);
      console.log(`- Model: ${response.data.model_name || 'Tidak diketahui'}`);
      console.log(`- Mode Simulasi: ${response.data.simulation_mode_enabled ? 'Ya' : 'Tidak'}`);
      console.log(`- Versi TensorFlow: ${response.data.tf_version || 'Tidak diketahui'}`);
      
      // Simpan URL yang berhasil
      flaskApiStatus.activeUrl = FLASK_API_BASE_URL;
      
      return {
        success: true,
        responseTime: endTime - startTime,
        data: response.data,
        url: FLASK_API_BASE_URL
      };
    } catch (error) {
      console.log(`Koneksi ke Flask API utama (${FLASK_API_BASE_URL}) gagal: ${error.message}`);
      
      // Coba semua URL alternatif
      for (let i = 0; i < FLASK_API_BASE_URLS.length; i++) {
        // Jangan coba URL yang sama dengan yang baru saja gagal
        if (i === originalUrlIndex) continue;
        
        const alternativeBaseUrl = FLASK_API_BASE_URLS[i];
        const alternativeInfoUrl = `${alternativeBaseUrl}/`;
        
        console.log(`Mencoba URL alternatif: ${alternativeInfoUrl}`);
        
        try {
          const altStartTime = Date.now();
          const altResponse = await axiosInstance.get(alternativeInfoUrl, { timeout: 20000 });
          const altEndTime = Date.now();
          
          console.log(`Koneksi ke URL alternatif berhasil: ${alternativeBaseUrl}`);
          
          // Perbarui URL aktif
          FLASK_API_BASE_URL = alternativeBaseUrl;
          FLASK_API_URL = `${alternativeBaseUrl}/predict`;
          FLASK_API_INFO_URL = alternativeInfoUrl;
          currentUrlIndex = i;
          
          // Simpan URL yang berhasil
          flaskApiStatus.activeUrl = alternativeBaseUrl;
          
          // Kembalikan hasil sukses dengan URL alternatif
          return {
            success: true,
            responseTime: altEndTime - altStartTime,
            data: altResponse.data,
            url: alternativeBaseUrl,
            isAlternative: true,
            originalUrl: originalBaseUrl
          };
        } catch (altError) {
          console.log(`URL alternatif ${alternativeBaseUrl} juga gagal: ${altError.message}`);
          alternativeResults.push({
            url: alternativeBaseUrl,
            error: altError.message,
            code: altError.code
          });
        }
      }
      
      // Kembalikan ke URL awal jika semua alternatif gagal
      FLASK_API_BASE_URL = originalBaseUrl;
      FLASK_API_URL = `${originalBaseUrl}/predict`;
      FLASK_API_INFO_URL = originalInfoUrl;
      currentUrlIndex = originalUrlIndex;
      
      return {
        success: false,
        error: error.message,
        code: error.code,
        url: originalBaseUrl,
        alternativeResults,
        time: Date.now() - startTime
      };
    }
  } catch (outerError) {
    console.error('Error saat pengujian koneksi Flask API:', outerError);
    return {
      success: false,
      error: outerError.message,
      code: outerError.code
    };
  }
}

// Periksa status awal dengan test menyeluruh
testFlaskApiConnection().then(result => {
  console.log('Hasil pengujian koneksi awal Flask API:', result.success ? 'Berhasil' : 'Gagal');
  if (!result.success) {
    console.log('Koneksi ke Flask API gagal. Pastikan Flask API berjalan dan dapat diakses.');
    // Aktifkan mode simulasi
    flaskApiStatus.simulation = true;
    console.log('Mode simulasi diaktifkan secara otomatis karena Flask API tidak tersedia');
  }
});

// Fungsi simulasi prediksi jika Flask API tidak tersedia
const simulatePrediction = (filename) => {
  // Kelas yang mungkin
  const classes = ['No DR', 'Mild', 'Moderate', 'Severe', 'Proliferative DR'];
  
  // Membuat distribusi prediksi yang lebih realistis
  // No DR lebih umum, sedangkan Proliferative DR lebih jarang
  let randomValue = Math.random();
  let classIndex;
  
  if (randomValue < 0.45) {
    classIndex = 0; // No DR (45% kemungkinan)
  } else if (randomValue < 0.65) {
    classIndex = 1; // Mild (20% kemungkinan)
  } else if (randomValue < 0.85) {
    classIndex = 2; // Moderate (20% kemungkinan)
  } else if (randomValue < 0.95) {
    classIndex = 3; // Severe (10% kemungkinan)
  } else {
    classIndex = 4; // Proliferative DR (5% kemungkinan)
  }
  
  const confidence = 0.7 + (Math.random() * 0.3); // Kepercayaan antara 0.7 dan 1.0
  
  console.log(`SIMULASI PREDIKSI: ${classes[classIndex]} dengan confidence ${confidence.toFixed(2)}`);
  
  return {
    class: classes[classIndex],
    confidence: parseFloat(confidence.toFixed(4)),
    isSimulation: true
  };
};

// Proses file retina untuk analisis
export const processRetinaImage = async (req, res) => {
  try {
    // Dapatkan referensi ke model analisis
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    // Cek apakah file ada
    if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diunggah' });
    }

    // Cek apakah file adalah gambar
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ message: 'File harus berupa gambar' });
    }

    // Buat ID unik untuk analisis
    const analysisId = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date();
    
    // Simpan informasi file
    const fileInfo = {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    };
    
    // Periksa status Flask API
    const apiAvailable = await checkFlaskApiStatus();
    let predictionResult;
    
    if (apiAvailable && !flaskApiStatus.simulation) {
      try {
        console.log(`Flask API tersedia, mengirim gambar ke ${FLASK_API_URL} untuk prediksi...`);
        
        // Buat FormData untuk mengirim file
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));
        
        // Kirim request ke Flask API dengan timeout yang ditingkatkan
        const predictionResponse = await axiosInstance.post(FLASK_API_URL, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 60000, // 60 detik timeout
          maxRetries: 2,
          retryDelay: 1000
        });
        
        console.log('Prediksi berhasil:', predictionResponse.data);
        
        // Ekstrak hasil prediksi
        predictionResult = {
          class: predictionResponse.data.class,
          confidence: predictionResponse.data.confidence,
          isSimulation: false
        };
      } catch (predictionError) {
        console.error('Error saat memprediksi gambar:', predictionError.message);
        
        // Jika terjadi error, gunakan simulasi sebagai fallback
        console.log('Menggunakan mode simulasi sebagai fallback...');
        predictionResult = simulatePrediction(req.file.originalname);
      }
    } else {
      console.log('Flask API tidak tersedia, menggunakan mode simulasi...');
      predictionResult = simulatePrediction(req.file.originalname);
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
    const classification = predictionResult.class;
    const severity = severityMapping[classification] || classification;
    
    // Tentukan severityLevel berdasarkan severity
    const severityLevel = severityLevelMapping[classification] || 
                          severityLevelMapping[severity] || 0;
    
    // Tentukan rekomendasi berdasarkan hasil klasifikasi
    let recommendation = '';
    switch (classification) {
      case 'No DR':
        recommendation = 'Tidak ditemukan tanda-tanda Diabetic Retinopathy. Lakukan pemeriksaan rutin setiap tahun.';
        break;
      case 'Mild':
        recommendation = 'Ditemukan tanda-tanda awal Diabetic Retinopathy. Disarankan untuk kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.';
        break;
      case 'Moderate':
        recommendation = 'Ditemukan Diabetic Retinopathy tingkat sedang. Disarankan untuk konsultasi dengan dokter spesialis mata dalam 6 bulan.';
        break;
      case 'Severe':
        recommendation = 'Ditemukan Diabetic Retinopathy tingkat lanjut. Disarankan untuk segera konsultasi dengan dokter spesialis mata dalam 1 bulan.';
        break;
      case 'Proliferative DR':
        recommendation = 'Ditemukan Diabetic Retinopathy proliferatif. Memerlukan penanganan segera oleh dokter spesialis mata.';
        break;
      default:
        recommendation = 'Tidak dapat menentukan rekomendasi. Silakan konsultasi dengan dokter spesialis mata.';
    }
    
    // Buat dokumen analisis baru
    const newAnalysis = new RetinaAnalysis({
      analysisId,
      patientId: req.body.patientId,
      doctorId: req.user.id,
      timestamp,
      imageDetails: fileInfo,
      results: {
        classification: predictionResult.class,
        confidence: predictionResult.confidence,
        isSimulation: predictionResult.isSimulation
      },
      recommendation,
      notes: req.body.notes || ''
    });
    
    // Simpan analisis ke database
    await newAnalysis.save();
    
    // Kirim notifikasi melalui Socket.IO jika tersedia
    const io = req.app.get('io');
    if (io) {
      io.emit('new-analysis', {
        id: newAnalysis._id,
        timestamp,
        classification: predictionResult.class,
        severity: severity,
        severityLevel: severityLevel,
        patientId: req.body.patientId,
        doctorId: req.user.id
      });
    }
    
    // Kirim respons
    res.status(201).json({
      message: 'Analisis retina berhasil',
      analysis: {
        id: newAnalysis._id,
        analysisId,
        patientId: req.body.patientId,
        timestamp,
        imageUrl: `/uploads/${req.file.filename}`,
        results: {
          classification: predictionResult.class, // Nilai asli dalam bahasa Inggris
          severity: severity, // Nilai yang sudah diterjemahkan ke Indonesia
          severityLevel: severityLevel, // Level keparahan (0-4)
          confidence: predictionResult.confidence,
          isSimulation: predictionResult.isSimulation
        },
        recommendation,
        notes: newAnalysis.notes
      }
    });
  } catch (error) {
    console.error('Error saat memproses gambar retina:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memproses gambar', error: error.message });
  }
};

// Endpoint untuk mendapatkan status Flask API dengan detail lebih lengkap
export const getFlaskApiStatus = async (req, res) => {
  try {
    console.log('Memeriksa status Flask API dari endpoint API...');
    
    // Dapatkan status dasar dari cache
    const apiAvailable = await checkFlaskApiStatus();
    
    // Jika diminta tes menyeluruh, lakukan tes tambahan
    const fullTest = req.query.fullTest === 'true';
    let detailedResult = null;
    
    if (fullTest) {
      console.log('Melakukan pengujian menyeluruh...');
      detailedResult = await testFlaskApiConnection();
    }
    
    res.json({
      available: apiAvailable,
      simulation: flaskApiStatus.simulation,
      lastCheck: flaskApiStatus.lastCheck,
      info: flaskApiStatus.info,
      apiUrl: FLASK_API_URL,
      infoUrl: FLASK_API_INFO_URL,
      detailedTest: fullTest ? detailedResult : null
    });
  } catch (error) {
    console.error('Error saat memeriksa status Flask API:', error);
    res.status(500).json({ 
      message: 'Gagal memeriksa status Flask API', 
      error: error.message 
    });
  }
};

// Endpoint untuk pengujian koneksi Flask API secara menyeluruh
export const testFlaskConnection = async (req, res) => {
  try {
    console.log('Menguji koneksi ke Flask API...');
    
    // Coba URL utama terlebih dahulu
    const mainTest = await testFlaskApiConnection();
    
    // Jika URL utama berhasil, kembalikan hasilnya
    if (mainTest.success) {
      // Cek apakah model dimuat dengan benar
      const modelStatus = mainTest.data && mainTest.data.model_loaded;
      
      return res.json({
        success: true,
        message: `Koneksi ke Flask API berhasil (${mainTest.responseTime}ms)`,
        url: mainTest.url,
        model_loaded: modelStatus === true,
        data: mainTest.data
      });
    }
    
    // Jika gagal, coba URL localhost untuk testing
    console.log('Mencoba koneksi ke localhost...');
    
    // Temporarily set to localhost for testing
    global.FLASK_API_BASE_URL_TEMP = 'http://localhost:5001';
    const tempInfoUrl = `${global.FLASK_API_BASE_URL_TEMP}/`;
    
    axios.get(tempInfoUrl, { timeout: 5000 })
      .then(response => {
        console.log('Koneksi ke localhost berhasil');
        
        // Buat rekomendasi berdasarkan hasil test
        const recommendations = generateRecommendations(mainTest, {
          success: true,
          data: response.data
        });
        
        return res.json({
          success: true,
          message: 'Koneksi ke Flask API gagal tetapi localhost berhasil',
          url: global.FLASK_API_BASE_URL_TEMP,
          recommendations,
          data: response.data
        });
      })
      .catch(err => {
        console.log('Koneksi ke localhost juga gagal');
      
        // Ganti dengan localhost untuk testing
        const localBaseUrl = 'http://localhost:5001';
        const localInfoUrl = `${localBaseUrl}/`;
      
        try {
          // Buat rekomendasi berdasarkan hasil test
          const recommendations = generateRecommendations(mainTest, { success: false });
          
          return res.json({
            success: false,
            message: 'Koneksi ke Flask API dan localhost gagal',
            error: mainTest.error || 'Tidak dapat terhubung ke Flask API',
            recommendations,
            urls_tried: [FLASK_API_BASE_URL, localBaseUrl],
            simulation_mode: true // Indikasi bahwa mode simulasi aktif
          });
        } catch (finalError) {
          return res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan saat menguji koneksi',
            error: finalError.message
          });
        }
      });
  } catch (error) {
    console.error('Error saat menguji koneksi:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat menguji koneksi',
      error: error.message 
    });
  }
};

// Fungsi helper untuk menghasilkan rekomendasi berdasarkan hasil pengujian
function generateRecommendations(mainTest, localhostTest) {
  const recommendations = [];
  
  if (mainTest.success) {
    recommendations.push('Koneksi ke Flask API berhasil. Tidak diperlukan tindakan khusus.');
    
    if (mainTest.data && mainTest.data.simulation_mode_enabled) {
      recommendations.push('Flask API berjalan dalam mode simulasi. Pertimbangkan untuk mengunggah model ML jika ingin menggunakan prediksi yang sebenarnya.');
    }
    
    if (mainTest.responseTime > 2000) {
      recommendations.push(`Waktu respons Flask API tinggi (${mainTest.responseTime}ms). Hal ini mungkin memengaruhi pengalaman pengguna. Pertimbangkan untuk mengoptimalkan deployment.`);
    }
  } else {
    recommendations.push('Koneksi ke Flask API utama gagal.');
    
    if (mainTest.code === 'ECONNREFUSED') {
      recommendations.push('Server Flask API tidak merespons. Pastikan layanan berjalan dan aksesibel.');
    } else if (mainTest.code === 'ENOTFOUND') {
      recommendations.push('Host Flask API tidak ditemukan. Periksa URL yang dikonfigurasi.');
    } else if (mainTest.code === 'ETIMEDOUT') {
      recommendations.push('Koneksi ke Flask API timeout. Server mungkin lambat atau tidak merespons.');
    }
    
    if (localhostTest && localhostTest.success) {
      recommendations.push('Koneksi ke localhost berhasil. Pertimbangkan untuk menggunakan localhost selama deployment Flask API sedang diperbaiki.');
    } else if (localhostTest) {
      recommendations.push('Koneksi ke localhost juga gagal. Pastikan Flask service berjalan di salah satu endpoint.');
    }
    
    recommendations.push(`Periksa variabel lingkungan FLASK_API_URL (saat ini: ${FLASK_API_BASE_URL}). Pastikan URL benar dan dapat diakses.`);
    recommendations.push('Mode simulasi telah diaktifkan. Aplikasi akan tetap berfungsi dengan prediksi simulasi.');
  }
  
  return recommendations;
}