import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const register = async (req, res, next) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'Email sudah terdaftar' });
    user = new User({ name, email, password });
    await user.save();
    res.status(201).json({ message: 'Registrasi berhasil' });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  const { email, password } = req.body;
  
  // Validasi input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan kata sandi diperlukan' });
  }
  
  // Validasi format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Format email tidak valid' });
  }
  
  try {
    // Tambahkan rate limiting sederhana (implementasi lengkap memerlukan Redis atau solusi lain)
    // Ini hanya contoh sederhana
    const loginAttempts = global.loginAttempts || {};
    const ipAddress = req.ip || 'unknown';
    const now = Date.now();
    
    // Bersihkan entri lama (lebih dari 15 menit)
    Object.keys(loginAttempts).forEach(ip => {
      if (now - loginAttempts[ip].timestamp > 15 * 60 * 1000) {
        delete loginAttempts[ip];
      }
    });
    
    // Periksa jumlah percobaan
    if (loginAttempts[ipAddress] && loginAttempts[ipAddress].count >= 5 && 
        now - loginAttempts[ipAddress].timestamp < 15 * 60 * 1000) {
      return res.status(429).json({ 
        message: 'Terlalu banyak percobaan login. Coba lagi nanti.',
        retryAfter: Math.ceil((loginAttempts[ipAddress].timestamp + 15 * 60 * 1000 - now) / 1000)
      });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      // Catat percobaan login yang gagal
      if (!loginAttempts[ipAddress]) {
        loginAttempts[ipAddress] = { count: 1, timestamp: now };
      } else {
        loginAttempts[ipAddress].count++;
        loginAttempts[ipAddress].timestamp = now;
      }
      global.loginAttempts = loginAttempts;
      
      return res.status(401).json({ message: 'Email atau kata sandi salah' });
    }
    
    // Reset percobaan login jika berhasil
    if (loginAttempts[ipAddress]) {
      delete loginAttempts[ipAddress];
      global.loginAttempts = loginAttempts;
    }
    
    // Buat token dengan expiry yang lebih pendek dan tambahkan informasi penting
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        iat: Math.floor(Date.now() / 1000)
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        fullName: user.fullName || user.name
      },
      expiresIn: 86400 // 24 jam dalam detik
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    // Cek apakah ada kode verifikasi yang masih valid
    if (user.resetPasswordCode && user.resetPasswordExpires > Date.now()) {
      console.log(`Existing reset code for ${email} is still valid: ${user.resetPasswordCode}`);
      return res.json({ message: 'Kode verifikasi yang masih valid telah ditemukan.', resetCode: user.resetPasswordCode });
    }

    // Generate kode verifikasi 6 digit
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Generated reset code for ${email}: ${resetCode}`);
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Kedaluwarsa dalam 10 menit
    await user.save();
    console.log(`Saved reset code for ${email}: ${user.resetPasswordCode}, expires at ${user.resetPasswordExpires}`);

    res.json({ message: 'Kode verifikasi telah dibuat.', resetCode });
  } catch (error) {
    console.error('Gagal membuat kode verifikasi:', error.message);
    res.status(500).json({ message: 'Gagal membuat kode verifikasi. Silakan coba lagi nanti.' });
  }
};

export const resetPassword = async (req, res, next) => {
  const { resetCode, password } = req.body;
  try {
    console.log(`Received reset code: ${resetCode}, password: ${password}`);
    const user = await User.findOne({
      resetPasswordCode: resetCode,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log('No user found with matching reset code or code has expired');
      return res.status(400).json({ message: 'Kode verifikasi tidak valid atau telah kedaluwarsa' });
    }

    console.log(`Found user: ${user.email}, resetting password`);
    user.password = password;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    console.log(`Password reset successful for user ${user.email}`);

    res.json({ message: 'Kata sandi berhasil diatur ulang' });
  } catch (error) {
    console.error('Gagal mengatur ulang kata sandi:', error.message);
    res.status(500).json({ message: 'Gagal mengatur ulang kata sandi. Silakan coba lagi.' });
  }
};