import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Akses ditolak. Tidak ada token.' });
  
  // Pastikan JWT_SECRET tersedia
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET tidak dikonfigurasi!');
    return res.status(500).json({ message: 'Konfigurasi server tidak valid.' });
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    // Tambahkan validasi tambahan
    if (!decoded.id) {
      return res.status(401).json({ message: 'Token tidak valid (missing id)' });
    }
    
    // Tambahkan timestamp untuk logging
    console.log(`[${new Date().toISOString()}] User ${decoded.id} mengakses API`);
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    
    // Berikan pesan error yang lebih spesifik
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token telah kedaluwarsa', code: 'TOKEN_EXPIRED' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token tidak valid', code: 'INVALID_TOKEN' });
    }
    
    res.status(401).json({ message: 'Autentikasi gagal', code: 'AUTH_FAILED' });
  }
};