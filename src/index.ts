import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import * as fs from 'fs';
import * as path from 'path';

import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { mahasiswaRoutes } from './routes/mahasiswa';
import { dosenRoutes } from './routes/dosen';
import { matakuliahRoutes } from './routes/matakuliah';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 Folder 'uploads' berhasil dibuat secara otomatis.");
}

export const app = new Elysia()
    .use(cors())

    .use(staticPlugin({
        assets: 'uploads',
        prefix: '/uploads'
    }))
    
    .use(authRoutes)
    .use(adminRoutes)
    .use(mahasiswaRoutes)
    .use(dosenRoutes)
    .use(matakuliahRoutes)

    .listen(process.env.PORT || 8000);

console.log(`🦊 Backend Akademik berjalan di http://localhost:${app.server?.port}`);