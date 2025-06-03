import Patient from '../models/Patient.js';
import { createNotificationUtil } from './notificationController.js';
import User from '../models/User.js';

// Fungsi untuk mendapatkan semua data pasien milik user yang sedang login
export const getAllPatients = async (req, res, next) => {
  try {
    // Hanya ambil pasien milik user yang sedang login
    const patients = await Patient.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mendapatkan data pasien berdasarkan ID
export const getPatientById = async (req, res, next) => {
  try {
    // Hanya ambil pasien milik user yang sedang login
    const patient = await Patient.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    res.json(patient);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk membuat pasien baru
export const createPatient = async (req, res, next) => {
  try {
    // Tambahkan userId dari user yang sedang login
    const newPatient = new Patient({
      ...req.body,
      userId: req.user.id
    });

    const savedPatient = await newPatient.save();
    
    // Kirim notifikasi jika pengaturan notifikasi mengizinkan
    const user = await User.findById(req.user.id);
    if (user && user.notificationSettings && user.notificationSettings.patient_added) {
      await createNotificationUtil({
        userId: req.user.id,
        type: 'patient_added',
        title: 'Pasien Baru',
        message: `Pasien baru "${savedPatient.name}" telah ditambahkan`,
        entityId: savedPatient._id,
        entityModel: 'Patient',
        data: { patientId: savedPatient._id, patientName: savedPatient.name }
      });
      
      // Emit socket event untuk notifikasi real-time
      const io = req.app.get('io');
      const userRoom = `user:${req.user.id}`;
      io.to(userRoom).emit('notification', {
        type: 'patient_added',
        title: 'Pasien Baru',
        message: `Pasien baru "${savedPatient.name}" telah ditambahkan`,
        entityId: savedPatient._id,
        entityModel: 'Patient',
        data: { patientId: savedPatient._id, patientName: savedPatient.name }
      });
    }
    
    res.status(201).json(savedPatient);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mengupdate data pasien
export const updatePatient = async (req, res, next) => {
  try {
    // Hanya update pasien milik user yang sedang login
    const patient = await Patient.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!patient) return res.status(404).json({ message: 'Pasien tidak ditemukan' });
    
    // Simpan nama pasien sebelum diupdate untuk notifikasi
    const previousName = patient.name;
    
    // Update data pasien
    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, 
      { new: true }
    );
    
    // Kirim notifikasi jika pengaturan notifikasi mengizinkan
    const user = await User.findById(req.user.id);
    if (user && user.notificationSettings && user.notificationSettings.patient_updated) {
      await createNotificationUtil({
        userId: req.user.id,
        type: 'patient_updated',
        title: 'Data Pasien Diperbarui',
        message: `Data pasien "${updatedPatient.name}" telah diperbarui`,
        entityId: updatedPatient._id,
        entityModel: 'Patient',
        data: { patientId: updatedPatient._id, patientName: updatedPatient.name, previousName }
      });
      
      // Emit socket event untuk notifikasi real-time
      const io = req.app.get('io');
      const userRoom = `user:${req.user.id}`;
      io.to(userRoom).emit('notification', {
        type: 'patient_updated',
        title: 'Data Pasien Diperbarui',
        message: `Data pasien "${updatedPatient.name}" telah diperbarui`,
        entityId: updatedPatient._id,
        entityModel: 'Patient',
        data: { patientId: updatedPatient._id, patientName: updatedPatient.name, previousName }
      });
    }
    
    res.json(updatedPatient);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk menghapus pasien
export const deletePatient = async (req, res, next) => {
  try {
    // Hanya hapus pasien milik user yang sedang login
    const patient = await Patient.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!patient) return res.status(404).json({ message: 'Pasien tidak ditemukan' });
    
    // Simpan nama pasien sebelum dihapus untuk notifikasi
    const patientName = patient.name;
    const patientId = patient._id;
    
    await Patient.findByIdAndDelete(req.params.id);
    
    // Kirim notifikasi jika pengaturan notifikasi mengizinkan
    const user = await User.findById(req.user.id);
    if (user && user.notificationSettings && user.notificationSettings.patient_deleted) {
      await createNotificationUtil({
        userId: req.user.id,
        type: 'patient_deleted',
        title: 'Pasien Dihapus',
        message: `Pasien "${patientName}" telah dihapus`,
        data: { patientName }
      });
      
      // Emit socket event untuk notifikasi real-time
      const io = req.app.get('io');
      const userRoom = `user:${req.user.id}`;
      io.to(userRoom).emit('notification', {
        type: 'patient_deleted',
        title: 'Pasien Dihapus',
        message: `Pasien "${patientName}" telah dihapus`,
        data: { patientName }
      });
    }
    
    res.json({ message: 'Pasien berhasil dihapus' });
  } catch (error) {
    next(error);
  }
}; 