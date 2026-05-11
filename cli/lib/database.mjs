import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const { Pool } = pg;

function shouldUseSsl(connectionString) {
  if (!connectionString) return false;
  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) return false;
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
    if (sslMode === 'disable') return false;
    if (sslMode) return true;
    return true;
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

let _pool = null;

export function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: shouldUseSsl(process.env.DATABASE_URL)
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
    });
  }
  return _pool;
}

export async function query(sql, params = []) {
  const pool = getPool();
  return pool.query(sql, params);
}

export async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
