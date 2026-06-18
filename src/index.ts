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

const isProd = process.env.NODE_ENV === 'production';

// Inisialisasi Elysia dan pasang CORS
export const app = new Elysia().use(cors());

// HANYA JALANKAN DI LOKAL (Development)
if (!isProd) {
    // 1. Auto-Generate Folder 'uploads' di lokal
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("  Folder 'uploads' berhasil dibuat secara otomatis.");
    }

    // 2. Gunakan static plugin untuk melayani file lokal
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

// Jalankan server HTTP hanya jika di lokal (Vercel menggunakan api/index.ts sebagai handler)
if (!isProd) {
    app.listen(process.env.PORT || 8000);
    console.log(`  Backend Akademik berjalan di http://localhost:${app.server?.port}`);
}