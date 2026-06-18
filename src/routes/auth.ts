// src/routes/auth.ts
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { executeQuery } from '../db';

const prodiCodes: Record<string, string> = {
    'Teknik Informatika': '146',
    'Sistem Informasi':   '147',
    'Sains Data':         '148',
    'Teknik Komputer':    '149',
    'Bisnis Digital':     '150',
    'Teknik Elektro':     '151',
    'Teknik Sipil':       '152',
    'Teknik Mesin':       '153',
};

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET || 'rahasia_akademik_siola_123',
        })
    )

    // ==========================================
    // 1. REGISTER OTOMATIS (Default: Mahasiswa)
    // ==========================================
    .post('/register', async ({ body, set }: any) => {
        const { password, nama, prodi } = body;

        if (!nama || !prodi || !password) {
            set.status = 400;
            return { status: 'error', message: 'Nama, Prodi, dan Password wajib diisi!' };
        }

        try {
            const kodeProdi    = prodiCodes[prodi] || '999';
            const now          = new Date();
            const fullYear     = now.getFullYear();
            const year2Digit   = fullYear.toString().slice(-2);
            const month        = now.getMonth() + 1;
            const semester     = month > 6 ? '1' : '2';
            const nimPrefix    = `${kodeProdi}${year2Digit}${semester}`;

            // LIKE query: MySQL pakai ?, PostgreSQL sudah dikonversi oleh executeQuery
            const lastMhs = await executeQuery(
                `SELECT nim FROM mahasiswa WHERE nim LIKE ? ORDER BY nim DESC LIMIT 1`,
                [`${nimPrefix}%`]
            );

            let noUrut = 1;
            if (lastMhs.length > 0) {
                const lastNim      = lastMhs[0].nim as string;
                const lastUrutStr  = lastNim.replace(nimPrefix, '');
                const lastUrutNum  = parseInt(lastUrutStr, 10);
                if (!isNaN(lastUrutNum)) noUrut = lastUrutNum + 1;
            }

            const noUrutStr    = noUrut.toString().padStart(3, '0');
            const generatedNim = `${nimPrefix}${noUrutStr}`;

            const hashedPassword = await Bun.password.hash(password, {
                algorithm: 'bcrypt',
                cost: 10,
            });

            await executeQuery(
                `INSERT INTO users (username, password, role) VALUES (?, ?, 'mahasiswa')`,
                [generatedNim, hashedPassword]
            );

            await executeQuery(
                `INSERT INTO mahasiswa (nim, nama, angkatan, prodi, lulus) VALUES (?, ?, ?, ?, 0)`,
                [generatedNim, nama, fullYear.toString(), prodi]
            );

            return {
                status: 'success',
                message: 'Registrasi berhasil!',
                data: { nim: generatedNim, nama, prodi },
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 2. LOGIN UNIVERSAL
    // ==========================================
    .post('/login', async ({ body, jwt, set }: any) => {
        console.log('\n[LOG LOGIN] === Permintaan Login Masuk ===');
        console.log('[LOG LOGIN] Body:', body);

        const { username, password } = body;

        try {
            const users = await executeQuery(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );

            if (users.length === 0) {
                set.status = 401;
                return { status: 'error', message: 'Username tidak ditemukan!' };
            }

            const user    = users[0];
            const isMatch = await Bun.password.verify(password, user.password);

            if (!isMatch) {
                set.status = 401;
                return { status: 'error', message: 'Password salah!' };
            }

            console.log(`[LOG LOGIN] ✅ User ${username} login sebagai ${user.role}`);

            let namaLengkap = user.username;
            if (user.role === 'mahasiswa') {
                const mhs = await executeQuery(
                    'SELECT nama FROM mahasiswa WHERE nim = ?',
                    [user.username]
                );
                if (mhs.length > 0) namaLengkap = mhs[0].nama;
            } else if (user.role === 'dosen') {
                const dsn = await executeQuery(
                    'SELECT nama FROM dosen WHERE kodedsn = ?',
                    [user.username]
                );
                if (dsn.length > 0) namaLengkap = dsn[0].nama;
            } else if (user.role === 'admin') {
                namaLengkap = 'Super Admin';
            }

            const token = await jwt.sign({
                username: user.username,
                role:     user.role,
                exp:      Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            });

            return {
                status:  'success',
                message: 'Login berhasil!',
                data: {
                    username: user.username,
                    nama:     namaLengkap,
                    role:     user.role,
                    token,
                },
            };
        } catch (error: any) {
            console.error('[LOG LOGIN] 🔥 ERROR:', error.message);
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });
