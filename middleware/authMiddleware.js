import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    // Mengambil token dari header Authorization
    const authHeader = req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
    if (!token) {
      console.log('Token tidak ditemukan');
      return res.status(401).json({ message: 'Akses ditolak. Tidak ada token.' });
    }
    
    try {
      // Verifikasi token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Tambahkan user ke request
      req.user = decoded;
      
      console.log('Token terverifikasi untuk user ID:', decoded.id);
      next();
    } catch (error) {
      console.error('Token invalid:', error.message);
      res.status(401).json({ message: 'Token tidak valid atau kadaluwarsa' });
    }
  } catch (error) {
    console.error('Error dalam authMiddleware:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};