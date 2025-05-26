import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Daftar semua URL Flask API yang mungkin
const FLASK_API_URLS = [
  process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com',
  'https://retinopathy-api.onrender.com',
  'https://retinascan-flask-api.onrender.com',
  'http://localhost:5001',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://192.168.100.7:5000'
];

// Lokasi gambar sampel untuk pengujian
const SAMPLE_IMAGE_PATH = path.join(__dirname, '../uploads/sample-retina.jpg');
const FALLBACK_IMAGE_PATH = path.join(__dirname, '../uploads/sample-image.jpg');

// Fungsi untuk menguji satu URL
async function testUrl(url) {
  console.log(`Testing ${url}...`);
  
  try {
    const infoUrl = `${url}/`;
    const start = Date.now();
    const response = await axios.get(infoUrl, { timeout: 10000 });
    const end = Date.now();
    
    console.log(`✅ Success! Response time: ${end - start}ms`);
    console.log(`Status: ${response.status}`);
    console.log(`API Version: ${response.data.api_version || 'N/A'}`);
    console.log(`Model Loaded: ${response.data.model_loaded || 'N/A'}`);
    console.log(`Simulation Mode: ${response.data.simulation_mode_enabled || false}`);
    console.log('----------------------------');
    
    return {
      url,
      success: true,
      responseTime: end - start,
      data: response.data,
      simulation: response.data.simulation_mode_enabled || false
    };
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    console.log('----------------------------');
    
    return {
      url,
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

// Fungsi untuk menguji prediksi dengan gambar sampel
async function testPrediction(url) {
  console.log(`Testing prediction at ${url}/predict...`);
  
  try {
    // Tentukan path gambar yang akan digunakan
    let imagePath = SAMPLE_IMAGE_PATH;
    if (!fs.existsSync(imagePath)) {
      console.log(`Sample image not found at ${imagePath}, trying fallback...`);
      imagePath = FALLBACK_IMAGE_PATH;
      
      if (!fs.existsSync(imagePath)) {
        console.log(`Fallback image not found at ${imagePath}, skipping prediction test.`);
        return {
          success: false,
          error: 'Sample image not found',
          url
        };
      }
    }
    
    // Buat form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(imagePath));
    
    // Kirim request
    const start = Date.now();
    const response = await axios.post(`${url}/predict`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000 // 30 second timeout for prediction
    });
    const end = Date.now();
    
    console.log(`✅ Prediction successful! Response time: ${end - start}ms`);
    console.log(`Class: ${response.data.class}`);
    console.log(`Confidence: ${response.data.confidence}`);
    console.log(`Simulation: ${response.data.simulation_mode || false}`);
    console.log('----------------------------');
    
    return {
      url,
      success: true,
      responseTime: end - start,
      data: response.data,
      simulation: response.data.simulation_mode || false
    };
  } catch (error) {
    console.log(`❌ Prediction failed: ${error.message}`);
    console.log('----------------------------');
    
    return {
      url,
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

// Fungsi untuk menguji semua URL dengan pengujian yang komprehensif
async function testAllUrls() {
  console.log('FLASK API CONNECTION TEST');
  console.log('========================');
  console.log(`Environment FLASK_API_URL: ${process.env.FLASK_API_URL || '(not set)'}`);
  console.log(`Current working directory: ${process.cwd()}`);
  console.log('Testing all possible URLs...\n');
  
  const results = [];
  for (const url of FLASK_API_URLS) {
    const infoResult = await testUrl(url);
    results.push(infoResult);
    
    // Jika info endpoint berhasil, lakukan pengujian prediksi
    if (infoResult.success) {
      const predictionResult = await testPrediction(url);
      infoResult.predictionTest = predictionResult;
    }
  }
  
  const successful = results.filter(r => r.success);
  const nonSimulationResults = successful.filter(r => !r.simulation);
  
  console.log('\nSUMMARY');
  console.log('=======');
  console.log(`Total URLs tested: ${results.length}`);
  console.log(`Successful connections: ${successful.length}`);
  console.log(`Failed connections: ${results.length - successful.length}`);
  console.log(`Connections with real model (non-simulation): ${nonSimulationResults.length}`);
  
  if (successful.length > 0) {
    console.log('\nWorking URLs:');
    successful.forEach(r => {
      const simStatus = r.simulation ? ' (SIMULATION MODE)' : '';
      const predStatus = r.predictionTest?.success ? ' [Prediction OK]' : ' [Prediction Failed]';
      console.log(`- ${r.url} (${r.responseTime}ms)${simStatus}${predStatus}`);
    });
    
    // Mencari URL terbaik dengan prioritas:
    // 1. Non-simulasi dengan prediksi berhasil
    // 2. Jika tidak ada, gunakan simulasi dengan prediksi berhasil
    // 3. Jika tidak ada, gunakan yang terhubung paling cepat
    
    const bestNonSimResults = nonSimulationResults
      .filter(r => r.predictionTest?.success)
      .sort((a, b) => a.responseTime - b.responseTime);
    
    const bestSimResults = successful
      .filter(r => r.simulation && r.predictionTest?.success)
      .sort((a, b) => a.responseTime - b.responseTime);
    
    const fastestResults = successful
      .sort((a, b) => a.responseTime - b.responseTime);
    
    let recommended;
    if (bestNonSimResults.length > 0) {
      recommended = bestNonSimResults[0];
      console.log('\n✅ RECOMMENDED: URL with real model (non-simulation)');
    } else if (bestSimResults.length > 0) {
      recommended = bestSimResults[0];
      console.log('\n⚠️ RECOMMENDED: URL with simulation mode (real model not available)');
    } else {
      recommended = fastestResults[0];
      console.log('\n⚠️ RECOMMENDED: Fastest responding URL (prediction may not work)');
    }
    
    console.log(`Recommended URL for FLASK_API_URL: ${recommended.url}`);
    console.log('Add this to your .env file:');
    console.log(`FLASK_API_URL=${recommended.url}`);
    
    if (recommended.simulation) {
      console.log('\n⚠️ WARNING: All APIs are running in simulation mode.');
      console.log('This means predictions will be random and not use the actual ML model.');
      console.log('To use real predictions, ensure the Flask API is running with:');
      console.log('SIMULATION_MODE_ENABLED=false');
    }
  } else {
    console.log('\n❌ No working URLs found. Make sure Flask API is running.');
    console.log('Try these troubleshooting steps:');
    console.log('1. Check if the Flask API service is running');
    console.log('2. Verify network connectivity to the Flask API service');
    console.log('3. Try running the Flask API locally with "python app.py"');
  }
  
  // Memberikan kode keluaran untuk digunakan dalam skrip
  if (successful.length === 0) {
    process.exitCode = 1; // Error - no working URLs
  } else if (nonSimulationResults.length === 0) {
    process.exitCode = 2; // Warning - only simulation mode available
  } else {
    process.exitCode = 0; // Success - real model available
  }
}

// Jalankan tes
testAllUrls().catch(error => {
  console.error('Error during testing:', error);
  process.exitCode = 1;
}); 