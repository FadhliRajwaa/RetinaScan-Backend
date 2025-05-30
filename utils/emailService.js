import dotenv from 'dotenv';
import emailjs from '@emailjs/nodejs';
import nodemailer from 'nodemailer';

// Konfigurasi environment variables
dotenv.config();

// Konfigurasi EmailJS
const SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'Email_Fadhli_ID';
const TEMPLATE_ID_RESET = process.env.EMAILJS_RESET_TEMPLATE_ID || 'template_j9rj1wu';
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY || '';

/**
 * Inisialisasi EmailJS
 */
export const initEmailJS = () => {
  try {
    console.log('Menginisialisasi EmailJS dengan konfigurasi:');
    console.log('- Service ID:', SERVICE_ID);
    console.log('- Template Reset ID:', TEMPLATE_ID_RESET);
    console.log('- Public Key:', PUBLIC_KEY ? 'Terisi' : 'Tidak terisi');
    console.log('- Private Key:', PRIVATE_KEY ? 'Terisi' : 'Tidak terisi');
    
    // Inisialisasi SDK EmailJS
    emailjs.init({
      publicKey: PUBLIC_KEY,
      privateKey: PRIVATE_KEY, // Kunci private diperlukan untuk server-side
    });
    
    console.log('EmailJS berhasil diinisialisasi');
    return true;
  } catch (error) {
    console.error('Gagal menginisialisasi EmailJS:', error);
    return false;
  }
};

/**
 * Membuat transporter Nodemailer sebagai alternatif
 * @returns {Object} - Nodemailer transporter
 */
export const createNodemailerTransporter = () => {
  // Gunakan SMTP gmail sebagai contoh
  // Untuk produksi, sebaiknya gunakan layanan email khusus seperti SendGrid, Mailgun, dll.
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || '', // Alamat email pengirim
      pass: process.env.EMAIL_PASS || '', // Password atau app password
    },
  });
  
  return transporter;
};

/**
 * Mengirim email reset password menggunakan Nodemailer
 * @param {Object} data - Data untuk email reset password
 * @returns {Promise} - Promise hasil pengiriman email
 */
