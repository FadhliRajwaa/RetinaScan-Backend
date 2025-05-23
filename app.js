import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import userRoutes from './routes/userRoutes.js'; // Tambahkan rute baru
import patientRoutes from './routes/patientRoutes.js'; // Import patient routes
import errorHandler from './utils/errorHandler.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { dirname } from 'path';
import mongoose from 'mongoose';
import RetinaAnalysis from './models/RetinaAnalysis.js';
import User from './models/User.js';
import Patient from './models/Patient.js';
import compression from 'compression'; // Ubah dari express-compression menjadi compression

// Konfigurasi environment variables
dotenv.config();

// Simpan waktu mulai aplikasi untuk health check
global.startTime = Date.now();

const app = express();
const httpServer = createServer(app);

// Tambahkan middleware kompresi untuk mempercepat respons
app.use(compression()); // Ubah konfigurasi kompresi

// Tingkatkan batas ukuran request untuk upload gambar
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.VITE_FRONTEND_URL, 
      process.env.VITE_DASHBOARD_URL, 
      process.env.FLASK_API_URL,
      "http://localhost:5173", 
      "http://localhost:3000",
      "http://localhost:5001",
      "https://retinascan.onrender.com",
      "https://retinascan-dashboard.onrender.com",
      "https://retinascan-backend-eszo.onrender.com",
      "https://flask-service-4ifc.onrender.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    // Tambahkan pengaturan untuk mempercepat koneksi socket
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pastikan direktori uploads ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('Membuat direktori uploads...');
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: [
    process.env.VITE_FRONTEND_URL, 
    process.env.VITE_DASHBOARD_URL, 
    process.env.FLASK_API_URL,
    'http://localhost:5173', 
    'http://localhost:3000',
    'http://localhost:5001',
    'https://retinascan.onrender.com',
    'https://retinascan-dashboard.onrender.com',
    'https://retinascan-backend-eszo.onrender.com',
    'https://flask-service-4ifc.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  // Tambahkan cache untuk preflight requests
  maxAge: 86400 // 24 jam
}));

// Middleware tambahan untuk menangani CORS dengan origins yang sama
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.VITE_FRONTEND_URL, 
    process.env.VITE_DASHBOARD_URL, 
    process.env.FLASK_API_URL,
    'http://localhost:5173', 
    'http://localhost:3000',
    'http://localhost:5001',
    'https://retinascan.onrender.com',
    'https://retinascan-dashboard.onrender.com',
    'https://retinascan-backend-eszo.onrender.com',
    'https://flask-service-4ifc.onrender.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Intercept OPTIONS method
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve uploads directory dengan path yang benar dan cache control
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d', // Cache selama 1 hari
  etag: true,
  lastModified: true
}));

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  // Verify token here if needed
  next();
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Simpan models ke app untuk diakses di routes
app.set('models', {
  RetinaAnalysis,
  User,
  Patient
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const startTime = global.startTime || Date.now();
  const uptime = Date.now() - startTime;
  
  try {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      uptime: uptime,
      uptime_formatted: `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m ${Math.floor((uptime % 60000) / 1000)}s`,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      mongo_connection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      services: {
        flask_api: process.env.FLASK_API_URL || 'https://flask-service-4ifc.onrender.com'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/user', userRoutes); // Tambahkan rute pengguna
app.use('/api/patients', patientRoutes); // Tambahkan patient routes

// Error handling
app.use(errorHandler);

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;