import mongoose from 'mongoose';

const retinaAnalysisSchema = new mongoose.Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  imageDetails: {
    originalname: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  },
  imageData: {
    type: String,
    description: 'Gambar dalam format base64'
  },
  results: {
    classification: {
      type: String,
      required: true,
      enum: ['No DR', 'Mild', 'Moderate', 'Severe', 'Proliferative DR']
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    isSimulation: {
      type: Boolean,
      default: false,
      description: 'Menandakan hasil dari mode simulasi Flask API'
    }
  },
  recommendation: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

const RetinaAnalysis = mongoose.model('RetinaAnalysis', retinaAnalysisSchema);

export default RetinaAnalysis; 