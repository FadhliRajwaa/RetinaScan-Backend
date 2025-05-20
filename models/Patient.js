import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  age: { type: Number },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female', ''], required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''] },
  medicalHistory: { type: String },
  allergies: { type: String },
  lastCheckup: { type: Date },
  emergencyContact: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Validasi umur berdasarkan tanggal lahir sebelum menyimpan
patientSchema.pre('save', function(next) {
  if (this.dateOfBirth) {
    const birthDate = new Date(this.dateOfBirth);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    
    // Koreksi umur jika belum ulang tahun
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    
    this.age = calculatedAge;
  }
  next();
});

export default mongoose.model('Patient', patientSchema); 