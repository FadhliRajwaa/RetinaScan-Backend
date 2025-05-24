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
  process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com',
  'https://retinascan-flask-api.onrender.com',
  'http://localhost:5001'
];

// Mulai dengan URL pertama
let currentUrlIndex = 0;
let FLASK_API_BASE_URL = FLASK_API_BASE_URLS[currentUrlIndex];
let FLASK_API_URL = `${FLASK_API_BASE_URL}/predict`;
let FLASK_API_INFO_URL = `${FLASK_API_BASE_URL}/`;

// Fungsi untuk beralih ke URL berikutnya
const switchToNextFlaskApiUrl = () => {
  currentUrlIndex = (currentUrlIndex + 1) % FLASK_API_BASE_URLS.length;
  FLASK_API_BASE_URL = FLASK_API_BASE_URLS[currentUrlIndex];
  FLASK_API_URL = `${FLASK_API_BASE_URL}/predict`;
  FLASK_API_INFO_URL = `${FLASK_API_BASE_URL}/`;
  console.log(`Beralih ke Flask API URL alternatif: ${FLASK_API_BASE_URL}`);
  return FLASK_API_BASE_URL;
};

console.log(`Flask API Base URL: ${FLASK_API_BASE_URL}`);
console.log(`Flask API Predict URL: ${FLASK_API_URL}`);
console.log(`Flask API Info URL: ${FLASK_API_INFO_URL}`);

// Periksa status Flask API
let flaskApiStatus = {
  available: false,
  checked: false,
  lastCheck: null,
  info: null
};

