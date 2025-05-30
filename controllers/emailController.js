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
    
    // Siapkan data untuk email
    const resetLink = createResetPasswordLink(resetCode);
    
    // Kirim email dengan parameter yang sesuai dengan template EmailJS
    const result = await sendResetPasswordEmail({
      to_email: email,
      to_name: user.name || email.split('@')[0],
      reset_link: resetLink,
      reset_token: resetCode
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
      error: error.message
    });
  }
}; 