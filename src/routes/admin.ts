// src/routes/admin.ts
import { Elysia } from 'elysia';
import { executeQuery } from '../db';
import { authGuard } from '../middleware/authGuard';

export const adminRoutes = new Elysia({ prefix: '/admin' })
    .use(authGuard)

    .onBeforeHandle(({ user, set }: any) => {
        console.log('[ROUTE ADMIN] Pengecekan Role:', user?.role);
        if (user?.role !== 'admin') {
            console.log('[ROUTE ADMIN] ⛔ Akses Ditolak!');
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Area khusus Super Admin.' };
        }
    })

    // ==========================================
    // 1. DASHBOARD STATISTIK
    // ==========================================
    .get('/dashboard', async () => {
        try {
            // PostgreSQL: COUNT(*) mengembalikan BigInt, sudah dinormalisasi di executeQuery
            const [mhs] = await executeQuery('SELECT COUNT(*) AS total FROM mahasiswa');
            const [dsn] = await executeQuery('SELECT COUNT(*) AS total FROM dosen');
            const [mk]  = await executeQuery('SELECT COUNT(*) AS total FROM matakuliah');

            return {
                status: 'success',
                data: {
                    total_mahasiswa:  Number(mhs?.total  ?? 0),
                    total_dosen:      Number(dsn?.total  ?? 0),
                    total_matakuliah: Number(mk?.total   ?? 0),
                },
            };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 1b. STATISTIK PER PRODI (untuk chart)
    // ==========================================
    .get('/stats-prodi', async () => {
        try {
            const mhsRows = await executeQuery(
                `SELECT prodi, COUNT(*) AS total
                 FROM mahasiswa
                 WHERE prodi IS NOT NULL AND prodi <> ''
                 GROUP BY prodi
                 ORDER BY total DESC`
            );
            const dsnRows = await executeQuery(
                `SELECT prodi, COUNT(*) AS total
                 FROM dosen
                 WHERE prodi IS NOT NULL AND prodi <> ''
                 GROUP BY prodi
                 ORDER BY total DESC`
            );

            return {
                status: 'success',
                data: {
                    mahasiswa: mhsRows.map((r: any) => ({ prodi: r.prodi, total: Number(r.total ?? 0) })),
                    dosen:     dsnRows.map((r: any) => ({ prodi: r.prodi, total: Number(r.total ?? 0) })),
                },
            };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 2. MANAJEMEN MASTER MATAKULIAH
    // ==========================================
    .post('/matakuliah', async ({ body, set }: any) => {
        const { kodemk, namamk, sks, jam_kuliah, prodi } = body;
        try {
            await executeQuery(
                'INSERT INTO matakuliah (kodemk, namamk, sks, jam_kuliah, prodi) VALUES (?, ?, ?, ?, ?)',
                [kodemk, namamk, sks, jam_kuliah ?? null, prodi ?? null]
            );
            return { status: 'success', message: 'Matakuliah berhasil ditambahkan' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .put('/matakuliah/:kodemk', async ({ params, body, set }: any) => {
        const { namamk, sks, jam_kuliah, prodi } = body;
        try {
            await executeQuery(
                'UPDATE matakuliah SET namamk = ?, sks = ?, jam_kuliah = ?, prodi = ? WHERE kodemk = ?',
                [namamk, sks, jam_kuliah ?? null, prodi ?? null, params.kodemk]
            );
            return { status: 'success', message: 'Matakuliah berhasil diperbarui' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // Admin: lihat semua nilai mahasiswa di sebuah matakuliah
    .get('/matakuliah/:kodemk/nilai', async ({ params, set }: any) => {
        try {
            const rows = await executeQuery(`
                SELECT k.id AS id_krs, m.nim, m.nama AS nama_mahasiswa, m.prodi, m.angkatan,
                       k.nilai_huruf
                FROM krs k
                JOIN mahasiswa m ON k.nim = m.nim
                WHERE k.kodemk = ?
                ORDER BY m.angkatan DESC, m.nim ASC
            `, [params.kodemk]);
            return { status: 'success', data: rows };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .delete('/matakuliah/:kodemk', async ({ params, set }: any) => {
        try {
            await executeQuery(
                'DELETE FROM matakuliah WHERE kodemk = ?',
                [params.kodemk]
            );
            return { status: 'success', message: 'Matakuliah berhasil dihapus' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 3. MANAJEMEN MASTER DOSEN
    // ==========================================
    .post('/dosen', async ({ body, set }: any) => {
        const { kodedsn, nama, kelamin, tgl_lahir, prodi, aktif } = body;
        try {
            await executeQuery(
                'INSERT INTO dosen (kodedsn, nama, kelamin, tgl_lahir, prodi, aktif) VALUES (?, ?, ?, ?, ?, ?)',
                [kodedsn, nama, kelamin, tgl_lahir, prodi, aktif]
            );
            return { status: 'success', message: 'Dosen berhasil ditambahkan' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .put('/dosen/:kodedsn', async ({ params, body, set }: any) => {
        const { nama, kelamin, tgl_lahir, prodi, aktif } = body;
        try {
            await executeQuery(
                'UPDATE dosen SET nama = ?, kelamin = ?, tgl_lahir = ?, prodi = ?, aktif = ? WHERE kodedsn = ?',
                [nama, kelamin, tgl_lahir, prodi, aktif, params.kodedsn]
            );
            return { status: 'success', message: 'Data dosen berhasil diperbarui' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .delete('/dosen/:kodedsn', async ({ params, set }: any) => {
        try {
            await executeQuery(
                'DELETE FROM dosen WHERE kodedsn = ?',
                [params.kodedsn]
            );
            return { status: 'success', message: 'Dosen berhasil dihapus' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 4. MANAJEMEN MAHASISWA (Admin full CRUD)
    // ==========================================
    .post('/mahasiswa', async ({ body, set }: any) => {
        const { nim, nama, angkatan, kelamin, tgl_lahir, prodi, kodedsn, lulus } = body;
        try {
            await executeQuery(
                'INSERT INTO mahasiswa (nim, nama, angkatan, kelamin, tgl_lahir, prodi, kodedsn, lulus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [nim, nama, angkatan, kelamin, tgl_lahir, prodi, kodedsn, lulus ?? 0]
            );
            return { status: 'success', message: 'Data mahasiswa berhasil ditambahkan' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .put('/mahasiswa/:nim', async ({ params, body, set }: any) => {
        const { nama, angkatan, kelamin, tgl_lahir, prodi, lulus, kodedsn } = body;
        try {
            await executeQuery(
                'UPDATE mahasiswa SET nama = ?, angkatan = ?, kelamin = ?, tgl_lahir = ?, prodi = ?, lulus = ?, kodedsn = ? WHERE nim = ?',
                [nama, angkatan, kelamin, tgl_lahir, prodi, lulus, kodedsn, params.nim]
            );
            return { status: 'success', message: 'Data mahasiswa berhasil diubah' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .delete('/mahasiswa/:nim', async ({ params, set }: any) => {
        try {
            await executeQuery('DELETE FROM mahasiswa WHERE nim = ?', [params.nim]);
            return { status: 'success', message: 'Data mahasiswa berhasil dihapus' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 5. MANAJEMEN AKUN LOGIN (TABEL USERS)
    // ==========================================
    .get('/users', async () => {
        try {
            const rows = await executeQuery(
                'SELECT id, username, role, created_at FROM users ORDER BY role ASC, id DESC'
            );
            return { status: 'success', data: rows };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    })

    .put('/users/reset-password/:username', async ({ params, body, set }: any) => {
        const { new_password } = body;
        try {
            const hashedPassword = await Bun.password.hash(new_password, {
                algorithm: 'bcrypt',
                cost: 10,
            });
            await executeQuery(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, params.username]
            );
            return {
                status: 'success',
                message: `Password untuk user ${params.username} berhasil di-reset`,
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .delete('/users/:username', async ({ params, set }: any) => {
        if (params.username === 'admin_akademik') {
            set.status = 400;
            return { status: 'error', message: 'Tidak dapat menghapus akun master admin!' };
        }
        try {
            await executeQuery('DELETE FROM users WHERE username = ?', [params.username]);
            return {
                status: 'success',
                message: `Akun ${params.username} berhasil dihapus dari sistem`,
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });
