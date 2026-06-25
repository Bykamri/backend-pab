// src/routes/matakuliah.ts
import { Elysia } from 'elysia';
import { executeQuery } from '../db';
import { authGuard } from '../middleware/authGuard';

export const matakuliahRoutes = new Elysia({ prefix: '/matakuliah' })
    .use(authGuard)

    .get('/', async ({ user, set }: any) => {
        if (!user) {
            set.status = 401;
            return { status: 'error', message: 'Akses ditolak. Harap login terlebih dahulu.' };
        }

        try {
            const rows = await executeQuery('SELECT * FROM matakuliah ORDER BY kodemk ASC');
            return { status: 'success', data: rows };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    })

    .get('/:kodemk', async ({ params, user, set }: any) => {
        if (!user) {
            set.status = 401;
            return { status: 'error', message: 'Akses ditolak.' };
        }

        try {
            const detailMk = await executeQuery(
                'SELECT * FROM matakuliah WHERE kodemk = ?', 
                [params.kodemk]
            );

            if (detailMk.length === 0) {
                set.status = 404;
                return { status: 'error', message: 'Matakuliah tidak ditemukan.' };
            }

            // Semua pengampu (mungkin di slot jam berbeda)
            const semuaPengampu = await executeQuery(`
                SELECT dm.id AS id_dm, d.kodedsn, d.nama, d.prodi, dm.semester, dm.jam_kuliah
                FROM dosen_matakuliah dm
                JOIN dosen d ON dm.kodedsn = d.kodedsn
                WHERE dm.kodemk = ? AND d.aktif = 1
                ORDER BY dm.jam_kuliah NULLS LAST, dm.semester DESC
            `, [params.kodemk]);

            // Untuk mahasiswa: ambil krs (jam dipilih + nilai) miliknya
            let nilaiSaya: string | null = null;
            let sudahAmbil = false;
            let jamSaya: string | null = null;
            if (user.role === 'mahasiswa') {
                const krsSaya = await executeQuery(
                    'SELECT nilai_huruf, jam_kuliah FROM krs WHERE nim = ? AND kodemk = ?',
                    [user.username, params.kodemk]
                );
                if (krsSaya.length > 0) {
                    sudahAmbil = true;
                    nilaiSaya = krsSaya[0].nilai_huruf ?? null;
                    jamSaya = krsSaya[0].jam_kuliah ?? null;
                }
            }

            // Filter pengampu untuk mahasiswa: hanya yang jam_kuliah-nya sama dengan jam yang dia ambil.
            // Kalau mahasiswa belum ambil atau jam_kuliah null, kirim semua (nothing-to-hide).
            const dosenPengampu = user.role === 'mahasiswa' && sudahAmbil && jamSaya
                ? semuaPengampu.filter((p: any) => p.jam_kuliah === jamSaya)
                : semuaPengampu;

            // Untuk tiap pengampu, ambil daftar mahasiswa peserta di SLOT JAM yang sama.
            // Hanya untuk role admin/dosen — privacy mahasiswa.
            let pengampuWithPeserta: any[] = dosenPengampu;
            if (user.role === 'admin' || user.role === 'dosen') {
                pengampuWithPeserta = await Promise.all(dosenPengampu.map(async (p: any) => {
                    const peserta = p.jam_kuliah
                        ? await executeQuery(`
                            SELECT k.id AS id_krs, m.nim, m.nama, m.prodi, m.angkatan, k.nilai_huruf, k.jam_kuliah
                            FROM krs k
                            JOIN mahasiswa m ON k.nim = m.nim
                            WHERE k.kodemk = ? AND k.jam_kuliah = ?
                            ORDER BY m.angkatan DESC, m.nim ASC
                        `, [params.kodemk, p.jam_kuliah])
                        : await executeQuery(`
                            SELECT k.id AS id_krs, m.nim, m.nama, m.prodi, m.angkatan, k.nilai_huruf, k.jam_kuliah
                            FROM krs k
                            JOIN mahasiswa m ON k.nim = m.nim
                            WHERE k.kodemk = ? AND (k.jam_kuliah IS NULL OR k.jam_kuliah = '')
                            ORDER BY m.angkatan DESC, m.nim ASC
                        `, [params.kodemk]);
                    return { ...p, mahasiswa_peserta: peserta };
                }));
            }

            return {
                status: 'success',
                data: {
                    matakuliah: detailMk[0],
                    dosen_pengampu: pengampuWithPeserta,
                    nilai_saya: nilaiSaya,
                    sudah_ambil: sudahAmbil,
                    jam_saya: jamSaya,
                }
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });