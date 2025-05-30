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
    
    // Tahun saat ini untuk copyright
    const currentYear = new Date().getFullYear();
    
    // Buat template HTML dengan desain yang lebih modern
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password RetinaScan</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7ff; color: #333;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="padding: 30px 0;">
              <table align="center" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <!-- Header -->
                <tr>
                  <td style="background-image: linear-gradient(to right, #4F46E5, #7C3AED); padding: 30px 40px; text-align: center;">
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">
                      <img src="https://i.ibb.co/DMQdS5F/eye-icon.png" alt="RetinaScan" width="40" style="vertical-align: middle; margin-right: 10px;">
                      RetinaScan
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 40px 30px;">
                    <h2 style="margin: 0 0 20px; color: #1F2937; font-size: 24px; font-weight: 700;">Reset Kata Sandi</h2>
                    
                    <p style="margin: 0 0 20px; color: #4B5563; line-height: 1.6; font-size: 16px;">
                      Halo <strong>${data.to_name || 'Pengguna'}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 20px; color: #4B5563; line-height: 1.6; font-size: 16px;">
                      Kami menerima permintaan untuk mereset kata sandi akun RetinaScan Anda. Gunakan kode verifikasi berikut untuk melanjutkan proses reset kata sandi:
                    </p>
                    
                    <!-- Verification Code Box -->
                    <div style="background-color: #F3F4F6; border: 1px dashed #D1D5DB; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                      <p style="margin: 0 0 10px; color: #6B7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Kode Verifikasi</p>
                      <div style="font-family: 'Courier New', monospace; font-size: 32px; letter-spacing: 5px; font-weight: 700; color: #4F46E5; background: linear-gradient(to right, #4F46E5, #7C3AED); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        ${data.reset_token}
                      </div>
                    </div>
                    
                    <p style="margin: 0 0 30px; color: #4B5563; line-height: 1.6; font-size: 16px;">
                      Kode ini akan kedaluwarsa dalam 10 menit. Jika Anda tidak membuat permintaan ini, abaikan email ini dan kata sandi Anda tidak akan berubah.
                    </p>
                    
                    <!-- Button -->
                    <div style="text-align: center;">
                      <a href="${data.reset_link}" style="display: inline-block; background-image: linear-gradient(to right, #4F46E5, #7C3AED); color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: all 0.3s ease;">
                        Reset Kata Sandi
                      </a>
                    </div>
                    
                    <p style="margin: 30px 0 0; color: #6B7280; line-height: 1.6; font-size: 14px; border-top: 1px solid #E5E7EB; padding-top: 20px;">
                      Jika tombol di atas tidak berfungsi, Anda dapat menyalin dan menempelkan tautan berikut ke browser Anda:
                    </p>
                    
                    <p style="margin: 10px 0 0; color: #4F46E5; line-height: 1.4; font-size: 14px; word-break: break-all;">
                      ${data.reset_link}
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #F9FAFB; padding: 30px 40px; text-align: center; border-top: 1px solid #E5E7EB;">
                    <p style="margin: 0 0 10px; color: #6B7280; font-size: 14px;">
                      Email ini dikirim secara otomatis, mohon jangan membalas email ini.
                    </p>
                    <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                      &copy; ${currentYear} RetinaScan. Semua hak dilindungi.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    // Text version sebagai fallback
    const textContent = `
      RETINASCAN - RESET KATA SANDI
      
      Halo ${data.to_name || 'Pengguna'},
      
      Kami menerima permintaan untuk mereset kata sandi akun RetinaScan Anda.
      
      Kode verifikasi Anda: ${data.reset_token}
      
      Kode ini akan kedaluwarsa dalam 10 menit.
      
      Anda juga dapat mengakses tautan berikut untuk mereset kata sandi:
      ${data.reset_link}
      
      Jika Anda tidak membuat permintaan ini, abaikan email ini dan kata sandi Anda tidak akan berubah.
      
      -------
      Email ini dikirim secara otomatis, mohon jangan membalas email ini.
      © ${currentYear} RetinaScan. Semua hak dilindungi.
    `;
    
    // Kirim email
    const info = await transporter.sendMail({
      from: `"RetinaScan" <${process.env.EMAIL_USER || 'noreply@retinascan.com'}>`,
      to: data.to_email,
      subject: 'Reset Kata Sandi RetinaScan',
      html: htmlContent,
      text: textContent,
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
      // Tambahkan tahun saat ini untuk footer
      current_year: new Date().getFullYear().toString(),
      // Parameter tambahan yang mungkin diperlukan oleh template
      reply_to: data.to_email,
      from_name: 'RetinaScan',
      subject: 'Reset Kata Sandi RetinaScan',
      message: `Gunakan kode verifikasi ${data.reset_token} atau klik link berikut untuk reset kata sandi Anda: ${data.reset_link}`,
      logo_url: 'https://i.ibb.co/DMQdS5F/eye-icon.png',
      header_color: '#4F46E5',
      button_color: '#4F46E5',
      accent_color: '#7C3AED',
      background_color: '#f4f7ff',
      text_color: '#333333',
      expires_in: '10 menit',
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
 * @param {string} baseUrl - URL dasar (opsional)
 * @returns {string} - Link reset password lengkap
 */
export const createResetPasswordLink = (token, baseUrl = process.env.FRONTEND_URL || 'https://retinascan.onrender.com') => {
  return `${baseUrl}/#/reset-password?code=${token}`;
};

export default {
  initEmailJS,
  sendResetPasswordEmail,
  sendResetPasswordEmailWithNodemailer,
  createResetPasswordLink,
}; 