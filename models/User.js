import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['male', 'female', ''] },
  phone: { type: String },
  address: { type: String },
  bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''] },
  medicalHistory: { type: String },
  allergies: { type: String },
  lastCheckup: { type: Date },
  emergencyContact: { type: String },
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date },
  notificationSettings: {
    type: {
      patient_added: { type: Boolean, default: true },
      patient_updated: { type: Boolean, default: true },
      patient_deleted: { type: Boolean, default: true },
      scan_added: { type: Boolean, default: true },
      scan_updated: { type: Boolean, default: true },
      system: { type: Boolean, default: true }
    },
    default: {
      patient_added: true,
      patient_updated: true,
      patient_deleted: true,
      scan_added: true,
      scan_updated: true,
      system: true
    }
  },
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);