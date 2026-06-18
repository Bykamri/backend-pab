import mysql from 'mysql2/promise';
import postgres from 'postgres';

const isProd = process.env.NODE_ENV === 'production';
// Gunakan POSTGRES_PRISMA_URL (dari integrasi) atau fallback ke DATABASE_URL (lokal)
const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL!;

let mysqlPool: mysql.Pool;
let pgClient: postgres.Sql;

if (isProd) {
    pgClient = postgres(dbUrl, { 
        ssl: 'require',
        max: 1, 
        idle_timeout: 0 ,
        connect_timeout: 0
    });
    console.log("🔌 Mode Database: PostgreSQL (Production / Supabase)");
} else {
    mysqlPool = mysql.createPool(dbUrl);
    console.log("🔌 Mode Database: MySQL (Development / Lokal)");
}

export async function executeQuery(query: string, params: any[] = []): Promise<any[]> {
    if (isProd) {
        let pgQuery = query;
        params.forEach((_, index) => {
            pgQuery = pgQuery.replace('?', `$${index + 1}`);
        });
        
        const result = await pgClient.unsafe(pgQuery, params);
        
        return result as any[];
    } else {

        const [rows] = await mysqlPool.execute(query, params);
        
        return rows as any[];
    }
}