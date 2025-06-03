import User from '../models/User.js';

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  const { 
    fullName, 
    dateOfBirth, 
    gender, 
    phone, 
    address, 
    bloodType,
    medicalHistory,
    allergies,
    lastCheckup,
    emergencyContact
  } = req.body;
  
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

    user.fullName = fullName || user.fullName;
    user.dateOfBirth = dateOfBirth || user.dateOfBirth;
    user.gender = gender || user.gender;
    user.phone = phone || user.phone;
    user.address = address || user.address;
    user.bloodType = bloodType || user.bloodType;
    user.medicalHistory = medicalHistory || user.medicalHistory;
    user.allergies = allergies || user.allergies;
    user.lastCheckup = lastCheckup || user.lastCheckup;
    user.emergencyContact = emergencyContact || user.emergencyContact;

    await user.save();
    res.json({ message: 'Data pasien berhasil diperbarui', user });
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mendapatkan semua data pasien
export const getAllPatients = async (req, res, next) => {
  try {
    // Seharusnya ini mengambil data dari model Patient yang terkait dengan userId
    // namun sepertinya endpoint ini digunakan untuk tujuan lain di aplikasi
    // Kita tetapkan supaya hanya mengambil user yang sedang login
    const currentUser = await User.findById(req.user.id).select('-password -resetPasswordCode -resetPasswordExpires');
    
    // Kembalikan hanya user yang sedang login sebagai array untuk mempertahankan kompatibilitas
    res.json([currentUser]);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mendapatkan data pasien berdasarkan ID
export const getPatientById = async (req, res, next) => {
  try {
    // Hanya izinkan akses ke profil sendiri
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ message: 'Tidak memiliki akses ke data pasien ini' });
    }
    
    const patient = await User.findById(req.params.id).select('-password -resetPasswordCode -resetPasswordExpires');
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    res.json(patient);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk menambah pasien baru
export const createPatient = async (req, res, next) => {
  const { 
    name,
    fullName,
    dateOfBirth, 
    gender, 
    phone, 
    address, 
    bloodType,
    medicalHistory,
    allergies,
    lastCheckup,
    emergencyContact
  } = req.body;
  
  try {
    // Generate unique email based on name
    const baseEmail = name.toLowerCase().replace(/\s+/g, '.') + '@retinascan.com';
    let email = baseEmail;
    let counter = 1;
    
    // Check if email exists, if so, add counter until unique
    while (await User.findOne({ email })) {
      email = `${baseEmail.split('@')[0]}${counter}@${baseEmail.split('@')[1]}`;
      counter++;
    }
    
    // Generate a default password
    const defaultPassword = 'password123';
    
    const newPatient = new User({
      name,
      email,
      password: defaultPassword,
      fullName,
      dateOfBirth,
      gender,
      phone,
      address,
      bloodType,
      medicalHistory,
      allergies,
      lastCheckup,
      emergencyContact
    });
    
    await newPatient.save();
    res.status(201).json({ message: 'Pasien berhasil ditambahkan', patient: newPatient });
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mengupdate data pasien
export const updatePatient = async (req, res, next) => {
  const { 
    fullName,
    dateOfBirth, 
    gender, 
    phone, 
    address, 
    bloodType,
    medicalHistory,
    allergies,
    lastCheckup,
    emergencyContact
  } = req.body;
  
  try {
    const patient = await User.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    
    patient.fullName = fullName || patient.fullName;
    patient.dateOfBirth = dateOfBirth || patient.dateOfBirth;
    patient.gender = gender || patient.gender;
    patient.phone = phone || patient.phone;
    patient.address = address || patient.address;
    patient.bloodType = bloodType || patient.bloodType;
    patient.medicalHistory = medicalHistory || patient.medicalHistory;
    patient.allergies = allergies || patient.allergies;
    patient.lastCheckup = lastCheckup || patient.lastCheckup;
    patient.emergencyContact = emergencyContact || patient.emergencyContact;
    
    await patient.save();
    res.json({ message: 'Data pasien berhasil diperbarui', patient });
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk menghapus pasien
export const deletePatient = async (req, res, next) => {
  try {
    const patient = await User.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Data pasien berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mengupdate pengaturan notifikasi pengguna
export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationSettings } = req.body;
    
    if (!notificationSettings) {
      return res.status(400).json({ message: 'Pengaturan notifikasi diperlukan' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    
    // Update pengaturan notifikasi
    user.notificationSettings = notificationSettings;
    await user.save();
    
    res.status(200).json({ 
      message: 'Pengaturan notifikasi berhasil diperbarui',
      notificationSettings: user.notificationSettings
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui pengaturan notifikasi' });
  }
};

// Fungsi untuk mendapatkan pengaturan notifikasi pengguna
export const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    
    res.status(200).json({ 
      notificationSettings: user.notificationSettings
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil pengaturan notifikasi' });
  }
};