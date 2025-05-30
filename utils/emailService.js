import dotenv from 'dotenv';
import axios from 'axios';

// Konfigurasi environment variables
dotenv.config();

// Konfigurasi EmailJS
const SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'Email_Fadhli_ID';
const TEMPLATE_ID_RESET = process.env.EMAILJS_RESET_TEMPLATE_ID || 'template_j9rj1wu';
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';

// URL untuk EmailJS API
const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

/**
 * Inisialisasi EmailJS (hanya untuk logging)
 */
export const initEmailJS = () => {
  try {
    console.log('Menginisialisasi EmailJS dengan konfigurasi:');
    console.log('- Service ID:', SERVICE_ID);
    console.log('- Template Reset ID:', TEMPLATE_ID_RESET);
    console.log('- Public Key:', PUBLIC_KEY ? 'Terisi' : 'Tidak terisi');
    console.log('EmailJS berhasil diinisialisasi');
    return true;
  } catch (error) {
    console.error('Gagal menginisialisasi EmailJS:', error);
    return false;
  }
};

/**
 * Mengirim email reset password menggunakan REST API EmailJS
 * @param {Object} data - Data untuk email reset password
 * @param {string} data.to_email - Email penerima
 * @param {string} data.to_name - Nama penerima
 * @param {string} data.reset_link - Link reset password
 * @param {string} data.reset_token - Token reset password
 * @returns {Promise} - Promise hasil pengiriman email
 */
export const sendResetPasswordEmail = async (data) => {
  // Validasi parameter
  if (!data.to_email) {
    console.error('Email penerima tidak diberikan');
    return {
      success: false,
      message: 'Email penerima tidak diberikan',
      error: new Error('to_email parameter is required'),
    };
  }
  
  // Pastikan nama parameter sesuai dengan yang diharapkan oleh template EmailJS
  const templateParams = {
    to_email: data.to_email,
    to_name: data.to_name || 'Pengguna',
    reset_link: data.reset_link,
    reset_token: data.reset_token,
    app_name: 'RetinaScan',
    // Pastikan semua parameter yang diperlukan template EmailJS tersedia
  };
  
  try {
    console.log('Mempersiapkan pengiriman email reset password ke:', data.to_email);
    console.log('Parameter template:', JSON.stringify(templateParams, null, 2));
    
    // Siapkan data request untuk EmailJS API
    const requestData = {
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID_RESET,
      user_id: PUBLIC_KEY,
      template_params: templateParams
    };
    
    console.log('Mengirim request ke EmailJS API:', EMAILJS_API_URL);
    
    // Panggil REST API EmailJS
    const response = await axios.post(EMAILJS_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Email reset password berhasil dikirim:', response.status, response.statusText);
    return {
      success: true,
      message: 'Email reset password berhasil dikirim',
      response: response.data,
    };
  } catch (error) {
    console.error('Error mengirim reset password email:', error.message);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    
    let errorMessage = 'Gagal mengirim email reset password';
    
    if (error.response) {
      if (error.response.status === 400) {
        errorMessage += ': Parameter tidak valid';
      } else if (error.response.status === 401 || error.response.status === 403) {
        errorMessage += ': Masalah autentikasi dengan layanan email';
      } else if (error.response.status === 422) {
        errorMessage += ': ' + (error.response.data?.error || 'Parameter tidak lengkap');
      } else if (error.response.status >= 500) {
        errorMessage += ': Layanan email sedang mengalami masalah';
      }
    }
    
    return {
      success: false,
      message: errorMessage,
      error,
    };
  }
};

/**
 * Membuat link reset password dengan token
 * @param {string} token - Token reset password
 * @param {string} baseUrl - Base URL aplikasi frontend
 * @returns {string} - Link reset password lengkap
 */
export const createResetPasswordLink = (token, baseUrl = process.env.FRONTEND_URL || 'https://retinascan.onrender.com') => {
  return `${baseUrl}/#/reset-password?code=${token}`;
};

export default {
  initEmailJS,
  sendResetPasswordEmail,
  createResetPasswordLink,
}; 