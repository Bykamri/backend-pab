// src/middleware/authGuard.ts
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';


export const authGuard = new Elysia({ name: 'authGuard' })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'rahasia_akademik_siola_123'        })
    )
    // 1. Ekstrak dan Verifikasi Token (derive)
    .derive({as: "scoped"}, async ({ jwt, headers, request }) => {
        const authHeader = headers['authorization'] || request.headers.get('authorization');
        let user = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const payload = await jwt.verify(token);
                if (payload) {
                    user = {
                        username: payload.username as string,
                        role: (payload.role as string).trim().toLowerCase()
                    };
                }
            } catch (error) {}
        }
        return { user };
    })
    // 2. Terapkan "Penjagaan" secara ketat di sini (onBeforeHandle)
    .onBeforeHandle(({ user, set }) => {
        console.log('\n[AUTH GUARD] Memeriksa Token...');
        if (!user) {
            console.log('[AUTH GUARD] ❌ GAGAL: Token tidak ditemukan atau tidak valid.');
            set.status = 401;
            return { status: 'error', message: 'Akses ditolak. Harap login terlebih dahulu.' };
        }
        console.log(`[AUTH GUARD] ✅ SUKSES: User ${user.username} (Role: ${user.role})`);
    });