import Redis from 'ioredis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

let _redis = null;

export function getRedis() {
  if (!_redis && process.env.REDIS_URL) {
    _redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });
  }
  return _redis;
}

export async function closeRedis() {
  if (_redis) {
    await _redis.quit().catch(() => {});
    _redis = null;
  }
}

export async function resetBruteForceByEmail(email) {
  const redis = getRedis();
  if (!redis) return { cleared: 0, storage: 'unavailable' };

  try {
    await redis.connect();
  } catch {
    // already connected
  }

  const normalizedEmail = email.toLowerCase().trim();
  const key = `bruteforce:email:${normalizedEmail}`;

  try {
    const existed = await redis.exists(key);
    if (existed) {
      await redis.del(key);
      return { cleared: 1, storage: 'redis' };
    }
    return { cleared: 0, storage: 'redis' };
  } catch (err) {
    return { cleared: 0, storage: 'redis', error: err.message };
  }
}

export async function getBruteForceStatus(email) {
  const redis = getRedis();
  if (!redis) return { locked: false, attempts: 0, storage: 'unavailable' };

  try {
    await redis.connect();
  } catch {
    // already connected
  }

  const normalizedEmail = email.toLowerCase().trim();
  const key = `bruteforce:email:${normalizedEmail}`;

  try {
    const data = await redis.get(key);
    if (!data) return { locked: false, attempts: 0, storage: 'redis' };
    const entry = JSON.parse(data);
    const now = Date.now();
    const locked = !!(entry.lockedUntil && now < entry.lockedUntil);
    return {
      locked,
      attempts: entry.attempts || 0,
      lockedUntil: entry.lockedUntil || null,
      storage: 'redis',
    };
  } catch (err) {
    return { locked: false, attempts: 0, storage: 'redis', error: err.message };
  }
}
