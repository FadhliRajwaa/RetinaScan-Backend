import Notification from '../models/Notification.js';
import mongoose from 'mongoose';
import { verifyToken } from '../middleware/authMiddleware.js';

// Mendapatkan semua notifikasi untuk user yang sedang login
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filter berdasarkan status read jika ada
    const filter = { userId };
    if (req.query.read === 'true') {
      filter.read = true;
    } else if (req.query.read === 'false') {
      filter.read = false;
    }
    
    // Mendapatkan notifikasi dengan pagination
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Mendapatkan total notifikasi untuk pagination
    const total = await Notification.countDocuments(filter);
    
    // Mendapatkan jumlah notifikasi yang belum dibaca
    const unreadCount = await Notification.countUnread(userId);
    
    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil notifikasi' });
  }
};

// Menandai notifikasi sebagai dibaca
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    // Validasi ID notifikasi
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'ID notifikasi tidak valid' });
    }
    
    // Mencari dan memperbarui notifikasi
    const notification = await Notification.findOne({ 
      _id: notificationId,
      userId
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    }
    
    // Menandai sebagai dibaca
    notification.read = true;
    await notification.save();
    
    // Mendapatkan jumlah notifikasi yang belum dibaca
    const unreadCount = await Notification.countUnread(userId);
    
    res.json({ 
      message: 'Notifikasi ditandai sebagai dibaca',
      notification,
      unreadCount
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui notifikasi' });
  }
};

// Menandai semua notifikasi sebagai dibaca
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Memperbarui semua notifikasi yang belum dibaca
    await Notification.markAllAsRead(userId);
    
    res.json({ 
      message: 'Semua notifikasi ditandai sebagai dibaca',
      unreadCount: 0
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui notifikasi' });
  }
};

// Menghapus notifikasi
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    // Validasi ID notifikasi
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'ID notifikasi tidak valid' });
    }
    
    // Mencari dan menghapus notifikasi
    const notification = await Notification.findOneAndDelete({ 
      _id: notificationId,
      userId
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    }
    
    // Mendapatkan jumlah notifikasi yang belum dibaca
    const unreadCount = await Notification.countUnread(userId);
    
    res.json({ 
      message: 'Notifikasi berhasil dihapus',
      unreadCount
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus notifikasi' });
  }
};

// Menghapus semua notifikasi
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Menghapus semua notifikasi untuk user
    await Notification.deleteMany({ userId });
    
    res.json({ 
      message: 'Semua notifikasi berhasil dihapus',
      unreadCount: 0
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus notifikasi' });
  }
};

// Membuat notifikasi baru (untuk penggunaan internal)
export const createNotification = async (req, res, io) => {
  try {
    const { userId, type, title, message, entityId, entityModel, data } = req.body;
    
    // Validasi data yang diperlukan
    if (!userId || !type || !title || !message) {
      return res.status(400).json({ message: 'Data tidak lengkap' });
    }
    
    // Buat notifikasi baru
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      entityId,
      entityModel,
      data
    });
    
    // Simpan notifikasi
    await notification.save();
    
    // Kirim notifikasi melalui Socket.IO
    io.to(`user:${userId}`).emit('notification', notification);
    
    res.status(201).json({
      message: 'Notifikasi berhasil dibuat',
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat membuat notifikasi' });
  }
};

// Fungsi utilitas untuk membuat notifikasi (untuk digunakan di controller lain)
export const createNotificationUtil = async (io, data) => {
  try {
    const { userId, type, title, message, entityId, entityModel, additionalData } = data;
    
    // Validasi data yang diperlukan
    if (!userId || !type || !title || !message) {
      console.error('Data notifikasi tidak lengkap');
      return null;
    }
    
    // Buat notifikasi baru
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      entityId,
      entityModel,
      data: additionalData || {}
    });
    
    // Simpan notifikasi
    await notification.save();
    
    // Mendapatkan jumlah notifikasi yang belum dibaca
    const unreadCount = await Notification.countUnread(userId);
    
    // Kirim notifikasi melalui Socket.IO
    io.to(`user:${userId}`).emit('notification', {
      notification,
      unreadCount
    });
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}; 