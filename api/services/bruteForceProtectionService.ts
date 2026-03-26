/**
 * Brute Force Protection Service
 *
 * Provides protection against brute force attacks on authentication endpoints
 * by tracking failed login attempts and implementing progressive delays.
 *
 * Features:
 * - Tracks failed attempts by both IP address and email address
 * - Exponential backoff: 5 attempts → 15 min, 10 → 1 hour, 20 → 24 hours
 * - Redis-based persistence with automatic fallback to in-memory storage
 * - Automatic cleanup of expired entries
 * - Comprehensive logging for security monitoring
 *
 * @security This service helps prevent credential stuffing, dictionary attacks,
 * and other brute force attempts by progressively increasing lockout durations.
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Failed attempt entry structure
 */
interface FailedAttempt {
  identifier: string; // IP address or email
  attempts: number;
  firstAttemptAt: number; // Unix timestamp
  lastAttemptAt: number; // Unix timestamp
  lockedUntil?: number; // Unix timestamp
  type: 'ip' | 'email';
}

/**
 * In-memory fallback storage for when Redis is unavailable
 */
const inMemoryAttempts = new Map<string, FailedAttempt>();

/**
 * Cleanup interval for in-memory storage (every 5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Lockout duration thresholds based on number of failed attempts
 * Format: [minimum attempts, lockout duration in milliseconds]
 */
const LOCKOUT_THRESHOLDS = [
  [5, 15 * 60 * 1000],   // 5 attempts → 15 minutes
  [10, 60 * 60 * 1000],  // 10 attempts → 1 hour
  [20, 24 * 60 * 60 * 1000] // 20 attempts → 24 hours
];

/**
 * Maximum lockout duration cap (7 days)
 */
const MAX_LOCKOUT_DURATION = 7 * 24 * 60 * 60 * 1000;

/**
 * Reset successful attempts window (if no failures in 24 hours, reset counter)
 */
const RESET_WINDOW = 24 * 60 * 60 * 1000;

/**
 * Redis client interface (lazy-loaded)
 */
let redisClient: Redis | null = null;
let redisAvailable = false;

/**
 * Initialize Redis connection (lazy loading)
 */
async function initializeRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  if (!redisUrl) {
    if (process.env.REDIS_HOST || process.env.REDIS_PORT || process.env.REDIS_PASSWORD) {
      console.warn('Brute force protection: REDIS_HOST/REDIS_PORT/REDIS_PASSWORD are no longer supported. Please use REDIS_URL instead.');
    }
    console.log('Brute force protection: Redis not configured, using in-memory storage');
    redisAvailable = false;
    return;
  }

  try {
    const redisOptions: any = {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn('Brute force protection: Redis reconnection failed, using in-memory storage');
          redisAvailable = false;
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    };

    redisClient = new Redis(redisUrl, redisOptions);

    redisClient.on('error', (err) => {
      console.error('Brute force protection Redis error:', err);
      redisAvailable = false;
    });

    redisClient.on('ready', () => {
      console.log('Brute force protection: Redis connection established');
      redisAvailable = true;
    });

    await redisClient.connect();
    redisAvailable = true;
  } catch (error) {
    console.warn('Brute force protection: Failed to connect to Redis, using in-memory storage:', error);
    redisAvailable = false;
    redisClient = null;
  }
}

/**
 * Generate storage key for an identifier
 */
function getStorageKey(identifier: string, type: 'ip' | 'email'): string {
  return `bruteforce:${type}:${identifier}`;
}

/**
 * Calculate lockout duration based on number of failed attempts
 *
 * Uses exponential backoff strategy:
 * - 5 attempts: 15 minutes
 * - 10 attempts: 1 hour
 * - 20 attempts: 24 hours
 * - Caps at 7 days maximum
 *
 * @param attempts - Number of failed attempts
 * @returns Lockout duration in milliseconds
 */
function calculateLockoutDuration(attempts: number): number {
  for (const [threshold, duration] of LOCKOUT_THRESHOLDS) {
    if (attempts >= threshold) {
      return duration as number;
    }
  }

  // No lockout for fewer than 5 attempts
  return 0;
}

/**
 * Track a failed login attempt for both IP and email
 *
 * This method increments the failure counter for both the client IP address
 * and the email address being used. This prevents attackers from bypassing
 * IP-based limits by rotating through different email accounts.
 *
 * @param ipAddress - Client IP address
 * @param email - Email address that failed login
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * await bruteForceProtectionService.trackFailedAttempt('192.168.1.1', 'user@example.com');
 * ```
 */
