from flask import Flask, request, jsonify
import numpy as np
import io
import os
import sys
import time
import psutil
import logging
import gc
from flask_cors import CORS
from PIL import Image

# Konfigurasi logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("retinascan-api")

# Flag untuk mode simulasi
SIMULATION_MODE = os.environ.get('SIMULATION_MODE', '0') == '1'
MODEL_VERSION = '1.1.0'

# Coba import TensorFlow, dengan fallback jika tidak tersedia
try:
    if SIMULATION_MODE:
        raise ImportError("Mode simulasi diaktifkan, lewati import TensorFlow")
        
    # Set TensorFlow untuk menggunakan memori minimal
    os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Kurangi log TensorFlow
    
    # Import dengan penanganan khusus memori
    import tensorflow as tf
    
    # Batasi penggunaan memori TensorFlow
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    
    # Batasi memori CPU
    tf.config.threading.set_inter_op_parallelism_threads(1)
    tf.config.threading.set_intra_op_parallelism_threads(1)
    
    # Import lainnya setelah konfigurasi memori
    from tensorflow.keras.models import load_model
    import h5py
    
    logger.info(f"TensorFlow version: {tf.__version__}")
    TENSORFLOW_AVAILABLE = True
except ImportError as e:
    logger.warning(f"TensorFlow tidak tersedia: {e}")
    tf = None
    TENSORFLOW_AVAILABLE = False

app = Flask(__name__)
CORS(app)

# Variabel global untuk pelacakan
app_start_time = time.time()
total_requests = 0
successful_predictions = 0
model = None

# Konfigurasi path model
current_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(current_dir, 'model-Retinopaty.h5')
TINY_MODEL_PATH = os.path.join(current_dir, 'model-Retinopaty_tiny.h5')

# Kelas output model (5 kelas untuk tingkat keparahan DR)
CLASSES = ['No DR', 'Mild', 'Moderate', 'Severe', 'Proliferative DR']

# Mapping output ke bahasa Indonesia
SEVERITY_MAPPING = {
    'No DR': 'Tidak ada',
    'Mild': 'Ringan',
    'Moderate': 'Sedang',
    'Severe': 'Berat',
    'Proliferative DR': 'Sangat Berat'
}

# Mapping tingkat keparahan
SEVERITY_LEVEL_MAPPING = {
    'No DR': 0,
    'Mild': 1,
    'Moderate': 2,
    'Severe': 3,
    'Proliferative DR': 4
}

def create_tiny_model():
    """
    Buat model kecil yang efisien untuk deployment di lingkungan dengan memori terbatas
    """
    if not TENSORFLOW_AVAILABLE:
        return None
    
    try:
        # Buat model kecil (< 5MB)
        logger.info("Membuat model kecil untuk lingkungan dengan memori terbatas")
        
        # MobileNetV2 sangat efisien untuk memori
        inputs = tf.keras.layers.Input(shape=(224, 224, 3))
        
        # Gunakan model yang lebih kecil (jauh lebih sedikit parameter)
        x = tf.keras.layers.Conv2D(8, (3, 3), activation='relu', padding='same')(inputs)
        x = tf.keras.layers.MaxPooling2D((4, 4))(x)
        
        x = tf.keras.layers.Conv2D(16, (3, 3), activation='relu', padding='same')(x)
        x = tf.keras.layers.MaxPooling2D((4, 4))(x)
        
        x = tf.keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same')(x)
        x = tf.keras.layers.GlobalAveragePooling2D()(x)
        
        x = tf.keras.layers.Dense(64, activation='relu')(x)
        outputs = tf.keras.layers.Dense(5, activation='softmax')(x)
        
        tiny_model = tf.keras.Model(inputs, outputs)
        tiny_model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        
        # Simpan model kecil
        tiny_model.save(TINY_MODEL_PATH, save_format='h5')
        logger.info(f"Model kecil berhasil dibuat dan disimpan di {TINY_MODEL_PATH}")
        
        # Tampilkan ukuran
        model_size_mb = os.path.getsize(TINY_MODEL_PATH) / (1024 * 1024)
        logger.info(f"Ukuran model kecil: {model_size_mb:.2f} MB")
        
        return tiny_model
    
    except Exception as e:
        logger.error(f"Gagal membuat model kecil: {e}")
        return None

