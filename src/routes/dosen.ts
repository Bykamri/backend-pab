// src/routes/dosen.ts
import { Elysia } from 'elysia';
import { executeQuery } from '../db';
import { authGuard } from '../middleware/authGuard';
import { uploadFile } from '../storage';

export const dosenRoutes = new Elysia({ prefix: '/dosen' })
    // Pasang middleware pelindung di tingkat grup
    .use(authGuard)

    // ==========================================
    // 1. MELIHAT DAFTAR DOSEN (Bisa diakses Semua)
    // ==========================================
    .get('/', async ({ user, set }: any) => {
        if (!user) {
            set.status = 401;
            return { status: 'error', message: 'Akses ditolak. Harap login.' };
        }

        try {
            // Semua orang (termasuk mahasiswa) boleh melihat daftar dosen aktif
            const sql = `SELECT kodedsn, nama, kelamin, prodi FROM dosen WHERE aktif = true ORDER BY nama ASC`;
            const rows = await executeQuery(sql);
            return { status: 'success', data: rows };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 2. PROFIL & JADWAL PENGAJARAN DOSEN
    // ==========================================
    .get('/profile', async ({ user, set }: any) => {
        if (!user || user.role !== 'dosen') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Dosen.' };
        }

        try {
            // 1. Ambil Data Diri
            const profil = await executeQuery(`SELECT * FROM dosen WHERE kodedsn = ?`, [user.username]);

            // 2. Ambil Daftar Matakuliah yang Diampu
            const matakuliah = await executeQuery(`
                SELECT mk.kodemk, mk.namamk, mk.sks, dm.semester 
                FROM dosen_matakuliah dm 
                JOIN matakuliah mk ON dm.kodemk = mk.kodemk 
                WHERE dm.kodedsn = ?
            `, [user.username]);

            // 3. Ambil Daftar Mahasiswa Wali (Anak Wali)
            const mahasiswaWali = await executeQuery(`
                SELECT nim, nama, angkatan, prodi, lulus 
                FROM mahasiswa 
                WHERE kodedsn = ?
            `, [user.username]);

            return { 
                status: 'success', 
                data: {
                    profil: profil[0] || null,
                    matakuliah_diampu: matakuliah,
                    mahasiswa_wali: mahasiswaWali
                }
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 3. EDIT DATA DIRI (Dibatasi)
    // ==========================================
    .put('/profile', async ({ body, user, set }: any) => {
        if (!user || user.role !== 'dosen') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Dosen.' };
        }

        // HANYA ekstrak field yang diizinkan (nama, kelamin, tgl_lahir)
        // Jika frontend mengirim prodi atau aktif, akan otomatis diabaikan!
        const { nama, kelamin, tgl_lahir } = body;

        try {
            // Kunci update pada user.username (kodedsn) dari token
            const sql = `UPDATE dosen SET nama = ?, kelamin = ?, tgl_lahir = ? WHERE kodedsn = ?`;
            await executeQuery(sql, [nama, kelamin, tgl_lahir, user.username]);
            
            return { status: 'success', message: 'Data profil berhasil diperbarui' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // PUT /dosen/foto -> Upload Foto Profil Dosen
    .put('/foto', async ({ body, user, set }: any) => {
        if (!user || user.role !== 'dosen') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Dosen.' };
        }

        const { foto } = body;

        if (!foto || foto.size === 0) {
            set.status = 400;
            return { status: 'error', message: 'Harap lampirkan file foto.' };
        }

        try {
            // Upload file ke server menggunakan kodedsn sebagai penanda
            const fotoUrl = await uploadFile(foto, `foto_${user.username}`);
            
            if (fotoUrl) {
                // Update tabel dosen
                await executeQuery('UPDATE dosen SET foto = ? WHERE kodedsn = ?', [fotoUrl, user.username]);
                
                return { 
                    status: 'success', 
                    message: 'Foto profil berhasil diperbarui.',
                    url: fotoUrl // Mengembalikan URL agar frontend bisa langsung me-render gambarnya
                };
            }

            return { status: 'error', message: 'Gagal memproses file upload.' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 4. DAFTAR MAHASISWA DI KELAS & INPUT NILAI
    // ==========================================
    
    // Melihat daftar mahasiswa yang mengikuti matakuliah yang diajarkan oleh dosen ini
    .get('/kelas', async ({ user, set }: any) => {
        if (!user || user.role !== 'dosen') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Dosen.' };
        }

        try {
            // Melakukan JOIN kompleks: krs -> mahasiswa -> matakuliah -> dosen_matakuliah
            // Hanya menampilkan KRS untuk matakuliah yang terdaftar di dosen_matakuliah milik dosen tersebut
            const sql = `
                SELECT k.id AS id_krs, m.nim, m.nama AS nama_mahasiswa, mk.kodemk, mk.namamk, dm.semester, k.nilai_huruf
                FROM krs k
                JOIN mahasiswa m ON k.nim = m.nim
                JOIN matakuliah mk ON k.kodemk = mk.kodemk
                JOIN dosen_matakuliah dm ON mk.kodemk = dm.kodemk
                WHERE dm.kodedsn = ?
                ORDER BY mk.namamk ASC, m.nim ASC
            `;
            const barisKelas = await executeQuery(sql, [user.username]);
            return { status: 'success', data: barisKelas };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // Input atau Ubah Nilai Huruf Mahasiswa di KRS
    .put('/input-nilai/:id_krs', async ({ params, body, user, set }: any) => {
        if (!user || user.role !== 'dosen') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Dosen.' };
        }

        const { nilai_huruf } = body;

        try {
            // LAPISAN KEAMANAN: Pastikan id_krs ini benar-benar milik matakuliah yang diampu oleh Dosen yang sedang login
            const cekValiditas = await executeQuery(`
                SELECT k.id 
                FROM krs k
                JOIN dosen_matakuliah dm ON k.kodemk = dm.kodemk
                WHERE k.id = ? AND dm.kodedsn = ?
            `, [params.id_krs, user.username]);

            if (cekValiditas.length === 0) {
                set.status = 403;
                return { status: 'error', message: 'Akses ditolak! Anda tidak mengajar matakuliah untuk entri KRS ini.' };
            }

            // Jika lolos validasi, lakukan update nilai
            await executeQuery(
                `UPDATE krs SET nilai_huruf = ? WHERE id = ?`, 
                [nilai_huruf, params.id_krs]
            );

            return { status: 'success', message: 'Nilai huruf berhasil disimpan ke KRS mahasiswa' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });