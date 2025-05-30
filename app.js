import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import userRoutes from './routes/userRoutes.js'; // Tambahkan rute baru
import patientRoutes from './routes/patientRoutes.js'; // Import patient routes
import dashboardRoutes from './routes/dashboardRoutes.js'; // Import dashboard routes
import emailRoutes from './routes/emailRoutes.js'; // Import email routes
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
  origin: function(origin, callback) {
    // Daftar origin yang diizinkan
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
      'https://flask-service-4ifc.onrender.com',
      'https://retinopathy-api.onrender.com',
      // Tambahkan domain khusus render.com
      'https://retinascan.onrender.com',
      'https://retinascan-frontend.onrender.com',
      'https://retinascan-dashboard.onrender.com',
      // Izinkan semua subdomain dari onrender.com untuk pengembangan
      /\.onrender\.com$/
    ];
    
    // Jika tidak ada origin (misalnya Postman) atau origin ada dalam allowedOrigins
    // atau origin adalah subdomain onrender.com yang cocok dengan regex
    if (!origin) {
      callback(null, true); // Izinkan permintaan tanpa origin (seperti dari Postman)
    } else if (allowedOrigins.includes(origin)) {
      callback(null, true); // Izinkan jika origin cocok persis
    } else {
      // Periksa apakah cocok dengan pola regex onrender.com
      const isAllowedPattern = allowedOrigins.some(allowedOrigin => 
        allowedOrigin instanceof RegExp && allowedOrigin.test(origin)
      );
      
      if (isAllowedPattern) {
        callback(null, true); // Izinkan jika cocok dengan pola
      } else {
        console.log('Origin rejected by CORS:', origin);
        callback(null, false);
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Authorization'],
  credentials: true,
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
    'https://flask-service-4ifc.onrender.com',
    'https://retinopathy-api.onrender.com',
    // Tambahkan domain khusus render.com
    'https://retinascan.onrender.com',
    'https://retinascan-frontend.onrender.com',
    'https://retinascan-dashboard.onrender.com'
  ];
  
  const origin = req.headers.origin;
  
  // Periksa apakah origin ada dalam daftar yang diizinkan
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (origin && /\.onrender\.com$/.test(origin)) {
    // Izinkan semua subdomain onrender.com
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 jam
  
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
  try {
    const token = socket.handshake.auth.token;
    
    // Log yang lebih jelas untuk debugging
    console.log(`Socket auth attempt: ${socket.id}, has token: ${!!token}`);
    
    if (!token) {
      console.log('Socket auth failed: No token provided');
      return next(new Error('Authentication error'));
    }
    
    // Implementasi verifikasi token yang lebih sederhana
    // Cukup pastikan token ada untuk sekarang
    // Di implementasi sebenarnya, token harus diverifikasi dengan JWT
    // dan userId harus diekstrak
    
    // Tambahkan token dan status autentikasi ke objek socket
    socket.authenticated = true;
    socket.token = token;
    
    console.log(`Socket authenticated successfully: ${socket.id}`);
    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    return next(new Error('Authentication error'));
  }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'Authenticated:', socket.authenticated);

  // Bergabung dengan room berdasarkan token atau userId jika sudah terotentikasi
  if (socket.authenticated) {
    // Idealnya, ekstrak userId dari token dan gunakan sebagai room name
    const room = 'authenticated_users';
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
    
    // Log semua rooms yang aktif
    console.log('Active rooms:', [...socket.rooms].join(', '));
  }
  
  // Menambahkan handler untuk ping dari client (untuk testing koneksi)
  socket.on('ping', (data) => {
    console.log(`Received ping from client: ${socket.id}`, data);
    // Kirim balik pong dengan timestamp yang sama
    socket.emit('pong', {
      ...data,
      serverTime: new Date().toISOString(),
      socketId: socket.id,
      authenticated: socket.authenticated || false,
      rooms: [...socket.rooms]
    });
    console.log(`Sent pong to client: ${socket.id}`);
  });

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
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/email', emailRoutes); // Tambahkan route email

// Error handling
app.use(errorHandler);

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;