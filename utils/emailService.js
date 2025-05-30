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
    
    // Dapatkan tahun saat ini secara dinamis
    const currentYear = new Date().getFullYear();
    
    // Buat template HTML modern dengan palet warna yang lebih menarik
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password RetinaScan</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; color: #1f2937;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin-top: 40px; margin-bottom: 40px;">
          <!-- Header -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" style="border-spacing: 0; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 20px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <img src="https://i.ibb.co/7KtHzrD/eye-scan.png" alt="RetinaScan Logo" width="60" style="display: block; margin: 0 auto 10px auto;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">RetinaScan</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 16px;">Pusat Deteksi Retinopati Diabetik</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px 20px 30px;">
              <table width="100%" style="border-spacing: 0;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 25px 0; color: #4f46e5; font-size: 24px; text-align: center;">Reset Password</h2>
                    <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">Halo <strong>${data.to_name || 'Pengguna'}</strong>,</p>
                    <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.5;">Kami menerima permintaan untuk mengatur ulang password akun RetinaScan Anda. Gunakan kode verifikasi berikut untuk menyelesaikan proses reset password:</p>
                  </td>
                </tr>
                
                <!-- Verification Code Box -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 10px 0 30px 0; text-align: center;">
                      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Kode Verifikasi Anda:</p>
                      <div style="font-family: 'Courier New', monospace; background-color: #ffffff; border: 2px solid #4f46e5; border-radius: 8px; color: #4f46e5; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 15px; display: inline-block; min-width: 180px;">
                        ${data.reset_token}
                      </div>
                      <p style="margin: 15px 0 0 0; font-size: 14px; color: #4b5563;">Kode ini berlaku selama 10 menit</p>
                    </div>
                  </td>
                </tr>
                
                <!-- Button -->
                <tr>
                  <td align="center" style="padding: 0;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="border-radius: 8px;" bgcolor="#10b981">
                          <a href="${data.reset_link}" target="_blank" style="display: inline-block; font-size: 16px; font-weight: bold; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ffffff; text-decoration: none; text-align: center; padding: 15px 30px; border-radius: 8px; background-color: #10b981; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Instructions -->
                <tr>
                  <td style="padding: 30px 0 0 0;">
                    <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">Jika Anda tidak dapat mengklik tombol di atas, gunakan link berikut untuk mengatur ulang password:</p>
                    <p style="margin: 0 0 25px 0; font-size: 14px; word-break: break-all; color: #4f46e5;"><a href="${data.reset_link}" style="color: #4f46e5; text-decoration: underline;">${data.reset_link}</a></p>
                    <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">Jika Anda tidak merasa melakukan permintaan ini, abaikan email ini dan password Anda akan tetap aman.</p>
                  </td>
                </tr>
                
                <!-- Security Notice -->
                <tr>
                  <td style="padding: 30px 0 0 0;">
                    <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 15px; margin-bottom: 30px;">
                      <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #1e40af;">
                        <strong>Catatan Keamanan:</strong> RetinaScan tidak pernah meminta password atau informasi pribadi sensitif melalui email.
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 0;">
              <table width="100%" style="border-spacing: 0; background-color: #f3f4f6; text-align: center; padding: 30px 30px;">
                <tr>
                  <td style="padding: 0;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Email ini dikirim secara otomatis, mohon jangan membalas.</p>
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">&copy; ${currentYear} RetinaScan. Semua hak dilindungi.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    // Versi teks plain sebagai fallback
    const textContent = `
Halo ${data.to_name || 'Pengguna'},

Kami menerima permintaan untuk mereset password akun RetinaScan Anda.

KODE VERIFIKASI: ${data.reset_token}

Kode ini berlaku selama 10 menit.

Atau gunakan link berikut untuk mengatur ulang password: 
${data.reset_link}

Jika Anda tidak membuat permintaan ini, abaikan email ini dan password Anda tidak akan berubah.

Catatan Keamanan: RetinaScan tidak pernah meminta password atau informasi pribadi sensitif melalui email.

Email ini dikirim secara otomatis, mohon jangan membalas.

© ${currentYear} RetinaScan. Semua hak dilindungi.
    `;
    
    // Kirim email
    const info = await transporter.sendMail({
      from: `"RetinaScan" <${process.env.EMAIL_USER || 'noreply@retinascan.com'}>`,
      to: data.to_email,
      subject: 'Reset Password RetinaScan',
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
    
    // Dapatkan tahun saat ini secara dinamis
    const currentYear = new Date().getFullYear();
    
    // Pastikan semua parameter yang diperlukan tersedia dengan nilai default jika tidak ada
    const templateParams = {
      to_email: data.to_email,
      to_name: data.to_name || 'Pengguna',
      reset_link: data.reset_link || '',
      reset_token: data.reset_token || '',
      app_name: 'RetinaScan',
      current_year: currentYear.toString(),
      // Parameter tambahan yang mungkin diperlukan oleh template
      reply_to: data.to_email,
      from_name: 'RetinaScan',
      subject: 'Reset Password RetinaScan',
      message: `Gunakan kode verifikasi ${data.reset_token} atau link berikut untuk reset password Anda: ${data.reset_link}`,
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