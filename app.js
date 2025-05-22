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

// Konfigurasi environment variables
dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.VITE_FRONTEND_URL, process.env.VITE_DASHBOARD_URL, "http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
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
  origin: [process.env.VITE_FRONTEND_URL, process.env.VITE_DASHBOARD_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads directory dengan path yang benar
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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