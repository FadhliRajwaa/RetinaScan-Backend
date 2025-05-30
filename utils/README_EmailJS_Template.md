# Panduan Konfigurasi Template EmailJS

Untuk memastikan fungsi reset password bekerja dengan baik, ikuti langkah-langkah berikut untuk mengonfigurasi template EmailJS Anda.

## Langkah 1: Buka Dashboard EmailJS

1. Kunjungi https://dashboard.emailjs.com/admin/templates
2. Pastikan Anda sudah login ke akun EmailJS Anda

## Langkah 2: Buat Template Baru (atau Edit Template Existing)

1. Jika sudah ada template dengan ID `template_j9rj1wu`, klik untuk mengedit
2. Jika belum ada, buat template baru dengan klik "Create New Template"

## Langkah 3: Konfigurasi Template

Pastikan template Anda menggunakan variabel-variabel berikut:

```
{{to_email}} - Alamat email penerima
{{to_name}} - Nama penerima
{{reset_link}} - Link untuk reset password
{{reset_token}} - Kode verifikasi reset password
{{app_name}} - Nama aplikasi (RetinaScan)
```

### Contoh Template HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Reset Password RetinaScan</title>
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
    <div style="background-color: #3B82F6; padding: 20px; text-align: center;">
      <h1 style="color: #fff; margin: 0;">RetinaScan</h1>
    </div>
    <div style="padding: 20px;">
      <p>Halo <strong>{{to_name}}</strong>,</p>
      
      <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun {{app_name}} Anda.</p>
      
      <p>Kode reset password Anda adalah: <strong>{{reset_token}}</strong></p>
      
      <p>Klik tombol di bawah ini untuk mengatur ulang kata sandi Anda:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{reset_link}}" style="background-color: #3B82F6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      
      <p>Atau Anda dapat mengunjungi link berikut:</p>
      <p><a href="{{reset_link}}">{{reset_link}}</a></p>
      
      <p>Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.</p>
      
      <p>Kode verifikasi ini akan kedaluwarsa dalam 10 menit.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #777; font-size: 12px;">
        <p>Email ini dikirim ke {{to_email}} karena alamat email ini terdaftar di {{app_name}}.</p>
        <p>&copy; 2024 {{app_name}}. Semua hak dilindungi undang-undang.</p>
      </div>
    </div>
  </div>
</body>
</html>
```

## Langkah 4: Simpan Template

1. Setelah membuat atau mengedit template, klik "Save" untuk menyimpan perubahan
2. Catat ID template yang muncul (misalnya `template_j9rj1wu`)

## Langkah 5: Perbarui Konfigurasi di Backend

Pastikan konfigurasi di backend menggunakan ID yang benar:

1. Di file `.env` di backend:
   ```
   EMAILJS_SERVICE_ID=Email_Fadhli_ID
   EMAILJS_RESET_TEMPLATE_ID=template_j9rj1wu
   EMAILJS_PUBLIC_KEY=YOUR_PUBLIC_KEY
   ```

2. Atau langsung di file `backend/utils/emailService.js`:
   ```javascript
   const SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'Email_Fadhli_ID';
   const TEMPLATE_ID_RESET = process.env.EMAILJS_RESET_TEMPLATE_ID || 'template_j9rj1wu';
   const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || '';
   ```

## Langkah 6: Uji Fitur Reset Password

Setelah semua konfigurasi selesai, uji fitur reset password untuk memastikan email dikirim dengan benar dan berisi informasi yang diperlukan untuk melakukan reset password. 