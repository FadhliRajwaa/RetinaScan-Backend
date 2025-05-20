import mongoose from 'mongoose';

const retinaAnalysisSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  imagePath: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true
  },
  severityLevel: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

const RetinaAnalysis = mongoose.model('RetinaAnalysis', retinaAnalysisSchema);

export default RetinaAnalysis; 