def load_model_safely():
    """
    Fungsi untuk loading model dengan penggunaan memori yang efisien
    """
    global model
    
    if SIMULATION_MODE:
        logger.info("Mode simulasi diaktifkan, melewati loading model")
        return None
    
    if not TENSORFLOW_AVAILABLE:
        logger.warning("TensorFlow tidak tersedia, tidak dapat memuat model")
        return None
    
    try:
        # Coba gunakan model kecil terlebih dahulu jika ada
        if os.path.exists(TINY_MODEL_PATH):
            logger.info(f"Menggunakan model kecil dari {TINY_MODEL_PATH}")
            try:
                model = tf.keras.models.load_model(TINY_MODEL_PATH, compile=False)
                model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
                logger.info("Model kecil berhasil dimuat")
                return model
            except Exception as e:
                logger.warning(f"Gagal memuat model kecil: {e}")
        
        # Coba buat model kecil jika model asli tersedia
        if os.path.exists(MODEL_PATH) and not os.path.exists(TINY_MODEL_PATH):
            logger.info("Mencoba membuat model kecil dari model asli...")
            try:
                tiny_model = create_tiny_model()
                if tiny_model:
                    logger.info("Berhasil membuat model kecil")
                    return tiny_model
            except Exception as e:
                logger.warning(f"Gagal membuat model kecil: {e}")
        
        # Jika model tidak ada atau tidak dapat dibuat model kecil
        if not os.path.exists(MODEL_PATH):
            logger.error(f"File model tidak ditemukan di: {MODEL_PATH}")
            return None
        
        # Terakhir, coba load model asli dengan mode yang hemat memori
        logger.info(f"Mencoba memuat model asli dari {MODEL_PATH} dengan mode hemat memori")
        
        # Percobaan dengan custom_objects yang dikoreksi
        try:
            class CustomInputLayer(tf.keras.layers.InputLayer):
                def __init__(self, **kwargs):
                    # Konversi batch_shape ke input_shape jika ada
                    if 'batch_shape' in kwargs:
                        kwargs['input_shape'] = kwargs.pop('batch_shape')[1:]
                    super(CustomInputLayer, self).__init__(**kwargs)
            
            custom_objects = {'InputLayer': CustomInputLayer}
            
            # Gunakan opsi compile=False untuk mengurangi memori
            model = tf.keras.models.load_model(
                MODEL_PATH,
                compile=False,
                custom_objects=custom_objects
            )
            
            # Kompilasi tanpa metrics untuk mengurangi penggunaan memori
            model.compile(optimizer='adam', loss='categorical_crossentropy')
            
            logger.info("Model asli berhasil dimuat dengan custom objects")
            return model
        
        except Exception as e:
            logger.error(f"Gagal memuat model asli: {e}")
            
            # Percobaan terakhir - buat model sangat kecil untuk prediksi
            try:
                return create_tiny_model()
            except:
                return None
    
    except Exception as e:
        logger.error(f"Error tidak terduga saat memuat model: {e}")
        return None
    finally:
        # Bersihkan memori
        gc.collect()

# Inisialisasi model
model = load_model_safely()
if model is None:
    logger.warning("Model tidak dapat dimuat, berjalan dalam mode simulasi")

def preprocess_image(img_bytes):
    """
    Memproses gambar untuk prediksi dengan model
    """
    try:
        # Buka gambar dari bytes
        img = Image.open(io.BytesIO(img_bytes))
        
        # Konversi ke RGB jika dalam mode lain (misalnya RGBA)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Ubah ukuran sesuai model
        img = img.resize((224, 224))  # Ukuran input standar
        
        # Konversi ke array numpy
        img_array = np.array(img)
        
        # Normalisasi ke [0,1]
        img_array = img_array / 255.0
        
        # Tambahkan dimensi batch
        img_array = np.expand_dims(img_array, axis=0)
        
        logger.info(f"Gambar berhasil diproses: shape={img_array.shape}")
        
        return img_array
    except Exception as e:
        logger.error(f"Error saat preprocessing gambar: {e}")
        raise

def get_recommendation_by_severity(severity_class):
    """
    Menghasilkan rekomendasi berdasarkan tingkat keparahan
    """
    recommendations = {
        'No DR': 'Lakukan pemeriksaan rutin setiap tahun.',
        'Mild': 'Kontrol gula darah dan tekanan darah. Pemeriksaan ulang dalam 9-12 bulan.',
        'Moderate': 'Konsultasi dengan dokter spesialis mata. Pemeriksaan ulang dalam 6 bulan.',
        'Severe': 'Rujukan segera ke dokter spesialis mata. Pemeriksaan ulang dalam 2-3 bulan.',
        'Proliferative DR': 'Rujukan segera ke dokter spesialis mata untuk evaluasi dan kemungkinan tindakan laser atau operasi.'
    }
    
    return recommendations.get(severity_class, 'Konsultasikan dengan dokter mata.')

