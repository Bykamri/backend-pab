// src/index.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import * as fs from 'fs';
import * as path from 'path';

// Import semua router
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { mahasiswaRoutes } from './routes/mahasiswa';
import { dosenRoutes } from './routes/dosen';
import { matakuliahRoutes } from './routes/matakuliah';

// Tambahkan pengecekan Vercel env
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

// Inisialisasi Elysia dan pasang CORS
export const app = new Elysia().use(cors());

// ==========================================
// 🌟 MIDDLEWARE GLOBAL UNTUK LOGGING
// ==========================================
// ==========================================
// 🌟 MIDDLEWARE GLOBAL UNTUK LOGGING
// ==========================================
app
  .onRequest(({ request }) => {
    // Catat waktu mulai saat request masuk
    console.log(`[${new Date().toISOString()}] ➡️ MASUK: ${request.method} ${request.url}`);
  })
  .onAfterResponse(({ request, set }) => {
    // Gunakan onAfterResponse bukan onResponse
    console.log(`[${new Date().toISOString()}] ⬅️ KELUAR: ${request.method} ${request.url} - Status: ${set.status}`);
  })
  .onError(({ code, error, request }) => {
    // Catat jika terjadi error pada endpoint
    console.error(`[${new Date().toISOString()}] ❌ ERROR [${code}]: ${request.method} ${request.url}`);
    console.error(error);
  });
// ==========================================

// ==========================================
// ROUTE HTML SEDERHANA UNTUK CEK DOMAIN
// ==========================================
app.get('/', () => {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Backend Akademik Siola</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    text-align: center; 
                    padding: 50px; 
                    background-color: #f0f2f5; 
                    color: #333; 
                }
                .container { 
                    background: white; 
                    padding: 40px; 
                    border-radius: 12px; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
                    max-width: 500px; 
                    margin: auto; 
                }
                h1 { color: #0070f3; margin-top: 0; }
                .status { 
                    display: inline-block; 
                    padding: 10px 20px; 
                    background: #e6f7ff; 
                    color: #005bb5; 
                    border-radius: 20px; 
                    font-weight: bold; 
                    font-size: 14px; 
                    margin-top: 15px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Server Berjalan!</h1>
                <p>Sistem Backend Akademik (PAB) berhasil di-deploy ke Vercel dan merespon dengan baik.</p>
                <div class="status">🟢 Status: Online</div>
            </div>
        </body>
        </html>
    `;

    // Kembalikan Response dengan Content-Type HTML
    return new Response(htmlContent, {
        headers: {
            'Content-Type': 'text/html; charset=utf8'
        }
    });
});
// ==========================================

// HANYA JALANKAN DI LOKAL (Development)
if (!isProd) {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("  Folder 'uploads' berhasil dibuat secara otomatis.");
    }

    app.use(staticPlugin({
        assets: 'uploads',
        prefix: '/uploads'
    }));
}

// Daftarkan semua route
app.use(authRoutes)
   .use(adminRoutes)
   .use(mahasiswaRoutes)
   .use(dosenRoutes)
   .use(matakuliahRoutes);

// Cegah app.listen berjalan di Vercel
const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
    // Sesuaikan port ke 3000 jika aplikasi flutter menembak port 3000
    app.listen(process.env.PORT || 3000); 
    console.log(`  Backend Akademik berjalan di http://localhost:${app.server?.port}`);
}

// Pastikan export default ada untuk Vercel
export default app;