export async function trackFailedAttempt(ipAddress: string, email: string): Promise<void> {
  const now = Date.now();

  // Track both IP and email
  const identifiers = [
    { id: ipAddress, type: 'ip' as const },
    { id: email.toLowerCase().trim(), type: 'email' as const }
  ];

  for (const { id, type } of identifiers) {
    const key = getStorageKey(id, type);

    try {
      // Try Redis first if available
      if (redisAvailable && redisClient) {
        try {
          const existingData = await redisClient.get(key);
          let attempts = 1;
          let firstAttemptAt = now;

          if (existingData) {
            const parsed = JSON.parse(existingData) as FailedAttempt;
            attempts = parsed.attempts + 1;
            firstAttemptAt = parsed.firstAttemptAt;
          }

          const lockoutDuration = calculateLockoutDuration(attempts);
          const lockedUntil = lockoutDuration > 0 ? now + lockoutDuration : undefined;

          const entry: FailedAttempt = {
            identifier: id,
            attempts,
            firstAttemptAt,
            lastAttemptAt: now,
            lockedUntil,
            type
          };

          // Store with 7 day expiry (maximum lockout period)
          await redisClient.set(key, JSON.stringify(entry), 'PX', MAX_LOCKOUT_DURATION);

          console.warn(`Brute force protection: ${type} ${id} - Failed attempt ${attempts}${lockedUntil ? `, locked until ${new Date(lockedUntil).toISOString()}` : ''}`);

          continue;
        } catch (redisError) {
          console.warn('Brute force protection: Redis write failed, falling back to in-memory:', redisError);
          redisAvailable = false;
        }
      }

      // Fallback to in-memory storage
      const existing = inMemoryAttempts.get(key);
      let attempts = 1;
      let firstAttemptAt = now;

      if (existing) {
        // Check if we should reset due to inactivity
        if (now - existing.lastAttemptAt > RESET_WINDOW) {
          attempts = 1;
          firstAttemptAt = now;
        } else {
          attempts = existing.attempts + 1;
          firstAttemptAt = existing.firstAttemptAt;
        }
      }

      const lockoutDuration = calculateLockoutDuration(attempts);
      const lockedUntil = lockoutDuration > 0 ? now + lockoutDuration : undefined;

      const entry: FailedAttempt = {
        identifier: id,
        attempts,
        firstAttemptAt,
        lastAttemptAt: now,
        lockedUntil,
        type
      };

      inMemoryAttempts.set(key, entry);

      console.warn(`Brute force protection (in-memory): ${type} ${id} - Failed attempt ${attempts}${lockedUntil ? `, locked until ${new Date(lockedUntil).toISOString()}` : ''}`);

    } catch (error) {
      console.error(`Brute force protection: Failed to track attempt for ${type} ${id}:`, error);
    }
  }
}

/**
 * Check if an IP address or email is currently locked out
 *
 * This method checks both the IP address and email address against
 * the failure tracking system. If either is locked out, the request
 * will be rejected.
 *
 * @param ipAddress - Client IP address
 * @param email - Email address to check
 * @returns Promise<{ locked: boolean; reason?: string; retryAfter?: number }>
 *
 * @example
 * ```ts
 * const result = await bruteForceProtectionService.isLockedOut('192.168.1.1', 'user@example.com');
 * if (result.locked) {
 *   return res.status(429).json({ error: result.reason, retryAfter: result.retryAfter });
 * }
 * ```
 */
export async function isLockedOut(
  ipAddress: string,
  email?: string
): Promise<{
  locked: boolean;
  reason?: string;
  retryAfter?: number;
}> {
  const now = Date.now();

  // Check both IP and email if provided
  const identifiers: Array<{ id: string; type: 'ip' | 'email' }> = [
    { id: ipAddress, type: 'ip' }
  ];

  if (email) {
    identifiers.push({ id: email.toLowerCase().trim(), type: 'email' });
  }

  for (const { id, type } of identifiers) {
    const key = getStorageKey(id, type);

    try {
      let entry: FailedAttempt | null = null;

      // Try Redis first if available
      if (redisAvailable && redisClient) {
        try {
          const data = await redisClient.get(key);
          if (data) {
            entry = JSON.parse(data) as FailedAttempt;
          }
        } catch (redisError) {
          console.warn('Brute force protection: Redis read failed, falling back to in-memory:', redisError);
          redisAvailable = false;
          entry = null;
        }
      }

      // Fallback to in-memory storage
      if (!entry) {
        entry = inMemoryAttempts.get(key) || null;
      }

      // Check if entry exists and is locked
      if (entry && entry.lockedUntil) {
        if (now < entry.lockedUntil) {
          const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
          const minutesUntil = Math.ceil((entry.lockedUntil - now) / (60 * 1000));

          return {
            locked: true,
            reason: `Too many failed login attempts. This ${type} has been temporarily locked due to suspicious activity. Please try again in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}.`,
            retryAfter
          };
        } else {
          // Lockout has expired, reset the counter
          await resetAttempts(id, type);
        }
      }

    } catch (error) {
      console.error(`Brute force protection: Failed to check lockout for ${type} ${id}:`, error);
    }
  }

  return { locked: false };
}

