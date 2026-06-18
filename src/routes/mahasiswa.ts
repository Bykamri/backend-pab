// src/routes/mahasiswa.ts
import { Elysia } from 'elysia';
import { executeQuery } from '../db';
import { authGuard } from '../middleware/authGuard';
import { uploadFile } from '../storage';

export const mahasiswaRoutes = new Elysia({ prefix: '/mahasiswa' })
    .use(authGuard)

    // GET /mahasiswa/profile → Profil + KRS milik mahasiswa yang login
    .get('/profile', async ({ user, set }: any) => {
        if (!user || user.role !== 'mahasiswa') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Mahasiswa.' };
        }

        try {
            const profil = await executeQuery(
                `SELECT m.*, d.nama AS nama_dosen_wali
                 FROM mahasiswa m
                 LEFT JOIN dosen d ON m.kodedsn = d.kodedsn
                 WHERE m.nim = ?`,
                [user.username]
            );

            const krs = await executeQuery(
                `SELECT mk.kodemk, mk.namamk, mk.sks, k.nilai_huruf
                 FROM krs k
                 JOIN matakuliah mk ON k.kodemk = mk.kodemk
                 WHERE k.nim = ?`,
                [user.username]
            );

            return {
                status: 'success',
                data: { profil: profil[0] || null, krs },
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // PUT /mahasiswa/profile → Update data diri sendiri
    .put('/profile', async ({ body, user, set }: any) => {
        if (!user || user.role !== 'mahasiswa') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Mahasiswa.' };
        }

        const { nama, kelamin, tgl_lahir } = body;

        try {
            await executeQuery(
                'UPDATE mahasiswa SET nama = ?, kelamin = ?, tgl_lahir = ? WHERE nim = ?',
                [nama, kelamin, tgl_lahir, user.username]
            );
            return { status: 'success', message: 'Data diri berhasil diperbarui' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // PUT /mahasiswa/dokumen → Upload foto & ijazah
    .put('/dokumen', async ({ body, user, set }: any) => {
        if (!user || user.role !== 'mahasiswa') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Mahasiswa.' };
        }

        const { foto, ijazah } = body;

        try {
            const sqlUpdates: string[] = [];
            const params: any[]        = [];

            if (foto && foto.size > 0) {
                const fotoUrl = await uploadFile(foto, `foto_${user.username}`);
                if (fotoUrl) {
                    sqlUpdates.push('foto = ?');
                    params.push(fotoUrl);
                }
            }

            if (ijazah && ijazah.size > 0) {
                const ijazahUrl = await uploadFile(ijazah, `ijazah_${user.username}`);
                if (ijazahUrl) {
                    sqlUpdates.push('ijazah = ?');
                    params.push(ijazahUrl);
                }
            }

            if (sqlUpdates.length > 0) {
                params.push(user.username);
                await executeQuery(
                    `UPDATE mahasiswa SET ${sqlUpdates.join(', ')} WHERE nim = ?`,
                    params
                );
                return { status: 'success', message: 'Dokumen berhasil diunggah.' };
            }

            set.status = 400;
            return { status: 'error', message: 'Tidak ada file valid yang diunggah.' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // GET /mahasiswa → Daftar semua mahasiswa (Admin & Dosen)
    .get('/', async ({ user, set }: any) => {
        if (!user || (user.role !== 'admin' && user.role !== 'dosen')) {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Dosen dan Admin.' };
        }

        try {
            const sql = `
                SELECT m.id, m.nim, m.nama, m.angkatan, m.kelamin, m.prodi, m.lulus,
                       d.nama AS nama_dosen_wali
                FROM mahasiswa m
                LEFT JOIN dosen d ON m.kodedsn = d.kodedsn
                ORDER BY m.angkatan DESC, m.nim ASC
            `;
            const rows = await executeQuery(sql);
            return { status: 'success', data: rows };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // POST /mahasiswa → Tambah mahasiswa (Admin)
    .post('/', async ({ body, user, set }: any) => {
        if (!user || user.role !== 'admin') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Admin.' };
        }

        const { nim, nama, angkatan, kelamin, tgl_lahir, prodi, kodedsn } = body;

        try {
            await executeQuery(
                'INSERT INTO mahasiswa (nim, nama, angkatan, kelamin, tgl_lahir, prodi, kodedsn) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [nim, nama, angkatan, kelamin, tgl_lahir, prodi, kodedsn]
            );
            return { status: 'success', message: 'Data mahasiswa baru berhasil ditambahkan' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    // PUT /mahasiswa/:nim → Update mahasiswa (Admin)
    .put('/:nim', async ({ params, body, user, set }: any) => {
        if (!user || user.role !== 'admin') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Admin.' };
        }

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

    // DELETE /mahasiswa/:nim → Hapus mahasiswa (Admin)
    .delete('/:nim', async ({ params, user, set }: any) => {
        if (!user || user.role !== 'admin') {
            set.status = 403;
            return { status: 'error', message: 'Akses ditolak. Khusus Admin.' };
        }

        try {
            await executeQuery('DELETE FROM mahasiswa WHERE nim = ?', [params.nim]);
            return { status: 'success', message: 'Data mahasiswa berhasil dihapus' };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });
