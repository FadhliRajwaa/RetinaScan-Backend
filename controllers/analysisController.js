import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import RetinaAnalysis from '../models/RetinaAnalysis.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

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

// Fungsi untuk mendapatkan prediksi dari Flask API
const getPredictionFromFlaskApi = async (file, imageData) => {
  console.log(`Mencoba mendapatkan prediksi dari Flask API: ${FLASK_API_URL}`);
  
  try {
    if (imageData && imageData.startsWith('data:')) {
      // Jika imageData tersedia, gunakan itu (lebih efisien)
      console.log('Menggunakan imageData yang disediakan untuk prediksi');
      
      try {
        // Ambil bagian base64 saja (tanpa prefix data:image/...)
        const base64Parts = imageData.split(',');
        if (base64Parts.length !== 2) {
          throw new Error('Format base64 tidak valid');
        }
        
        const base64Data = base64Parts[1];
        // Validasi apakah base64 valid dengan mencoba decode dan encode kembali
        // Jika tidak valid, akan throw error
        try {
          // Coba decode dan encode kembali sebagian kecil data untuk validasi
          const testSegment = base64Data.substring(0, 100); // Ambil 100 karakter pertama saja
          atob(testSegment); // Decode base64, throw error jika tidak valid
        } catch (validationError) {
          console.error('Base64 tidak valid:', validationError);
          throw new Error('Base64 tidak valid');
        }
        
        // Kirim request ke Flask API dengan endpoint baru untuk base64
        const response = await axios.post(`${FLASK_API_URL}/predict-base64`, {
          image_data: base64Data
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 detik timeout (ditingkatkan dari 30 detik)
        });
        
        console.log('Prediksi berhasil dengan imageData:', response.data);
        return {
          class: response.data.class,
          confidence: response.data.confidence,
          isSimulation: response.data.is_simulation || false
        };
      } catch (base64Error) {
        console.error('Error saat memproses base64:', base64Error.message);
        throw base64Error;
      }
    } else if (file) {
      // Jika tidak ada imageData, gunakan file yang diupload
      console.log('Menggunakan file yang diupload untuk prediksi');
      
      // Buat FormData untuk mengirim file
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path));
      
      // Kirim request ke Flask API
      const response = await axios.post(`${FLASK_API_URL}/predict`, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 60000 // 60 detik timeout (ditingkatkan dari 30 detik)
      });
      
      console.log('Prediksi berhasil dengan file:', response.data);
      return {
        class: response.data.class,
        confidence: response.data.confidence,
        isSimulation: response.data.is_simulation || false
      };
    } else {
      throw new Error('Tidak ada data gambar yang valid untuk prediksi');
    }
  } catch (error) {
    console.error('Error saat memprediksi gambar:', error.message);
    throw error;
  }
};