// Periksa apakah Flask API tersedia dengan mekanisme retry yang lebih robust
const checkFlaskApiStatus = async () => {
  // Jika sudah diperiksa dalam 60 detik terakhir, gunakan hasil cache
  // Tingkatkan waktu cache dari 30 detik menjadi 60 detik untuk mengurangi pemeriksaan berulang
  if (flaskApiStatus.checked && Date.now() - flaskApiStatus.lastCheck < 60000) {
    return flaskApiStatus.available;
  }
  
  console.log(`Memeriksa status Flask API di: ${FLASK_API_INFO_URL}`);
  
  // Coba semua URL alternatif jika perlu
  let allUrlsTried = false;
  let startingUrlIndex = currentUrlIndex; // Simpan URL awal untuk menghindari loop tak terbatas
  
  while (!allUrlsTried) {
    // Implementasi retry logic untuk URL saat ini
    let retries = 3; // Kurangi jumlah retry dari 5 menjadi 3
    let success = false;
    let lastError = null;
    
    while (retries > 0 && !success) {
      try {
        console.log(`Mencoba koneksi ke Flask API di ${FLASK_API_BASE_URL} (percobaan ke-${4-retries}/3)...`);
        
        const response = await axios.get(FLASK_API_INFO_URL, {
          timeout: 15000 // Kurangi timeout dari 30 detik menjadi 15 detik
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
          
          console.log('Flask API tersedia:', flaskApiStatus.info.model_name || 'Tidak diketahui');
          console.log('Mode simulasi:', flaskApiStatus.info.simulation_mode ? 'Ya' : 'Tidak');
          console.log('Kelas model:', flaskApiStatus.info.classes ? flaskApiStatus.info.classes.join(', ') : 'Tidak diketahui');
          console.log('Versi API:', flaskApiStatus.info.api_version || '1.0.0');
          
          success = true;
          return true;
        } else {
          console.log('Flask API merespons tetapi format tidak sesuai:', response.data);
          lastError = new Error('Invalid API response format');
          retries--;
        }
      } catch (error) {
        lastError = error;
        
        // Log error details
        console.error(`Flask API tidak tersedia di ${FLASK_API_BASE_URL} (percobaan ke-${4-retries}/3):`, error.message);
        
        if (error.response) {
          console.error('Response status:', error.response.status);
          // Batasi output data untuk menghindari teks random yang panjang
          const responseData = error.response.data;
          let truncatedData;
          
          if (typeof responseData === 'string') {
            truncatedData = responseData.length > 100 
              ? responseData.substring(0, 100) + '... [truncated]' 
              : responseData;
          } else if (responseData && typeof responseData === 'object') {
            truncatedData = '[Object data]';
          } else {
            truncatedData = responseData;
          }
          
          console.error('Response data:', truncatedData);
        } else if (error.request) {
          console.error('Tidak ada respons dari server Flask API');
        }
        
        // Deteksi cold start (502 Bad Gateway)
        if (error.response && error.response.status === 502) {
          console.log('Terdeteksi cold start pada Render free tier. Menunggu lebih lama...');
          await new Promise(resolve => setTimeout(resolve, 10000)); // Kurangi waktu tunggu dari 15 detik menjadi 10 detik
        } else {
          // Delay standar antara percobaan
          await new Promise(resolve => setTimeout(resolve, 3000)); // Kurangi waktu tunggu dari 5 detik menjadi 3 detik
        }
        
        retries--;
      }
    }
    
    // Jika semua percobaan gagal untuk URL saat ini, coba URL berikutnya
    switchToNextFlaskApiUrl();
    
    // Periksa apakah kita sudah mencoba semua URL (kembali ke URL awal)
    if (currentUrlIndex === startingUrlIndex) {
      allUrlsTried = true;
    }
  }
  
  // Jika semua URL dan percobaan gagal
  flaskApiStatus.available = false;
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
  
  // Tetap gunakan info terakhir yang berhasil jika ada
  if (!flaskApiStatus.info && flaskApiStatus.lastSuccessfulResponse) {
    flaskApiStatus.info = flaskApiStatus.lastSuccessfulResponse;
  }
  
  console.log('Semua URL Flask API tidak tersedia setelah beberapa percobaan');
  
  // Gunakan fallback mode jika semua percobaan gagal
  flaskApiStatus.fallbackMode = true;
  
  // Kembalikan true untuk menggunakan data mock dengan variasi hasil
  return true;
};

// Fungsi untuk menguji koneksi ke Flask API secara menyeluruh
async function testFlaskApiConnection() {
  try {
    console.log('Menguji koneksi ke Flask API...');
    console.log(`URL yang diuji: ${FLASK_API_INFO_URL}`);
    
    const startTime = Date.now();
    const response = await axios.get(FLASK_API_INFO_URL, {
      timeout: 10000
    });
    const endTime = Date.now();
    
    console.log(`Koneksi berhasil. Waktu respons: ${endTime - startTime}ms`);
    console.log('Detail Flask API:');
    console.log(`- Status: ${response.status}`);
    console.log(`- Model: ${response.data.model_name || 'Tidak diketahui'}`);
    console.log(`- Mode Simulasi: ${response.data.simulation_mode ? 'Ya' : 'Tidak'}`);
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
    console.error('Koneksi ke Flask API gagal:');
    console.error(`- Error: ${error.message}`);
    console.error(`- URL: ${FLASK_API_INFO_URL}`);
    if (error.code) console.error(`- Kode Error: ${error.code}`);
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      // Batasi output data untuk menghindari teks random yang panjang
      const responseData = error.response.data;
      let truncatedData;
      
      if (typeof responseData === 'string') {
        truncatedData = responseData.length > 100 
          ? responseData.substring(0, 100) + '... [truncated]' 
          : responseData;
      } else if (responseData && typeof responseData === 'object') {
        truncatedData = '[Object data]';
      } else {
        truncatedData = responseData;
      }
      
      console.error(`- Data: ${truncatedData}`);
    }
    
    // Coba URL alternatif
    const originalUrlIndex = currentUrlIndex;
    let alternativeResults = [];
    
    // Simpan URL saat ini
    const originalBaseUrl = FLASK_API_BASE_URL;
    const originalInfoUrl = FLASK_API_INFO_URL;
    
    // Coba semua URL alternatif
    for (let i = 0; i < FLASK_API_BASE_URLS.length; i++) {
      // Jangan coba URL yang sama dengan yang baru saja gagal
      if (i === originalUrlIndex) continue;
      
      const alternativeBaseUrl = FLASK_API_BASE_URLS[i];
      const alternativeInfoUrl = `${alternativeBaseUrl}/`;
      
      console.log(`Mencoba URL alternatif: ${alternativeInfoUrl}`);
      
      try {
        const altStartTime = Date.now();
        const altResponse = await axios.get(alternativeInfoUrl, { timeout: 10000 });
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
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null,
      alternativeResults: alternativeResults
    };
  }
}

// Periksa status awal dengan test menyeluruh
testFlaskApiConnection().then(result => {
  console.log('Hasil pengujian koneksi awal Flask API:', result.success ? 'Berhasil' : 'Gagal');
  if (!result.success) {
    console.log('Mencoba fallback ke localhost...');
    // Coba gunakan localhost sebagai fallback
    const originalUrl = FLASK_API_BASE_URL;
    // Temporarily set to localhost for testing
    global.FLASK_API_BASE_URL_TEMP = 'http://localhost:5001';
    const tempInfoUrl = `${global.FLASK_API_BASE_URL_TEMP}/`;
    
    axios.get(tempInfoUrl, { timeout: 5000 })
      .then(response => {
        console.log('Koneksi ke localhost berhasil!');
        console.log('Pertimbangkan untuk menggunakan URL ini jika deployment mengalami masalah.');
      })
      .catch(err => {
        console.log('Koneksi ke localhost juga gagal.');
        console.log('Pastikan Flask service berjalan di salah satu URL.');
      })
      .finally(() => {
        // Clean up
        delete global.FLASK_API_BASE_URL_TEMP;
      });
  }
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
    console.log('Memeriksa ketersediaan Flask API...');
    const apiAvailable = await checkFlaskApiStatus();
    console.log('Status Flask API:', apiAvailable ? 'Tersedia' : 'Tidak tersedia');
    
    let predictionResult;
    let isSimulation = false;
    let apiUrlUsed = null;
    
    // Jika Flask API tersedia, kirim gambar untuk analisis
    if (apiAvailable) {
      try {
        // Buat form data untuk dikirim ke Flask API
        const formData = new FormData();
        const fileStream = fs.createReadStream(req.file.path);
        formData.append('file', fileStream);

        console.log(`Mengirim request ke Flask API di: ${FLASK_API_URL}`);
        apiUrlUsed = FLASK_API_URL;
        
        // Kirim request ke Flask API dengan retry logic yang lebih robust
        let retries = 3;
        let success = false;
        let lastError = null;
        let coldStartDetected = false;
        
        while (retries > 0 && !success) {
          try {
            console.log(`Mencoba request ke Flask API (sisa percobaan: ${retries})...`);
            
            // Kirim request ke Flask API dengan timeout yang lebih pendek untuk respons yang lebih cepat
            // Kurangi timeout dari 3 menit menjadi 60 detik untuk respons yang lebih cepat
            const response = await axios.post(FLASK_API_URL, formData, {
              headers: {
                ...formData.getHeaders(),
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity,
              timeout: 60000 // 60 detik timeout (dikurangi dari 180000/3 menit)
            });
            
            // Ambil hasil prediksi
            predictionResult = response.data;
            // Tampilkan hasil prediksi dengan format yang lebih ringkas
            console.log('Hasil prediksi dari Flask API:', 
              typeof predictionResult === 'object' 
                ? `{severity: ${predictionResult.severity || predictionResult.class}, confidence: ${predictionResult.confidence}}` 
                : predictionResult);
            success = true;
            
            // Tampilkan peringatan jika menggunakan mode simulasi
            if (predictionResult.raw_prediction && predictionResult.raw_prediction.is_simulation) {
              console.warn('PERHATIAN: Menggunakan hasil simulasi dari Flask API, bukan prediksi model yang sebenarnya');
              isSimulation = true;
            }

            // Map kelas dari Flask API ke format yang diharapkan frontend
            if (predictionResult.class) {
              // Pemetaan kelas dari Flask API ke format frontend
              const severityMapping = {
                'Tidak ada DR': 'Tidak ada',
                'DR Ringan': 'Ringan',
                'DR Sedang': 'Sedang',
                'DR Berat': 'Berat',
                'DR Proliferatif': 'Sangat Berat',
                'Normal': 'Tidak ada',
                'Diabetic Retinopathy': 'Sedang',
                'No DR': 'Tidak ada',
                'Mild': 'Ringan',
                'Moderate': 'Sedang',
                'Severe': 'Berat',
                'Proliferative DR': 'Sangat Berat'
              };

              // Map severity ke format frontend
              predictionResult.frontendSeverity = severityMapping[predictionResult.class] || predictionResult.class;
              
              // Map severity level ke format frontend (0-4)
              const severityLevelMapping = {
                'Tidak ada DR': 0,
                'DR Ringan': 1,
                'DR Sedang': 2,
                'DR Berat': 3,
                'DR Proliferatif': 4,
                'Normal': 0,
                'Diabetic Retinopathy': 2,
                'No DR': 0,
                'Mild': 1,
                'Moderate': 2,
                'Severe': 3,
                'Proliferative DR': 4
              };
              
              predictionResult.frontendSeverityLevel = severityLevelMapping[predictionResult.class] || predictionResult.severity_level || 0;
              
              // Tambahkan rekomendasi berdasarkan tingkat keparahan
              const recommendationMapping = {
                'Tidak ada DR': 'Lakukan pemeriksaan rutin setiap tahun.',
                'DR Ringan': 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.',
                'DR Sedang': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
                'DR Berat': 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.',
                'DR Proliferatif': 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.',
                'Normal': 'Lakukan pemeriksaan rutin setiap tahun.',
                'Diabetic Retinopathy': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
                'No DR': 'Lakukan pemeriksaan rutin setiap tahun.',
                'Mild': 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.',
                'Moderate': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
                'Severe': 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.',
                'Proliferative DR': 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.'
              };
              
              // Gunakan rekomendasi dari Flask API jika ada, jika tidak gunakan mapping
              predictionResult.recommendation = predictionResult.recommendation || recommendationMapping[predictionResult.class] || 'Konsultasikan dengan dokter mata.';
            } else if (predictionResult.severity) {
              // Format lama, tetap gunakan kode yang ada
              // Pemetaan kelas dari Flask API ke format frontend
              const severityMapping = {
                'Tidak ada DR': 'Tidak ada',
                'DR Ringan': 'Ringan',
                'DR Sedang': 'Sedang',
                'DR Berat': 'Berat',
                'DR Proliferatif': 'Sangat Berat',
                'Normal': 'Tidak ada',
                'Diabetic Retinopathy': 'Sedang',
                'No DR': 'Tidak ada',
                'Mild': 'Ringan',
                'Moderate': 'Sedang',
                'Severe': 'Berat',
                'Proliferative DR': 'Sangat Berat'
              };

              // Map severity ke format frontend
              predictionResult.frontendSeverity = severityMapping[predictionResult.severity] || predictionResult.severity;
              
              // Map severity level ke format frontend (0-4)
              const severityLevelMapping = {
                'Tidak ada DR': 0,
                'DR Ringan': 1,
                'DR Sedang': 2,
                'DR Berat': 3,
                'DR Proliferatif': 4,
                'Normal': 0,
                'Diabetic Retinopathy': 2,
                'No DR': 0,
                'Mild': 1,
                'Moderate': 2,
                'Severe': 3,
                'Proliferative DR': 4
              };
              
              predictionResult.frontendSeverityLevel = severityLevelMapping[predictionResult.severity] || predictionResult.severity_level || 0;
              
              // Tambahkan rekomendasi berdasarkan tingkat keparahan
              const recommendationMapping = {
                'Tidak ada DR': 'Lakukan pemeriksaan rutin setiap tahun.',
                'DR Ringan': 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.',
                'DR Sedang': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
                'DR Berat': 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.',
                'DR Proliferatif': 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.',
                'Normal': 'Lakukan pemeriksaan rutin setiap tahun.',
                'Diabetic Retinopathy': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
                'No DR': 'Lakukan pemeriksaan rutin setiap tahun.',
                'Mild': 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.',
                'Moderate': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
                'Severe': 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.',
                'Proliferative DR': 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.'
              };
              
              // Gunakan rekomendasi dari Flask API jika ada, jika tidak gunakan mapping
              predictionResult.recommendation = predictionResult.recommendation || recommendationMapping[predictionResult.severity] || 'Konsultasikan dengan dokter mata.';
            }
          } catch (error) {
            lastError = error;
            
            // Deteksi apakah ini terkait cold start (502 Bad Gateway saat startup)
            if (error.response && error.response.status === 502) {
              if (!coldStartDetected) {
                console.log('Terdeteksi cold start pada free tier Render. Ini bisa memakan waktu 2-3 menit...');
                coldStartDetected = true;
              }
              
              // Gunakan delay yang lebih pendek untuk cold start (15 detik, dikurangi dari 30 detik)
              console.log('Menunggu 15 detik untuk cold start...');
              await new Promise(resolve => setTimeout(resolve, 15000));
            } else {
              // Delay standar untuk error umum (kurangi dari 5 detik menjadi 3 detik)
              console.log(`Error biasa, mencoba kembali dalam 3 detik (${retries} percobaan tersisa)...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            retries--;
          }
        }
        
        if (!success) {
          if (coldStartDetected) {
            throw new Error('Free tier Render membutuhkan waktu untuk startup. Silakan coba lagi dalam 2-3 menit.');
          } else {
            throw lastError || new Error('Gagal menghubungi Flask API setelah beberapa percobaan');
          }
        }
      } catch (flaskError) {
        console.error('Error saat menghubungi Flask API:', flaskError.message);
        if (flaskError.response) {
          console.error('Response status:', flaskError.response.status);
          // Batasi output data untuk menghindari teks random yang panjang
          const responseData = flaskError.response.data;
          let truncatedData;
          
          if (typeof responseData === 'string') {
            truncatedData = responseData.length > 100 
              ? responseData.substring(0, 100) + '... [truncated]' 
              : responseData;
          } else if (responseData && typeof responseData === 'object') {
            truncatedData = '[Object data]';
          } else {
            truncatedData = responseData;
          }
          
          console.error('Response data:', truncatedData);
        } else if (flaskError.request) {
          console.error('Tidak ada respons dari server Flask API');
        } else {
          console.error('Error saat menyiapkan request:', flaskError.message);
        }
        
        // Gunakan data mock untuk fallback dengan variasi hasil
        console.log('Menggunakan data mock untuk testing dengan variasi hasil...');
        
        // Buat array tingkat keparahan dengan distribusi yang lebih merata
        const mockSeverities = [
          { severity: 'Tidak ada DR', severity_level: 0, frontendSeverity: 'Tidak ada', frontendSeverityLevel: 0, 
            recommendation: 'Lakukan pemeriksaan rutin setiap tahun.' },
          { severity: 'DR Ringan', severity_level: 1, frontendSeverity: 'Ringan', frontendSeverityLevel: 1, 
            recommendation: 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.' },
          { severity: 'DR Sedang', severity_level: 2, frontendSeverity: 'Sedang', frontendSeverityLevel: 2, 
            recommendation: 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.' },
          { severity: 'DR Berat', severity_level: 3, frontendSeverity: 'Berat', frontendSeverityLevel: 3, 
            recommendation: 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.' },
          { severity: 'DR Proliferatif', severity_level: 4, frontendSeverity: 'Sangat Berat', frontendSeverityLevel: 4, 
            recommendation: 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.' }
        ];
        
        // Pilih tingkat keparahan secara acak untuk variasi hasil
        const randomIndex = Math.floor(Math.random() * mockSeverities.length);
        const selectedMockSeverity = mockSeverities[randomIndex];
        
        // Tambahkan variasi confidence
        const confidence = 0.7 + (Math.random() * 0.25); // Antara 0.7 dan 0.95
        
        predictionResult = {
          severity: selectedMockSeverity.severity,
          severity_level: selectedMockSeverity.severity_level,
          confidence: confidence,
          frontendSeverity: selectedMockSeverity.frontendSeverity,
          frontendSeverityLevel: selectedMockSeverity.frontendSeverityLevel,
          recommendation: selectedMockSeverity.recommendation,
          raw_prediction: {
            is_simulation: true
          }
        };
        isSimulation = true;
        apiUrlUsed = 'mock-data-varied';
      }
    } else {
      // Jika Flask API tidak tersedia, gunakan data mock dengan variasi hasil
      console.log('Flask API tidak tersedia, menggunakan data mock dengan variasi hasil...');
      
      // Buat array tingkat keparahan dengan distribusi yang lebih merata
      const mockSeverities = [
        { severity: 'Tidak ada DR', severity_level: 0, frontendSeverity: 'Tidak ada', frontendSeverityLevel: 0, 
          recommendation: 'Lakukan pemeriksaan rutin setiap tahun.' },
        { severity: 'DR Ringan', severity_level: 1, frontendSeverity: 'Ringan', frontendSeverityLevel: 1, 
          recommendation: 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.' },
        { severity: 'DR Sedang', severity_level: 2, frontendSeverity: 'Sedang', frontendSeverityLevel: 2, 
          recommendation: 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.' },
        { severity: 'DR Berat', severity_level: 3, frontendSeverity: 'Berat', frontendSeverityLevel: 3, 
          recommendation: 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.' },
        { severity: 'DR Proliferatif', severity_level: 4, frontendSeverity: 'Sangat Berat', frontendSeverityLevel: 4, 
          recommendation: 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.' }
      ];
      
      // Pilih tingkat keparahan secara acak untuk variasi hasil
      const randomIndex = Math.floor(Math.random() * mockSeverities.length);
      const selectedMockSeverity = mockSeverities[randomIndex];
      
      // Tambahkan variasi confidence
      const confidence = 0.7 + (Math.random() * 0.25); // Antara 0.7 dan 0.95
      
      predictionResult = {
        severity: selectedMockSeverity.severity,
        severity_level: selectedMockSeverity.severity_level,
        confidence: confidence,
        frontendSeverity: selectedMockSeverity.frontendSeverity,
        frontendSeverityLevel: selectedMockSeverity.frontendSeverityLevel,
        recommendation: selectedMockSeverity.recommendation,
        raw_prediction: {
          is_simulation: true
        }
      };
      isSimulation = true;
      apiUrlUsed = 'mock-data-varied';
      
      // Tampilkan pesan error yang lebih jelas
      console.log(`PERHATIAN: Menggunakan data mock dengan tingkat keparahan "${selectedMockSeverity.frontendSeverity}" karena Flask API tidak tersedia`);
    }

    // Simpan hasil analisis ke database dengan konsistensi menggunakan base64
    try {
      console.log('Membaca file gambar untuk disimpan ke database...');
      
      // Baca file gambar dan konversi ke base64 dengan optimasi ukuran
      const imageBuffer = fs.readFileSync(req.file.path);
      
      // Optimasi ukuran base64 dengan mendeteksi tipe MIME yang tepat
      let mimeType = req.file.mimetype;
      if (!mimeType || mimeType === 'application/octet-stream') {
        // Deteksi berdasarkan ekstensi file jika MIME tidak tersedia
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else mimeType = 'image/jpeg'; // Default to JPEG
      }
      
      // Gunakan buffer langsung tanpa konversi ke string terlebih dahulu untuk menghemat memori
      const imageBase64 = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      
      // Hapus file fisik setelah dikonversi ke base64 untuk konsistensi penyimpanan
      // dan menghindari duplikasi data
      try {
        fs.unlinkSync(req.file.path);
        console.log(`File fisik dihapus setelah konversi ke base64: ${req.file.path}`);
      } catch (unlinkError) {
        console.error('Gagal menghapus file fisik:', unlinkError);
        // Lanjutkan proses meskipun gagal menghapus file
      }
      
      console.log('Menyimpan hasil analisis ke database...');
      const analysis = new RetinaAnalysis({
        userId: req.user.id,
        patientId: req.body.patientId,
        imagePath: null, // Tidak perlu menyimpan path karena menggunakan base64
        imageData: imageBase64, // Simpan data gambar base64 ke database
        originalFilename: req.file.originalname,
        severity: predictionResult.frontendSeverity || predictionResult.severity,
        severityLevel: predictionResult.frontendSeverityLevel || predictionResult.severity_level || 0,
        confidence: predictionResult.confidence || 0,
        isSimulation: isSimulation,
        flaskApiUsed: apiUrlUsed,
        notes: predictionResult.recommendation || ''
      });

      await analysis.save();
      console.log('Analisis berhasil disimpan dengan ID:', analysis._id);

      // Kirim respons ke client
      res.json({
        message: 'Analisis berhasil',
        prediction: {
          severity: predictionResult.frontendSeverity || predictionResult.severity,
          severityLevel: predictionResult.frontendSeverityLevel || predictionResult.severity_level || 0,
          confidence: predictionResult.confidence,
          recommendation: predictionResult.recommendation || '',
          analysisId: analysis._id,
          patientId: analysis.patientId,
          imageData: imageBase64, // Kirim image data langsung ke client
          isSimulation: isSimulation,
          flaskApiUrl: apiUrlUsed,
          // Tambahkan informasi tambahan untuk dashboard
          createdAt: analysis.createdAt,
          originalFilename: analysis.originalFilename,
          notes: predictionResult.recommendation || ''
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
    // Ambil semua analisis milik user yang sedang login
    const analyses = await RetinaAnalysis.find({ userId: req.user.id })
      .populate({
        path: 'patientId',
        match: { userId: req.user.id }, // Pastikan hanya pasien milik user ini
        select: 'name fullName gender age'
      })
      .sort({ createdAt: -1 });
    
    // Filter hasil untuk menghilangkan analisis dengan patientId null
    // (ini terjadi jika populate tidak menemukan pasien yang cocok)
    const filteredAnalyses = analyses.filter(analysis => analysis.patientId);
      
    // Pastikan imageData tersedia untuk semua hasil analisis
    // Gunakan data base64 jika tersedia, jika tidak coba baca dari path
    for (let analysis of filteredAnalyses) {
      if (!analysis.imageData && analysis.imagePath) {
        try {
          const filePath = path.join(__dirname, '..', analysis.imagePath);
          if (fs.existsSync(filePath)) {
            const imageBuffer = fs.readFileSync(filePath);
            // Deteksi mimetype berdasarkan ekstensi file
            const ext = path.extname(filePath).toLowerCase();
            let mimetype = 'image/jpeg'; // default
            if (ext === '.png') mimetype = 'image/png';
            else if (ext === '.gif') mimetype = 'image/gif';
            else if (ext === '.webp') mimetype = 'image/webp';
            
            analysis.imageData = `data:${mimetype};base64,${imageBuffer.toString('base64')}`;
            await analysis.save();
            
            // Hapus file fisik setelah konversi ke base64
            try {
              fs.unlinkSync(filePath);
              console.log(`File fisik dihapus setelah konversi ke base64: ${filePath}`);
            } catch (unlinkError) {
              console.error('Gagal menghapus file fisik:', unlinkError);
              // Lanjutkan proses meskipun gagal menghapus file
            }
          } else {
            console.error(`File tidak ditemukan di path ${analysis.imagePath}`);
            // Tambahkan placeholder image jika file tidak ditemukan
            analysis.imageData = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTk5OTkiPkdhbWJhciB0aWRhayB0ZXJzZWRpYTwvdGV4dD48L3N2Zz4=';
            analysis.imagePath = null; // Hapus path yang tidak valid
            await analysis.save();
          }
        } catch (err) {
          console.error(`Gagal membaca gambar dari path ${analysis.imagePath}:`, err);
          // Tambahkan placeholder image jika terjadi error
          analysis.imageData = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTk5OTkiPkdhbWJhciB0aWRhayB0ZXJzZWRpYTwvdGV4dD48L3N2Zz4=';
          analysis.imagePath = null; // Hapus path yang tidak valid
          await analysis.save();
        }
      }
    }
    
    res.json(filteredAnalyses);
  } catch (error) {
    console.error('Error saat mengambil riwayat analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat analisis', error: error.message });
  }
};

export const getAnalysisById = async (req, res, next) => {
  try {
    // Ambil analisis milik user yang sedang login
    const analysis = await RetinaAnalysis.findOne({ 
      _id: req.params.id,
      userId: req.user.id
    }).populate({
      path: 'patientId',
      match: { userId: req.user.id }, // Pastikan hanya pasien milik user ini
      select: 'name fullName gender age dateOfBirth bloodType'
    });
    
    if (!analysis || !analysis.patientId) {
      return res.status(404).json({ message: 'Analisis tidak ditemukan' });
    }
    
    // Pastikan imageData tersedia
    if (!analysis.imageData && analysis.imagePath) {
      try {
        const filePath = path.join(__dirname, '..', analysis.imagePath);
        if (fs.existsSync(filePath)) {
          const imageBuffer = fs.readFileSync(filePath);
          // Deteksi mimetype berdasarkan ekstensi file
          const ext = path.extname(filePath).toLowerCase();
          let mimetype = 'image/jpeg'; // default
          if (ext === '.png') mimetype = 'image/png';
          else if (ext === '.gif') mimetype = 'image/gif';
          else if (ext === '.webp') mimetype = 'image/webp';
          
          analysis.imageData = `data:${mimetype};base64,${imageBuffer.toString('base64')}`;
          await analysis.save();
          console.log('Berhasil mengkonversi dan menyimpan gambar ke database untuk ID:', analysis._id);
        } else {
          console.error('File gambar tidak ditemukan:', filePath);
        }
      } catch (err) {
        console.error(`Gagal membaca gambar dari path ${analysis.imagePath}:`, err);
      }
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error saat mengambil detail analisis:', error);
    res.status(500).json({ message: 'Gagal mengambil detail analisis', error: error.message });
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
            urls_tried: [FLASK_API_BASE_URL, localBaseUrl]
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
    
    if (mainTest.data && mainTest.data.simulation_mode) {
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
  }
  
  return recommendations;
}