export const sendResetPasswordEmailWithNodemailer = async (data) => {
  // Validasi parameter
  if (!data.to_email) {
    console.error('Email penerima tidak diberikan');
    return {
      success: false,
      message: 'Email penerima tidak diberikan',
      error: new Error('to_email parameter is required'),
    };
  }
  
  try {
    console.log('Mempersiapkan pengiriman email reset password dengan Nodemailer ke:', data.to_email);
    
    const transporter = createNodemailerTransporter();
    
    // Buat template HTML sederhana
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2>RetinaScan</h2>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
          <h2>Reset Password</h2>
          <p>Halo ${data.to_name || 'Pengguna'},</p>
          <p>Kami menerima permintaan untuk mereset password akun RetinaScan Anda. Gunakan tombol di bawah ini untuk melanjutkan:</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.reset_link}" style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p>Atau gunakan kode reset password berikut:</p>
          <div style="background-color: #eee; padding: 10px 15px; border-radius: 4px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 15px 0;">
            ${data.reset_token}
          </div>
          
          <p>Jika Anda tidak membuat permintaan ini, abaikan email ini dan password Anda tidak akan berubah.</p>
        </div>
        
        <div style="font-size: 12px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>Email ini dikirim secara otomatis, mohon jangan membalas email ini.</p>
          <p>&copy; 2023 RetinaScan. Semua hak dilindungi.</p>
        </div>
      </div>
    `;
    
    // Kirim email
    const info = await transporter.sendMail({
      from: `"RetinaScan" <${process.env.EMAIL_USER || 'noreply@retinascan.com'}>`,
      to: data.to_email,
      subject: 'Reset Password RetinaScan',
      html: htmlContent,
      text: `Halo ${data.to_name || 'Pengguna'}, 
      
      Kami menerima permintaan untuk mereset password akun RetinaScan Anda. 
      
      Kode reset password: ${data.reset_token}
      
      Atau klik link berikut untuk mengatur ulang password: ${data.reset_link}
      
      Jika Anda tidak membuat permintaan ini, abaikan email ini dan password Anda tidak akan berubah.
      
      RetinaScan`,
    });
    
    console.log('Email reset password berhasil dikirim dengan Nodemailer:', info.messageId);
    return {
      success: true,
      message: 'Email reset password berhasil dikirim',
      response: info,
    };
  } catch (error) {
    console.error('Error mengirim reset password email dengan Nodemailer:', error.message);
    return {
      success: false,
      message: `Gagal mengirim email reset password: ${error.message}`,
      error,
    };
  }
};

/**
 * Mengirim email reset password menggunakan EmailJS SDK for Node.js
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
  
  try {
    console.log('Mempersiapkan pengiriman email reset password ke:', data.to_email);
    
    // Pastikan semua parameter yang diperlukan tersedia dengan nilai default jika tidak ada
    const templateParams = {
      to_email: data.to_email,
      to_name: data.to_name || 'Pengguna',
      reset_link: data.reset_link || '',
      reset_token: data.reset_token || '',
      app_name: 'RetinaScan',
      // Parameter tambahan yang mungkin diperlukan oleh template
      reply_to: data.to_email,
      from_name: 'RetinaScan',
      subject: 'Reset Password RetinaScan',
      message: `Gunakan link berikut untuk reset password Anda: ${data.reset_link}`,
    };
    
    console.log('Parameter template:', JSON.stringify(templateParams, null, 2));
    
    // Gunakan SDK EmailJS untuk mengirim email
    const response = await emailjs.send(
      SERVICE_ID, 
      TEMPLATE_ID_RESET, 
      templateParams, 
      {
        publicKey: PUBLIC_KEY,
        privateKey: PRIVATE_KEY, // Kunci private diperlukan untuk server-side
      }
    );
    
    console.log('Email reset password berhasil dikirim:', response.status, response.text);
    return {
      success: true,
      message: 'Email reset password berhasil dikirim',
      response: response,
    };
  } catch (emailjsError) {
    console.error('Error mengirim reset password email dengan EmailJS:', emailjsError.message);
    console.error('Detail error EmailJS:', emailjsError);
    
    // Mencoba dengan Nodemailer sebagai fallback
    console.log('Mencoba mengirim email dengan Nodemailer sebagai fallback...');
    try {
      const nodemailerResult = await sendResetPasswordEmailWithNodemailer(data);
      if (nodemailerResult.success) {
        console.log('Email reset password berhasil dikirim dengan Nodemailer');
        return nodemailerResult;
      }
      
      // Jika Nodemailer juga gagal, kembalikan error asli dari EmailJS
      console.error('Nodemailer juga gagal mengirim email. Kembali ke error EmailJS asli');
      
      // Menangani error EmailJS
      let errorMessage = 'Gagal mengirim email reset password';
      
      if (emailjsError.status === 400) {
        errorMessage += ': Parameter tidak valid';
      } else if (emailjsError.status === 401 || emailjsError.status === 403) {
        errorMessage += ': Masalah autentikasi dengan layanan email';
        console.error('CATATAN: Pastikan opsi "Allow EmailJS API for non-browser applications" sudah diaktifkan di dashboard EmailJS (Account -> Security)');
      } else if (emailjsError.status === 422) {
        errorMessage += ': Parameter tidak lengkap';
        console.error('CATATAN: Pastikan template EmailJS dikonfigurasi dengan benar dan semua variabel yang diperlukan telah disediakan');
      } else if (emailjsError.status >= 500) {
        errorMessage += ': Layanan email sedang mengalami masalah';
      }
      
      return {
        success: false,
        message: errorMessage,
        error: emailjsError,
      };
    } catch (nodemailerError) {
      console.error('Error mengirim reset password email dengan Nodemailer:', nodemailerError.message);
      return {
        success: false,
        message: 'Gagal mengirim email dengan kedua metode',
        errors: {
          emailjs: emailjsError,
          nodemailer: nodemailerError
        }
      };
    }
  }
};

/**
 * Membuat link reset password dengan token
 * @param {string} token - Token reset password
 * @param {string} baseUrl - Base URL aplikasi frontend
 * @returns {string} - Link reset password lengkap
 */
export const createResetPasswordLink = (token, baseUrl = process.env.FRONTEND_URL || 'https://retinascan.onrender.com') => {
  // Pastikan URL yang dibuat sesuai dengan route di React frontend
  return `${baseUrl}/#/reset-password?code=${token}`;
};

export default {
  initEmailJS,
  sendResetPasswordEmail,
  sendResetPasswordEmailWithNodemailer,
  createResetPasswordLink,
}; 