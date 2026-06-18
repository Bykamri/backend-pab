// File: api/index.ts
import { app } from '../src/index';

// PAKSA Vercel menggunakan Node.js Serverless (Bukan Edge)
export const config = {
    runtime: 'nodejs'
};

// Meneruskan request ke aplikasi Elysia
export default async function handler(request: Request) {
    return app.handle(request);
}