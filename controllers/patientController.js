import Patient from '../models/Patient.js';

// Fungsi untuk mendapatkan semua data pasien
export const getAllPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk mendapatkan data pasien berdasarkan ID
export const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
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
    const patient = await Patient.findById(req.params.id);
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
    res.json({ message: 'Data pasien berhasil diperbarui', patient });
  } catch (error) {
    next(error);
  }
};

// Fungsi untuk menghapus pasien
export const deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Data pasien tidak ditemukan' });
    
    await Patient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Data pasien berhasil dihapus' });
  } catch (error) {
    next(error);
  }
}; 