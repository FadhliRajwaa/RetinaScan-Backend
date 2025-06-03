import express from 'express';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification, 
  deleteAllNotifications,
  createNotification
} from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Semua routes memerlukan autentikasi
router.use(authMiddleware);

// Route untuk mendapatkan semua notifikasi user
router.get('/', getNotifications);

// Route untuk menandai notifikasi sebagai dibaca
router.patch('/:notificationId/read', markAsRead);

// Route untuk menandai semua notifikasi sebagai dibaca
router.patch('/read-all', markAllAsRead);

// Route untuk menghapus notifikasi
router.delete('/:notificationId', deleteNotification);

// Route untuk menghapus semua notifikasi
router.delete('/', deleteAllNotifications);

// Route untuk membuat notifikasi (hanya untuk penggunaan internal/testing)
router.post('/', (req, res) => {
  const io = req.app.get('io');
  createNotification(req, res, io);
});

export default router; 