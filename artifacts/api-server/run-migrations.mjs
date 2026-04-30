import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const dir = './migrations';
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY, checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(), execution_time_ms INTEGER);`);

const applied = new Set((await pool.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename));

let ok = 0, skipped = 0, failed = 0;
for (const file of files) {
  if (applied.has(file)) { skipped++; continue; }
  const sql = readFileSync(join(dir, file), 'utf8');
  const cs = createHash('sha256').update(sql).digest('hex');
  const start = Date.now();
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename, checksum, execution_time_ms) VALUES ($1, $2, $3)', [file, cs, Date.now() - start]);
    await pool.query('COMMIT');
    console.log(`✓ ${file} (${Date.now() - start}ms)`);
    ok++;
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error(`✗ ${file}: ${e.message}`);
    failed++;
    break;
  }
}
console.log(`\nApplied: ${ok}, Skipped: ${skipped}, Failed: ${failed}`);
await pool.end();
