// src/routes/auth.ts
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { executeQuery } from '../db';

// Mapping Kode Prodi sesuai standar
const prodiCodes: Record<string, string> = {
    'Teknik Informatika': '146',
    'Sistem Informasi': '147',
    'Sains Data': '148',
    'Teknik Komputer': '149',
    'Bisnis Digital': '150',
    'Teknik Elektro': '151',
    'Teknik Sipil': '152',
    'Teknik Mesin': '153'
};

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(
        jwt({
            name: 'jwt',
            // WAJIB SAMA DENGAN YANG ADA DI authGuard.ts
            secret: process.env.JWT_SECRET || 'rahasia_akademik_siola_123'
        })
    )

    // ==========================================
    // 1. REGISTER OTOMATIS (Default: Mahasiswa)
    // ==========================================
    .post('/register', async ({ body, set }: any) => {
        // NIM tidak lagi dikirim dari frontend
        const { password, nama, prodi } = body;

        if (!nama || !prodi || !password) {
            set.status = 400;
            return { status: 'error', message: 'Nama, Prodi, dan Password wajib diisi!' };
        }

        try {
            // --- LOGIKA GENERATE NIM ---
            
            // 1. Ambil Kode Prodi (Default '999' jika tidak ada di daftar)
            const kodeProdi = prodiCodes[prodi] || '999';

            // 2. Ambil Tahun dan Pembagian Ganjil/Genap dari Timestamp
            const now = new Date();
            const fullYear = now.getFullYear();               // Contoh: 2026
            const year2Digit = fullYear.toString().slice(-2); // Contoh: "26"
            const month = now.getMonth() + 1;                 // 1 - 12
            
            // Dibagi 2: Bulan 1-6 = Genap (2), Bulan 7-12 = Ganjil (1)
            const semester = month > 6 ? '1' : '2'; 
            
            // Prefix NIM (Contoh: 146 + 26 + 1 = "146261")
            const nimPrefix = `${kodeProdi}${year2Digit}${semester}`;

            // 3. Generate Nomor Urut
            // Cari mahasiswa terakhir yang mendaftar di prodi, tahun, dan semester yang sama
            const lastMhs = await executeQuery(
                `SELECT nim FROM mahasiswa WHERE nim LIKE ? ORDER BY nim DESC LIMIT 1`,
                [`${nimPrefix}%`]
            );

            let noUrut = 1;
            if (lastMhs.length > 0) {
                const lastNim = lastMhs[0].nim;
                // Ambil 3 digit terakhir dari NIM untuk mendapatkan nomor urut
                const lastUrutStr = lastNim.replace(nimPrefix, '');
                const lastUrutNum = parseInt(lastUrutStr, 10);
                if (!isNaN(lastUrutNum)) {
                    noUrut = lastUrutNum + 1;
                }
            }

            // Format urutan menjadi 3 digit (Contoh: "001", "044")
            const noUrutStr = noUrut.toString().padStart(3, '0');
            
            // 4. Rangkai NIM Final
            const generatedNim = `${nimPrefix}${noUrutStr}`; 
            // ---------------------------

            // Hash Password
            const hashedPassword = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });

            // Insert ke tabel 'users'
            await executeQuery(
                `INSERT INTO users (username, password, role) VALUES (?, ?, 'mahasiswa')`,
                [generatedNim, hashedPassword]
            );

            // Insert ke tabel 'mahasiswa' dengan angkatan dari tahun timestamp
            await executeQuery(
                `INSERT INTO mahasiswa (nim, nama, angkatan, prodi, lulus) VALUES (?, ?, ?, ?, 0)`,
                [generatedNim, nama, fullYear.toString(), prodi]
            );

            return { 
                status: 'success', 
                message: 'Registrasi berhasil!',
                data: {
                    nim: generatedNim,
                    nama: nama,
                    prodi: prodi
                }
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

// ==========================================
    // 2. LOGIN UNIVERSAL (Admin, Dosen, Mahasiswa)
    // ==========================================
    .post('/login', async ({ body, jwt, set }: any) => {
        // --- LOG 1: Cek Payload yang masuk ---
        console.log('\n[LOG LOGIN] === Ada Permintaan Login Masuk ===');
        console.log('[LOG LOGIN] Body Request:', body);

        const { username, password } = body;

        try {
            // --- LOG 2: Cek Username ---
            console.log(`[LOG LOGIN] Mencari username: "${username}" di tabel users...`);
            
            const users = await executeQuery('SELECT * FROM users WHERE username = ?', [username]);
            
            // --- LOG 3: Cek Hasil Query Database ---
            console.log(`[LOG LOGIN] Hasil pencarian database:`, users.length > 0 ? 'Ditemukan' : 'Kosong');

            if (users.length === 0) {
                console.log('[LOG LOGIN] ❌ GAGAL: Username tidak ada di tabel users.');
                set.status = 401;
                return { status: 'error', message: 'Username tidak ditemukan!' };
            }

            const user = users[0];
            const isMatch = await Bun.password.verify(password, user.password);
            
            if (!isMatch) {
                console.log('[LOG LOGIN] ❌ GAGAL: Password salah untuk user', username);
                set.status = 401;
                return { status: 'error', message: 'Password salah!' };
            }

            console.log(`[LOG LOGIN] ✅ BERHASIL: User ${username} login sebagai ${user.role}`);

            let namaLengkap = user.username;
            if (user.role === 'mahasiswa') {
                const mhs = await executeQuery('SELECT nama FROM mahasiswa WHERE nim = ?', [user.username]);
                if (mhs.length > 0) namaLengkap = mhs[0].nama;
            } else if (user.role === 'dosen') {
                const dsn = await executeQuery('SELECT nama FROM dosen WHERE kodedsn = ?', [user.username]);
                if (dsn.length > 0) namaLengkap = dsn[0].nama;
            } else if (user.role === 'admin') {
                namaLengkap = 'Super Admin';
            }

            const token = await jwt.sign({ 
                username: user.username,
                role: user.role,
                exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) 
            });

            return { 
                status: 'success', 
                message: 'Login berhasil!', 
                data: { 
                    username: user.username, 
                    nama: namaLengkap,
                    role: user.role,
                    token: token 
                } 
            };
        } catch (error: any) {
            console.error('[LOG LOGIN] 🔥 ERROR SERVER:', error.message);
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });