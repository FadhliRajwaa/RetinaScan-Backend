import emailjs from '@emailjs/browser';
import dotenv from 'dotenv';

// Konfigurasi environment variables
dotenv.config();

// Konfigurasi EmailJS
const SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'Email_Fadhli_ID';
const TEMPLATE_ID_RESET = process.env.EMAILJS_RESET_TEMPLATE_ID || 'template_j9rj1wu';
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';

let isInitialized = false;

/**
 * Inisialisasi EmailJS
 */
export const initEmailJS = () => {
  if (isInitialized) {
    console.log('EmailJS sudah diinisialisasi sebelumnya');
    return;
  }
  
  try {
    console.log('Menginisialisasi EmailJS dengan konfigurasi:');
    console.log('- Service ID:', SERVICE_ID);
    console.log('- Template Reset ID:', TEMPLATE_ID_RESET);
    console.log('- Public Key:', PUBLIC_KEY ? 'Terisi' : 'Tidak terisi');
    
    emailjs.init({
      publicKey: PUBLIC_KEY,
      blockHeadless: false,
      limitRate: {
        throttle: 3000,
      },
    });
    
    isInitialized = true;
    console.log('EmailJS berhasil diinisialisasi');
  } catch (error) {
    console.error('Gagal menginisialisasi EmailJS:', error);
    throw new Error('Gagal menginisialisasi EmailJS: ' + error.message);
  }
};

/**
 * Mengirim email reset password
 * @param {Object} data - Data untuk email reset password
 * @param {string} data.to_email - Email penerima
 * @param {string} data.to_name - Nama penerima
 * @param {string} data.reset_link - Link reset password
 * @param {string} data.reset_token - Token reset password
 * @returns {Promise} - Promise hasil pengiriman email
 */
export const sendResetPasswordEmail = async (data) => {
  if (!isInitialized) {
    try {
      initEmailJS();
    } catch (error) {
      console.error('EmailJS tidak dapat diinisialisasi:', error);
      return {
        success: false,
        message: 'Sistem email tidak dapat diinisialisasi',
        error,
      };
    }
  }
  
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
    
    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID_RESET,
      templateParams
    );

    console.log('Email reset password berhasil dikirim:', response);
    return {
      success: true,
      message: 'Email reset password berhasil dikirim',
      response,
    };
  } catch (error) {
    console.error('Error mengirim reset password email:', error);
    console.error('Error status:', error.status);
    console.error('Error text:', error.text);
    
    let errorMessage = 'Gagal mengirim email reset password';
    
    if (error.status === 400) {
      errorMessage += ': Parameter tidak valid';
    } else if (error.status === 401 || error.status === 403) {
      errorMessage += ': Masalah autentikasi dengan layanan email';
    } else if (error.status === 422) {
      errorMessage += ': ' + (error.text || 'Parameter tidak lengkap');
    } else if (error.status >= 500) {
      errorMessage += ': Layanan email sedang mengalami masalah';
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
export const createResetPasswordLink = (token, baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173') => {
  return `${baseUrl}/#/reset-password?code=${token}`;
};

export default {
  initEmailJS,
  sendResetPasswordEmail,
  createResetPasswordLink,
}; 