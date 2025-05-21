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
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Email atau kata sandi salah' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
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