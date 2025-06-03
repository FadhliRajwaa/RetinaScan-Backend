import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: { 
    type: String, 
    enum: ['patient_added', 'patient_updated', 'patient_deleted', 'scan_added', 'scan_updated', 'system'],
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityModel'
  },
  entityModel: {
    type: String,
    enum: ['Patient', 'RetinaAnalysis', null]
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  }
}, {
  timestamps: true
});

// Indeks untuk meningkatkan kinerja query
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

// Method untuk menandai notifikasi sebagai dibaca
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  return this.save();
};

// Method untuk mengubah format waktu menjadi relatif
notificationSchema.methods.timeAgo = function() {
  const now = new Date();
  const diff = now - this.createdAt;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} hari yang lalu`;
  } else if (hours > 0) {
    return `${hours} jam yang lalu`;
  } else if (minutes > 0) {
    return `${minutes} menit yang lalu`;
  } else {
    return 'baru saja';
  }
};

// Statics untuk mendapatkan jumlah notifikasi yang belum dibaca
notificationSchema.statics.countUnread = function(userId) {
  return this.countDocuments({ userId, read: false });
};

// Statics untuk menandai semua notifikasi sebagai dibaca
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );
};

export default mongoose.model('Notification', notificationSchema); 