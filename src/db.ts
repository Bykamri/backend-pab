// src/db.ts
import mysql from 'mysql2/promise';
import postgres from 'postgres';

// isProd = true jika di Vercel atau ada POSTGRES_URL
const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.POSTGRES_PRISMA_URL ||
    !!process.env.POSTGRES_URL;

const dbUrl =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL!;

let mysqlPool: mysql.Pool;
let pgClient: postgres.Sql;

if (isProd) {
    pgClient = postgres(dbUrl, {
        ssl: 'require',
        max: 5,
        idle_timeout: 20,
        connect_timeout: 10,
    });
    console.log('🔌 Mode Database: PostgreSQL (Supabase)');
} else {
    mysqlPool = mysql.createPool(process.env.DATABASE_URL!);
    console.log('🔌 Mode Database: MySQL (Development / Lokal XAMPP)');
}

/**
 * Konversi query MySQL ke PostgreSQL secara otomatis.
 * Mengganti placeholder `?` → `$1, $2, ...`
 * Mengganti backtick identifier → tanda kutip ganda
 * Mengganti fungsi MySQL → ekuivalen PostgreSQL
 */
function convertToPostgres(query: string, params: any[]): string {
    let pgQuery = query;

    // Ganti backtick (MySQL) → double-quote (PostgreSQL)
    pgQuery = pgQuery.replace(/`([^`]+)`/g, '"$1"');

    // Ganti fungsi MySQL → PostgreSQL
    pgQuery = pgQuery.replace(/\bNOW\(\)/gi, 'NOW()');
    pgQuery = pgQuery.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');
    pgQuery = pgQuery.replace(/\bCURTIME\(\)/gi, 'CURRENT_TIME');
    pgQuery = pgQuery.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
    pgQuery = pgQuery.replace(/\bIF\s*\(/gi, 'CASE WHEN '); // partial, handle manual jika perlu

    // Ganti LIMIT ?, ? → LIMIT $n OFFSET $m (MySQL pakai 2 arg, PG pakai keyword OFFSET)
    // Pola: LIMIT ?, ? → ditangani lewat nomor placeholder di bawah

    // Ganti setiap `?` → `$1`, `$2`, dst.
    let counter = 0;
    pgQuery = pgQuery.replace(/\?/g, () => `$${++counter}`);

    return pgQuery;
}

/**
 * Normalisasi nilai hasil query PostgreSQL agar konsisten dengan MySQL.
 * - PostgreSQL mengembalikan BigInt untuk COUNT(*) → ubah ke Number
 * - Boolean PostgreSQL (true/false) → 1/0 (opsional, aktifkan jika perlu)
 */
function normalizeRows(rows: any[]): any[] {
    return rows.map((row) => {
        const normalized: Record<string, any> = {};
        for (const key of Object.keys(row)) {
            const val = row[key];
            if (typeof val === 'bigint') {
                normalized[key] = Number(val);
            } else {
                normalized[key] = val;
            }
        }
        return normalized;
    });
}

export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
    if (isProd) {
        const pgQuery = convertToPostgres(query, params);
        const result = await pgClient.unsafe(pgQuery, params as any);
        return normalizeRows(result as any[]);
    } else {
        const [rows] = await mysqlPool.execute(query, params);
        return rows as any[];
    }
}

/**
 * Menjalankan beberapa query sebagai satu transaction atomik.
 * Jika salah satu query gagal, semua perubahan di-rollback.
 *
 * Penting untuk operasi multi-tabel seperti registrasi (insert ke
 * `users` + `mahasiswa` sekaligus) agar tidak ada data "setengah jadi"
 * jika salah satu insert gagal di tengah jalan.
 */
export async function executeTransaction(
    operations: { query: string; params: any[] }[]
): Promise<void> {
    if (isProd) {
        await pgClient.begin(async (sql) => {
            for (const op of operations) {
                const pgQuery = convertToPostgres(op.query, op.params);
                await sql.unsafe(pgQuery, op.params as any);
            }
        });
    } else {
        const connection = await mysqlPool.getConnection();
        try {
            await connection.beginTransaction();
            for (const op of operations) {
                await connection.execute(op.query, op.params);
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}