/**
 * Reset failed attempt counter after successful login
 *
 * This method should be called after a successful authentication to
 * clear the failure history for both the IP address and email.
 *
 * @param ipAddress - Client IP address
 * @param email - Email address that successfully logged in
 * @returns Promise<void>
 *
 * @example
 * ```ts
 * // After successful login
 * await bruteForceProtectionService.resetAttempts('192.168.1.1', 'user@example.com');
 * ```
 */
export async function resetAttempts(ipAddress: string, email?: string): Promise<void> {
  const identifiers: Array<{ id: string; type: 'ip' | 'email' }> = [
    { id: ipAddress, type: 'ip' }
  ];

  if (email) {
    identifiers.push({ id: email.toLowerCase().trim(), type: 'email' });
  }

  for (const { id, type } of identifiers) {
    const key = getStorageKey(id, type);

    try {
      // Try Redis first
      if (redisAvailable && redisClient) {
        try {
          await redisClient.del(key);
          console.log(`Brute force protection: Reset ${type} ${id} after successful login`);
          continue;
        } catch (redisError) {
          console.warn('Brute force protection: Redis delete failed, falling back to in-memory:', redisError);
          redisAvailable = false;
        }
      }

      // Fallback to in-memory storage
      inMemoryAttempts.delete(key);
      console.log(`Brute force protection (in-memory): Reset ${type} ${id} after successful login`);

    } catch (error) {
      console.error(`Brute force protection: Failed to reset ${type} ${id}:`, error);
    }
  }
}

/**
 * Get current attempt statistics for monitoring
 *
 * @param ipAddress - Client IP address
 * @param email - Optional email address
 * @returns Promise with attempt statistics
 */
export async function getAttemptStats(
  ipAddress: string,
  email?: string
): Promise<{
  ip: { attempts: number; firstAttemptAt?: number; lastAttemptAt?: number; lockedUntil?: number };
  email?: { attempts: number; firstAttemptAt?: number; lastAttemptAt?: number; lockedUntil?: number };
}> {
  const stats: any = { ip: null };

  const getEntry = async (id: string, type: 'ip' | 'email') => {
    const key = getStorageKey(id, type);

    try {
      if (redisAvailable && redisClient) {
        const data = await redisClient.get(key);
        if (data) {
          return JSON.parse(data) as FailedAttempt;
        }
      }

      return inMemoryAttempts.get(key) || null;
    } catch {
      return inMemoryAttempts.get(key) || null;
    }
  };

  const ipEntry = await getEntry(ipAddress, 'ip');
  stats.ip = ipEntry ? {
    attempts: ipEntry.attempts,
    firstAttemptAt: ipEntry.firstAttemptAt,
    lastAttemptAt: ipEntry.lastAttemptAt,
    lockedUntil: ipEntry.lockedUntil
  } : { attempts: 0 };

  if (email) {
    const emailEntry = await getEntry(email.toLowerCase().trim(), 'email');
    stats.email = emailEntry ? {
      attempts: emailEntry.attempts,
      firstAttemptAt: emailEntry.firstAttemptAt,
      lastAttemptAt: emailEntry.lastAttemptAt,
      lockedUntil: emailEntry.lockedUntil
    } : { attempts: 0 };
  }

  return stats;
}

/**
 * Cleanup expired entries from in-memory storage
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of inMemoryAttempts.entries()) {
    // Remove entries that are past their lockout time + 1 day
    if (entry.lockedUntil && now > entry.lockedUntil + RESET_WINDOW) {
      inMemoryAttempts.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Brute force protection: Cleaned up ${cleaned} expired entries from in-memory storage`);
  }
}

/**
 * Start the cleanup interval for in-memory storage
 */
function startCleanupInterval(): void {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
}

/**
 * Shutdown the brute force protection service
 */
export async function shutdown(): Promise<void> {
  if (redisClient && typeof redisClient.quit === 'function') {
    try {
      await redisClient.quit();
      console.log('Brute force protection: Redis connection closed');
    } catch (error) {
      console.error('Brute force protection: Error closing Redis connection:', error);
    }
  }

  inMemoryAttempts.clear();
}

// Initialize Redis connection on module load
initializeRedis().catch(() => {
  console.log('Brute force protection: Initialized with in-memory storage');
});

// Start cleanup interval
startCleanupInterval();

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('beforeExit', shutdown);
  process.on('SIGINT', () => {
    shutdown().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    shutdown().then(() => process.exit(0));
  });
}

/**
 * Export the brute force protection service
 */
export const bruteForceProtectionService = {
  trackFailedAttempt,
  isLockedOut,
  resetAttempts,
  getAttemptStats,
  shutdown
};

export default bruteForceProtectionService;