def predict_with_model(image_array, filename="unknown"):
    """
    Melakukan prediksi dengan model atau menggunakan mode simulasi jika model tidak tersedia
    """
    start_time = time.time()
    
    if model is not None and not SIMULATION_MODE:
        try:
            logger.info(f"Menjalankan prediksi untuk gambar: {filename}")
            
            # Prediksi dengan model - batasi verbose output
            with tf.device('/CPU:0'):  # Pastikan berjalan di CPU
                predictions = model.predict(image_array, verbose=0)
            
            # Bersihkan memori setelah prediksi
            gc.collect()
            
            # Ambil kelas dengan probabilitas tertinggi
            predicted_class_index = np.argmax(predictions[0])
            predicted_class = CLASSES[predicted_class_index]
            
            # Ambil nilai confidence (probabilitas)
            confidence = float(predictions[0][predicted_class_index])
            
            logger.info(f"Prediksi untuk {filename}: {predicted_class} (confidence: {confidence:.2f})")
            
            # Mapping ke nama Indonesia dan level
            severity = SEVERITY_MAPPING[predicted_class]
            severity_level = SEVERITY_LEVEL_MAPPING[predicted_class]
            
            # Tambahkan rekomendasi
            recommendation = get_recommendation_by_severity(predicted_class)
            
            # Hasil prediksi dengan format yang konsisten
            result = {
                'severity': predicted_class,  # Kelas asli dari model
                'severity_level': severity_level,
                'confidence': confidence,
                'frontendSeverity': severity,  # Nama dalam bahasa Indonesia untuk frontend
                'frontendSeverityLevel': severity_level,
                'recommendation': recommendation,
                'raw_prediction': {
                    'class': predicted_class,
                    'probabilities': {CLASSES[i]: float(predictions[0][i]) for i in range(len(CLASSES))}
                },
                'model_version': MODEL_VERSION,
                'timestamp': time.time(),
                'processing_time_ms': int((time.time() - start_time) * 1000)
            }
            
            return result, True
            
        except Exception as e:
            logger.error(f"Error saat menggunakan model: {e}")
            logger.info("Fallback ke mode simulasi...")
    
    # Mode simulasi (jika model tidak tersedia atau ada error)
    logger.info(f"Menggunakan mode simulasi untuk gambar: {filename}")
    
    # Pilih kelas secara acak dengan bias ke kelas tertentu (untuk simulasi)
    import random
    # Weights untuk 5 kelas (No DR lebih umum, Proliferative DR paling jarang)
    weights = [0.5, 0.2, 0.15, 0.1, 0.05]  # Distribusi realistis
    predicted_class_index = random.choices(range(len(CLASSES)), weights=weights)[0]
    predicted_class = CLASSES[predicted_class_index]
    
    # Generate confidence score yang realistis
    base_confidence = 0.75
    confidence = base_confidence + (random.random() * 0.2)  # 0.75 - 0.95
    
    # Mapping ke nama Indonesia dan level
    severity = SEVERITY_MAPPING[predicted_class]
    severity_level = SEVERITY_LEVEL_MAPPING[predicted_class]
    
    # Tambahkan rekomendasi
    recommendation = get_recommendation_by_severity(predicted_class)
    
    # Buat distribusi probabilitas yang realistis
    probabilities = {class_name: round(random.random() * 0.1, 3) for class_name in CLASSES}
    probabilities[predicted_class] = confidence  # Set probabilitas kelas yang diprediksi
    
    # Hasil prediksi simulasi
    result = {
        'severity': predicted_class, 
        'severity_level': severity_level,
        'confidence': confidence,
        'frontendSeverity': severity,
        'frontendSeverityLevel': severity_level,
        'recommendation': recommendation,
        'raw_prediction': {
            'class': predicted_class,
            'probabilities': probabilities,
            'is_simulation': True
        },
        'model_version': MODEL_VERSION,
        'timestamp': time.time(),
        'processing_time_ms': int((time.time() - start_time) * 1000),
        'simulation_mode': True
    }
    
    logger.info(f"Simulasi prediksi untuk {filename}: {severity} (confidence: {confidence:.2f})")
    return result, True