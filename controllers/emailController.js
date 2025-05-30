import { sendResetPasswordEmail, createResetPasswordLink, initEmailJS } from '../utils/emailService.js';
import User from '../models/User.js';

// Inisialisasi EmailJS saat controller dimuat
initEmailJS();

/**
 * Handler untuk mengirim email reset password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const sendResetPasswordEmailHandler = async (req, res) => {
  const { email, resetCode } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email penerima tidak diberikan' 
    });
  }
  
  if (!resetCode) {
    return res.status(400).json({ 
      success: false, 
      message: 'Kode reset password tidak diberikan' 
    });
  }
  
  try {
    // Verifikasi bahwa pengguna dan kode reset valid
    const user = await User.findOne({ 
      email, 
      resetPasswordCode: resetCode,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pengguna tidak ditemukan atau kode reset tidak valid' 
      });
    }
    
    // Gunakan domain render dalam produksi
    const frontendUrl = process.env.NODE_ENV === 'production' 
      ? 'https://retinascan.onrender.com' 
      : process.env.FRONTEND_URL || 'http://localhost:5173';
      
    // Siapkan data untuk email
    const resetLink = createResetPasswordLink(resetCode, frontendUrl);
    
    // Kirim email dengan parameter yang sesuai dengan template EmailJS
    const result = await sendResetPasswordEmail({
      to_email: email,
      to_name: user.name || user.fullName || email.split('@')[0],
      reset_link: resetLink,
      reset_token: resetCode,
      subject: 'Reset Password RetinaScan',
      from_name: 'RetinaScan',
      reply_to: 'noreply@retinascan.com',
      message: `Gunakan kode ${resetCode} atau klik link berikut untuk mengatur ulang password Anda: ${resetLink}`
    });
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Email reset password berhasil dikirim'
      });
    } else {
      console.error('Gagal mengirim email:', result.message);
      
      // Kembalikan kode verifikasi sebagai fallback
      return res.status(500).json({
        success: false,
        message: result.message,
        fallback: true,
        resetCode
      });
    }
  } catch (error) {
    console.error('Error saat mengirim email reset password:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim email reset password',
      error: error.message,
      fallback: true,
      resetCode
    });
  }
}; 