// src/routes/admin.ts
import { Elysia } from 'elysia';
import { executeQuery } from '../db';
import { authGuard } from '../middleware/authGuard';


export const adminRoutes = new Elysia({ prefix: '/admin' })
    .use(authGuard)
    
    // ⚠️ HAPUS ': any' di sini agar Elysia bisa membaca parameter 'user' dengan benar
    .onBeforeHandle(({ user, set }) => {
        console.log('[ROUTE ADMIN] Pengecekan Role:', user?.role);
        
        if (user?.role !== 'admin') {
            console.log('[ROUTE ADMIN] ⛔ Akses Ditolak! Area khusus Super Admin.');
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Area khusus Super Admin.' };
        }
    })

    // ==========================================
    // 1. DASHBOARD STATISTIK
    // ==========================================
    .get('/dashboard', async () => {
        try {
            const [mhs] = await executeQuery('SELECT COUNT(*) as total FROM mahasiswa');
            const [dsn] = await executeQuery('SELECT COUNT(*) as total FROM dosen');
            const [mk]  = await executeQuery('SELECT COUNT(*) as total FROM matakuliah');
            
            return {
                status: 'success',
                data: {
                    total_mahasiswa: mhs?.total || 0,
                    total_dosen: dsn?.total || 0,
                    total_matakuliah: mk?.total || 0
                }
            };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 2. MANAJEMEN MASTER MATAKULIAH
    // ==========================================
    
    // Tambah Matakuliah Baru
    .post('/matakuliah', async ({ body, set }: any) => {
        const { kodemk, namamk, sks } = body;
        try {
            await executeQuery('INSERT INTO matakuliah (kodemk, namamk, sks) VALUES (?, ?, ?)', [kodemk, namamk, sks]);
            return { status: 'success', message: 'Matakuliah berhasil ditambahkan' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // Update Matakuliah
    .put('/matakuliah/:kodemk', async ({ params, body, set }: any) => {
        const { namamk, sks } = body;
        try {
            await executeQuery('UPDATE matakuliah SET namamk=?, sks=? WHERE kodemk=?', [namamk, sks, params.kodemk]);
            return { status: 'success', message: 'Matakuliah berhasil diperbarui' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // Hapus Matakuliah
    .delete('/matakuliah/:kodemk', async ({ params, set }: any) => {
        try {
            await executeQuery('DELETE FROM matakuliah WHERE kodemk=?', [params.kodemk]);
            return { status: 'success', message: 'Matakuliah berhasil dihapus' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 4. MANAJEMEN MASTER DOSEN
    // ==========================================
    .post('/dosen', async ({ body, set }: any) => {
        const { kodedsn, nama, kelamin, tgl_lahir, prodi, aktif } = body;
        try {
            await executeQuery('INSERT INTO dosen (kodedsn, nama, kelamin, tgl_lahir, prodi, aktif) VALUES (?, ?, ?, ?, ?, ?)', [kodedsn, nama, kelamin, tgl_lahir, prodi, aktif]);
            return { status: 'success', message: 'Dosen berhasil ditambahkan' };
        } catch (error: any) {
            set.status = 500; return { status: 'error', message: error.message };
        }
    })
    .put('/dosen/:kodedsn', async ({ params, body, set }: any) => {
        const { nama, kelamin, tgl_lahir, prodi, aktif } = body;
        try {
            await executeQuery('UPDATE dosen SET nama=?, kelamin=?, tgl_lahir=?, prodi=?, aktif=? WHERE kodedsn=?', [nama, kelamin, tgl_lahir, prodi, aktif, params.kodedsn]);
            return { status: 'success', message: 'Data dosen berhasil diperbarui' };
        } catch (error: any) {
            set.status = 500; return { status: 'error', message: error.message };
        }
    })
    .delete('/dosen/:kodedsn', async ({ params, set }: any) => {
        try {
            await executeQuery('DELETE FROM dosen WHERE kodedsn=?', [params.kodedsn]);
            return { status: 'success', message: 'Dosen berhasil dihapus' };
        } catch (error: any) {
            set.status = 500; return { status: 'error', message: error.message };
        }
    })

    // ==========================================
    // 3. MANAJEMEN AKUN LOGIN (TABEL USERS)
    // ==========================================
    
    // Lihat semua akun sistem
    .get('/users', async () => {
        try {
            // Kita tidak menampilkan password hash demi keamanan
            const rows = await executeQuery('SELECT id, username, role, created_at FROM users ORDER BY role ASC, id DESC');
            return { status: 'success', data: rows };
        } catch (error: any) {
            return { status: 'error', message: error.message };
        }
    })

    // Reset Password Akun (Jika dosen/mhs lupa password)
    .put('/users/reset-password/:username', async ({ params, body, set }: any) => {
        const { new_password } = body;
        
        try {
            const hashedPassword = await Bun.password.hash(new_password, { algorithm: "bcrypt", cost: 10 });
            await executeQuery('UPDATE users SET password=? WHERE username=?', [hashedPassword, params.username]);
            
            return { status: 'success', message: `Password untuk user ${params.username} berhasil di-reset` };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // Hapus Akun Login (Misal mahasiswa sudah lulus atau DO)
    .delete('/users/:username', async ({ params, set }: any) => {
        // Mencegah admin menghapus dirinya sendiri secara tidak sengaja
        if (params.username === 'admin_akademik') {
            set.status = 400;
            return { status: 'error', message: 'Tidak dapat menghapus akun master admin!' };
        }

        try {
            await executeQuery('DELETE FROM users WHERE username=?', [params.username]);
            return { status: 'success', message: `Akun ${params.username} berhasil dihapus dari sistem login` };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });