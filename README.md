# 🔧 RetinaScan Backend

<div align="center">
  
  ![RetinaScan Backend](https://img.shields.io/badge/RetinaScan-Backend-green?style=for-the-badge)
  
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
  [![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
  [![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white)](https://jwt.io/)
  
  Backend server untuk sistem RetinaScan yang dibangun dengan Node.js, Express, dan MongoDB.
</div>

## 📋 Daftar Isi
- [Pengenalan](#-pengenalan)
- [Fitur](#-fitur)
- [Teknologi](#-teknologi)
- [Memulai](#-memulai)
- [Struktur Proyek](#-struktur-proyek)
- [API Endpoints](#-api-endpoints)
- [Konfigurasi](#-konfigurasi)
- [Deployment](#-deployment)
- [Integrasi dengan Flask API](#-integrasi-dengan-flask-api)

## 🔍 Pengenalan

Backend RetinaScan adalah server API yang menangani autentikasi pengguna, manajemen data, dan komunikasi dengan layanan Flask untuk analisis gambar retina. Backend ini menyediakan API RESTful untuk digunakan oleh frontend dan dashboard.

## ✨ Fitur

- **Autentikasi & Otorisasi** - Sistem autentikasi berbasis JWT dengan role-based access control
- **Manajemen Pengguna** - CRUD operasi untuk pengguna
- **Upload & Manajemen Gambar** - Penanganan upload gambar retina
- **Integrasi dengan Flask API** - Komunikasi dengan layanan Flask untuk analisis gambar
- **Penyimpanan Hasil Analisis** - Menyimpan hasil analisis di MongoDB
- **Validasi Data** - Validasi input untuk keamanan dan integritas data
- **Logging & Monitoring** - Sistem logging untuk memantau aktivitas dan error
- **Mode Simulasi** - Opsi untuk menjalankan sistem dalam mode simulasi saat layanan AI tidak tersedia

## 🛠 Teknologi

- **Node.js** - Runtime JavaScript untuk server
- **Express** - Framework web untuk Node.js
- **MongoDB** - Database NoSQL
- **Mongoose** - ODM (Object Data Modeling) untuk MongoDB
- **JWT** - JSON Web Token untuk autentikasi
- **Multer** - Middleware untuk penanganan upload file
- **Axios** - HTTP client untuk komunikasi dengan Flask API
- **Winston** - Library untuk logging
- **Joi** - Library untuk validasi data
- **Cors** - Middleware untuk Cross-Origin Resource Sharing
- **Helmet** - Middleware untuk keamanan HTTP header

## 🚀 Memulai

### Persyaratan

- Node.js (v14+)
- MongoDB
- npm atau yarn

### Instalasi

1. Clone repository:
   ```bash
   git clone https://github.com/username/RetinaScan.git
   cd RetinaScan/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   # atau
   yarn
   ```

3. Buat file `.env` di root folder:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/RetinaScan
   JWT_SECRET=your_jwt_secret
   VITE_FRONTEND_URL=http://localhost:5173
   FLASK_API_URL=http://localhost:5001
   VITE_DASHBOARD_URL=http://localhost:3000
   PORT=5000
   ```

4. Jalankan server:
   ```bash
   npm start
   # atau
   yarn start
   ```

5. Server akan berjalan di http://localhost:5000

## 📂 Struktur Proyek

```
backend/
├── config/                # Konfigurasi aplikasi
│   └── db.js              # Konfigurasi database
├── controllers/           # Controller untuk endpoint API
│   ├── authController.js  # Controller untuk autentikasi
│   ├── userController.js  # Controller untuk manajemen pengguna
│   └── analysisController.js # Controller untuk analisis gambar
├── middleware/            # Middleware Express
│   ├── auth.js            # Middleware autentikasi
│   ├── upload.js          # Middleware upload file
│   └── validation.js      # Middleware validasi data
├── models/                # Model data MongoDB
│   ├── User.js            # Model pengguna
│   └── Analysis.js        # Model hasil analisis
├── routes/                # Definisi rute API
│   ├── authRoutes.js      # Rute autentikasi
│   ├── userRoutes.js      # Rute manajemen pengguna
│   └── analysisRoutes.js  # Rute analisis gambar
├── utils/                 # Fungsi utilitas
│   ├── logger.js          # Utilitas logging
│   └── helpers.js         # Fungsi helper
├── retinascan-api/        # Flask API untuk model machine learning
├── uploads/               # Folder untuk menyimpan file upload
├── app.js                 # Entry point aplikasi
├── package.json           # Dependencies dan scripts
└── .env                   # Environment variables
```

## 📡 API Endpoints

### Autentikasi

- `POST /api/auth/register` - Registrasi pengguna baru
- `POST /api/auth/login` - Login pengguna
- `POST /api/auth/logout` - Logout pengguna
- `GET /api/auth/me` - Mendapatkan data pengguna yang sedang login
- `PUT /api/auth/change-password` - Mengubah password pengguna

### Pengguna

- `GET /api/users` - Mendapatkan semua pengguna (admin)
- `GET /api/users/:id` - Mendapatkan pengguna berdasarkan ID
- `PUT /api/users/:id` - Memperbarui data pengguna
- `DELETE /api/users/:id` - Menghapus pengguna

### Analisis

- `POST /api/analysis/upload` - Upload gambar untuk dianalisis
- `GET /api/analysis` - Mendapatkan semua hasil analisis pengguna
- `GET /api/analysis/:id` - Mendapatkan hasil analisis berdasarkan ID
- `DELETE /api/analysis/:id` - Menghapus hasil analisis
- `GET /api/analysis/statistics` - Mendapatkan statistik analisis (admin)

## ⚙️ Konfigurasi

### Environment Variables

Buat file `.env` di root folder dengan variabel berikut:

```
# Database
MONGO_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/RetinaScan

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d

# URLs
VITE_FRONTEND_URL=http://localhost:5173
VITE_DASHBOARD_URL=http://localhost:3000
FLASK_API_URL=http://localhost:5001

# Server
PORT=5000
NODE_ENV=development

# Optional
SIMULATION_MODE_ENABLED=false
```

### Scripts

- `npm start` - Menjalankan server
- `npm run dev` - Menjalankan server dengan nodemon (auto-restart)
- `npm run test` - Menjalankan test
- `npm run test:flask` - Menguji koneksi Flask API

## 🚢 Deployment

### Deployment ke Render

1. Buat New Web Service di Render
2. Hubungkan dengan repository GitHub
3. Pilih direktori `backend`
4. Konfigurasi:
   - Build Command: `npm install`
   - Start Command: `node app.js`
5. Tambahkan environment variables yang diperlukan
6. Deploy!

## 🔄 Integrasi dengan Flask API

Backend Node.js berkomunikasi dengan Flask API untuk analisis gambar retina. Berikut adalah cara kerjanya:

1. Frontend mengirim gambar ke backend Node.js
2. Backend menyimpan gambar di folder `uploads`
3. Backend mengirim gambar ke Flask API untuk dianalisis
4. Flask API memproses gambar menggunakan model machine learning
5. Flask API mengembalikan hasil analisis ke backend
6. Backend menyimpan hasil analisis di MongoDB
7. Backend mengirim hasil analisis ke frontend

### Menguji Koneksi Flask API

Untuk menguji koneksi ke Flask API, gunakan script berikut:

```bash
npm run test:flask
# atau
node test-flask-api.js
```

Script ini akan mencoba terhubung ke semua URL Flask API yang mungkin dan memberikan rekomendasi URL terbaik untuk digunakan.

### Mode Simulasi

Jika Flask API tidak tersedia, backend dapat beralih ke mode simulasi. Dalam mode ini, backend akan menghasilkan hasil analisis acak tanpa mengirim gambar ke Flask API.

Untuk mengaktifkan mode simulasi, tambahkan environment variable berikut:

```
SIMULATION_MODE_ENABLED=true
```

**Catatan**: Mode simulasi hanya direkomendasikan untuk pengembangan dan pengujian, bukan untuk penggunaan production.

---

<div align="center">
  <p>Bagian dari proyek RetinaScan - Sistem Deteksi Retinopati Diabetik</p>
</div> 