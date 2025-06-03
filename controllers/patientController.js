import Patient from '../models/Patient.js';

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

// Fungsi untuk menambah pasien baru
export const createPatient = async (req, res, next) => {
  const { 
    name,
    fullName,
    dateOfBirth,
    age, 
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
    const newPatient = new Patient({
      userId: req.user.id, // Kaitkan pasien dengan user yang login
      name,
      fullName,
      dateOfBirth,
      age,
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
    
    // Kirim notifikasi melalui Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('authenticated_users').emit('patient_added', {
        patientId: newPatient._id,
        patientName: newPatient.fullName || newPatient.name,
        timestamp: new Date().toISOString(),
        doctorId: req.user.id
      });
      
      console.log('Notifikasi pasien baru telah dikirim');
    }
    
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
    age, 
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
    // Hanya update pasien milik user yang sedang login
    const patient = await Patient.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    });
    
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    
    patient.fullName = fullName || patient.fullName;
    patient.dateOfBirth = dateOfBirth || patient.dateOfBirth;
    patient.age = age || patient.age;
    patient.gender = gender || patient.gender;
    patient.phone = phone || patient.phone;
    patient.address = address || patient.address;
    patient.bloodType = bloodType || patient.bloodType;
    patient.medicalHistory = medicalHistory || patient.medicalHistory;
    patient.allergies = allergies || patient.allergies;
    patient.lastCheckup = lastCheckup || patient.lastCheckup;
    patient.emergencyContact = emergencyContact || patient.emergencyContact;
    
    await patient.save();
    
    // Kirim notifikasi melalui Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('authenticated_users').emit('patient_updated', {
        patientId: patient._id,
        patientName: patient.fullName || patient.name,
        timestamp: new Date().toISOString(),
        doctorId: req.user.id
      });
      
      console.log('Notifikasi update pasien telah dikirim');
    }
    
    res.json({ message: 'Data pasien berhasil diperbarui', patient });
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
    
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    
    const patientName = patient.fullName || patient.name;
    const patientId = patient._id;
    
    await Patient.findByIdAndDelete(req.params.id);
    
    // Kirim notifikasi melalui Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to('authenticated_users').emit('patient_deleted', {
        patientId: patientId,
        patientName: patientName,
        timestamp: new Date().toISOString(),
        doctorId: req.user.id
      });
      
      console.log('Notifikasi hapus pasien telah dikirim');
    }
    
    res.json({ message: 'Data pasien berhasil dihapus' });
  } catch (error) {
    next(error);
  }
}; 