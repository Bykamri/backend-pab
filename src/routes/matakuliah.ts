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

            const dosenPengampu = await executeQuery(`
                SELECT d.kodedsn, d.nama, dm.semester 
                FROM dosen_matakuliah dm
                JOIN dosen d ON dm.kodedsn = d.kodedsn
                WHERE dm.kodemk = ? AND d.aktif = 1
                ORDER BY dm.semester DESC
            `, [params.kodemk]);

            return { 
                status: 'success', 
                data: {
                    matakuliah: detailMk[0],
                    dosen_pengampu: dosenPengampu
                } 
            };
        } catch (error: any) {
            set.status = 500;
            return { status: 'error', message: error.message };
        }
    });