// Proses file retina untuk analisis
export const processRetinaImage = async (req, res) => {
  try {
    if (!req.file && !req.body.imageData) {
      return res.status(400).json({ message: 'File gambar tidak ditemukan' });
    }

    if (!req.body.patientId) {
      return res.status(400).json({ message: 'Patient ID diperlukan' });
    }

    // Verifikasi bahwa pasien ada di database
    const Patient = req.app.get('models').Patient;
    const patient = await Patient.findById(req.body.patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Pasien tidak ditemukan' });
    }

    // Gunakan analysisId sebagai identifier unik
    const analysisId = uuidv4();
    const timestamp = new Date().toISOString();

    // Kirim gambar ke Flask API untuk analisis
    let predictionResult;
    let useSimulation = false;
    let errorMessage = null;

    try {
      console.log('Mencoba mendapatkan prediksi dari Flask API...');
      
      // Jika ada imageData tapi ukurannya > 1MB, kompres terlebih dahulu
      if (req.body.imageData && req.body.imageData.length > 1024 * 1024) {
        console.log('Gambar terlalu besar, mencoba kompres...');
        // Kita tidak benar-benar mengompres di sini, tapi bisa ditambahkan di masa depan
      }
      
      predictionResult = await getPredictionFromFlaskApi(req.file, req.body.imageData);
      console.log('Hasil prediksi:', predictionResult);
    } catch (flaskError) {
      console.error('Error saat menghubungi Flask API, beralih ke mode simulasi:', flaskError);
      errorMessage = flaskError.message || 'Error tidak diketahui';
      
      // Cek apakah ini error 422 (Unprocessable Entity) yang berarti format base64 tidak valid
      if (flaskError.response && flaskError.response.status === 422) {
        errorMessage = 'Format gambar tidak valid. Pastikan gambar dalam format yang didukung (JPEG/PNG).';
      }
      // Cek apakah ini error timeout
      else if (flaskError.code === 'ECONNABORTED') {
        errorMessage = 'Koneksi ke Flask API timeout. Server mungkin sedang sibuk atau tidak tersedia.';
      }
      // Cek apakah ini error koneksi
      else if (flaskError.code === 'ECONNREFUSED') {
        errorMessage = 'Tidak dapat terhubung ke Flask API. Server mungkin sedang down atau tidak tersedia.';
      }
      
      useSimulation = true;
      predictionResult = simulatePrediction(req.file ? req.file.filename : 'unknown');
      console.log('Hasil simulasi:', predictionResult);
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
    const severity = severityMapping[predictionResult.class] || predictionResult.class;
    
    // Tentukan severityLevel berdasarkan severity
    const severityLevel = severityLevelMapping[predictionResult.class] || 
                        severityLevelMapping[severity] || 0;

    // Buat rekomendasi berdasarkan tingkat keparahan
    let recommendation;
    
    // Menggunakan rekomendasi yang sama persis dengan yang didefinisikan di flask_service/app.py
    switch (severity) {
      case 'Ringan':
        recommendation = 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.';
        break;
      case 'Sedang':
        recommendation = 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.';
        break;
      case 'Berat':
        recommendation = 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.';
        break;
      case 'Sangat Berat':
        recommendation = 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.';
        break;
      default:
        recommendation = 'Lakukan pemeriksaan rutin setiap tahun.';
    }

    // Simpan data file
    const fileData = req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    } : {
      originalname: 'uploaded-image.jpg',
      mimetype: 'image/jpeg',
      filename: `${analysisId}.jpg`,
      path: `uploads/${analysisId}.jpg`,
      size: 0
    };

    // Simpan hasil analisis ke database
    const RetinaAnalysis = req.app.get('models').RetinaAnalysis;
    
    // Cek apakah ada analisis sebelumnya untuk pasien ini
    console.log(`Memeriksa analisis sebelumnya untuk pasien dengan ID: ${req.body.patientId}`);
    
    // Buat analisis baru
    const newAnalysis = new RetinaAnalysis({
      analysisId,
      doctorId: req.user.id,
      patientId: req.body.patientId,
      timestamp,
      imageDetails: fileData,
      imageData: req.body.imageData || null, // Simpan base64 image jika tersedia
      results: {
        classification: predictionResult.class,
        confidence: predictionResult.confidence,
        severity: severity, // Tambahkan severity langsung di level results
        severityLevel: severityLevel, // Tambahkan severityLevel langsung di level results
        isSimulation: useSimulation || predictionResult.isSimulation,
        errorMessage: errorMessage // Simpan pesan error jika ada
      },
      recommendation,
      notes: req.body.notes || recommendation
    });

    // Simpan analisis ke database
    const savedAnalysis = await newAnalysis.save();
    console.log('Analisis berhasil disimpan ke database dengan ID:', savedAnalysis._id);

    // Persiapkan URL gambar untuk respons
    let imageUrl;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.imageData) {
      imageUrl = req.body.imageData; // Gunakan base64 langsung
    }

    // Kirim respons ke klien dengan format yang konsisten
    res.status(201).json({
      message: 'Analisis berhasil',
      analysis: {
        id: savedAnalysis._id,
        analysisId: savedAnalysis.analysisId,
        patientId: savedAnalysis.patientId,
        patientName: patient.fullName || patient.name,
        timestamp: savedAnalysis.timestamp,
        createdAt: savedAnalysis.createdAt,
        imageUrl,
        // Tambahkan results sebagai objek terpisah agar konsisten
        results: {
          severity: severity,
          severityLevel: severityLevel,
          classification: predictionResult.class,
          confidence: predictionResult.confidence,
          isSimulation: useSimulation || predictionResult.isSimulation
        },
        // Tambahkan juga properties di root untuk backward compatibility
        severity: severity,
        severityLevel: severityLevel,
        confidence: predictionResult.confidence,
        recommendation,
        notes: savedAnalysis.notes,
        isSimulation: useSimulation || predictionResult.isSimulation
      }
    });
  } catch (error) {
    console.error('Error saat memproses gambar retina:', error);
    res.status(500).json({ message: 'Gagal memproses gambar', error: error.message });
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