import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL (or NEON_DATABASE_URL) must be set. Did you forget to provision a database?",
  );
}

const isNeon = !process.env.DATABASE_URL && !!process.env.NEON_DATABASE_URL;

// Enable SSL when:
//  1. Using Neon (always requires SSL).
//  2. DB_SSL=true env var is explicitly set (useful for managed VPS databases like
//     DigitalOcean Managed PostgreSQL, AWS RDS, Supabase, etc.).
//  3. The connection string contains sslmode=require or sslmode=prefer.
//
// rejectUnauthorized: false is used so self-signed certificates common on
// managed hosting providers don't block the connection. This is equivalent
// to psql's sslmode=require — encryption is enforced but the CA is not verified.
// For strict CA verification, set DB_SSL_REJECT_UNAUTHORIZED=true.
const urlHasSSL =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("sslmode=prefer");
const explicitSSL =
  process.env["DB_SSL"] === "true" || process.env["DB_SSL"] === "1";
const sslEnabled = isNeon || urlHasSSL || explicitSSL;
const rejectUnauthorized =
  process.env["DB_SSL_REJECT_UNAUTHORIZED"] === "true";

export const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
