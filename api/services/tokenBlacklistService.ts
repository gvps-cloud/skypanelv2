/**
 * Token Blacklist Service
 *
 * Provides JWT token revocation/blacklisting functionality with Redis persistence
 * and automatic fallback to in-memory storage if Redis is unavailable.
 *
 * This service supports proper logout functionality by preventing blacklisted
 * tokens from being used for authentication, even if they haven't expired yet.
 *
 * @security Tokens are blacklisted using their JWT ID (jti) claim to prevent
 * token reuse after logout. Entries auto-expire based on the token's TTL.
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Token blacklist entry structure
 */
interface BlacklistEntry {
  jti: string;
  expiresAt: number; // Unix timestamp
  blacklistedAt: number; // Unix timestamp
  userId?: string;
}

/**
 * In-memory fallback storage for when Redis is unavailable
 * This ensures the service remains functional even if Redis is down
 */
const inMemoryBlacklist = new Map<string, BlacklistEntry>();

/**
 * Cleanup interval for in-memory storage (every 5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Redis client interface (lazy-loaded to avoid dependency issues)
 */
let redisClient: Redis | null = null;
let redisAvailable = false;

/**
 * Attempts to initialize and connect a Redis client for blacklist storage.
 *
 * If a Redis URL is not configured or the connection cannot be established, leaves the service using
 * in-memory fallback and updates the module's Redis availability flag and client reference accordingly.
 */
async function initializeRedis(): Promise<void> {
  // Check if Redis is configured
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  if (!redisUrl) {
    console.log('Token blacklist: Redis not configured, using in-memory storage');
    redisAvailable = false;
    return;
  }

  try {
    const redisOptions: any = {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn('Token blacklist: Redis reconnection failed, using in-memory storage');
          redisAvailable = false;
          return null;
        }
        return Math.min(times * 100, 3000);
      }
    };

    // Use REDIS_URL (already validated above)
    redisClient = new Redis(redisUrl, redisOptions);

    redisClient.on('error', (err) => {
      console.error('Token blacklist Redis error:', err);
      redisAvailable = false;
    });

    redisClient.on('ready', () => {
      console.log('Token blacklist: Redis connection established');
      redisAvailable = true;
    });

    await redisClient.connect();
    redisAvailable = true;
  } catch (error) {
    console.warn('Token blacklist: Failed to connect to Redis, using in-memory storage:', error);
    redisAvailable = false;
    redisClient = null;
  }
}

/**
 * Extract JWT ID (jti) from token payload
 * If token doesn't have a jti claim, generates one from the token string
 *
 * @param payload - Decoded JWT payload
 * @param token - Raw JWT token (for fallback jti generation)
 * @returns JWT ID string
 */
function extractJti(payload: any, token: string): string {
  // Use jti claim if present
  if (payload.jti) {
    return payload.jti;
  }

  // Generate jti from token hash for backwards compatibility
  // This ensures we can blacklist tokens that don't have a jti claim
  return Buffer.from(token).toString('base64').substring(0, 32);
}

/**
 * Calculate token expiration time from payload
 *
 * @param payload - Decoded JWT payload
 * @returns Unix timestamp of token expiration
 */
function getTokenExpiration(payload: any): number {
  if (payload.exp) {
    return payload.exp * 1000; // Convert to milliseconds
  }

  // Default to 7 days if no exp claim (matches JWT_EXPIRES_IN default)
  return Date.now() + (7 * 24 * 60 * 60 * 1000);
}

/**
 * Add a token to the blacklist
 *
 * This method prevents the token from being used for authentication,
 * even if it hasn't expired yet. The entry automatically expires
 * when the token would have naturally expired.
 *
 * @param token - JWT token to blacklist
 * @param userId - Optional user ID for logging/audit purposes
 * @returns Promise that resolves when token is blacklisted
 *
 * @example
 * ```ts
 * await tokenBlacklistService.add(token, user.id);
 * ```
 */
export async function add(token: string, userId?: string): Promise<void> {
  try {
    // Decode token without verification (we just need the payload)
    const payload = decodeJWT(token);
    if (!payload) {
      throw new Error('Invalid token format');
    }

    const jti = extractJti(payload, token);
    const expiresAt = getTokenExpiration(payload);
    const blacklistedAt = Date.now();

    const entry: BlacklistEntry = {
      jti,
      expiresAt,
      blacklistedAt,
      userId
    };

    const ttl = Math.max(0, expiresAt - Date.now());
    const ttlSeconds = Math.ceil(ttl / 1000);

    // Try Redis first if available
    if (redisAvailable && redisClient) {
      try {
        const key = `blacklist:${jti}`;
        await redisClient.set(key, JSON.stringify(entry), 'PX', ttl);
        console.log(`Token blacklisted (Redis): jti=${jti}, userId=${userId || 'unknown'}, ttl=${ttlSeconds}s`);
        return;
      } catch (redisError) {
        console.warn('Token blacklist: Redis write failed, falling back to in-memory:', redisError);
        redisAvailable = false;
      }
    }

    // Fallback to in-memory storage
    inMemoryBlacklist.set(jti, entry);
    console.log(`Token blacklisted (in-memory): jti=${jti}, userId=${userId || 'unknown'}, ttl=${ttlSeconds}s`);

    // Schedule cleanup for this specific entry
    setTimeout(() => {
      inMemoryBlacklist.delete(jti);
    }, ttl);

  } catch (error) {
    console.error('Token blacklist: Failed to add token:', error);
    throw error;
  }
}

/**
 * Check if a token has been blacklisted
 *
 * This method verifies whether a token has been revoked and should
 * not be accepted for authentication.
 *
 * @param token - JWT token to check
 * @returns Promise<boolean> - True if token is blacklisted, false otherwise
 *
 * @example
 * ```ts
 * if (await tokenBlacklistService.isRevoked(token)) {
 *   return res.status(401).json({ error: 'Token has been revoked' });
 * }
 * ```
 */
export async function isRevoked(token: string): Promise<boolean> {
  try {
    // Decode token without verification
    const payload = decodeJWT(token);
    if (!payload) {
      return false; // Invalid format, let JWT verification handle it
    }

    const jti = extractJti(payload, token);

    // Check Redis first if available
    if (redisAvailable && redisClient) {
      try {
        const key = `blacklist:${jti}`;
        const entry = await redisClient.get(key);
        if (entry) {
          const parsed = JSON.parse(entry) as BlacklistEntry;
          // Verify entry hasn't expired
          if (Date.now() < parsed.expiresAt) {
            return true;
          }
        }
        return false;
      } catch (redisError) {
        console.warn('Token blacklist: Redis read failed, falling back to in-memory:', redisError);
        redisAvailable = false;
      }
    }

    // Fallback to in-memory storage
    const entry = inMemoryBlacklist.get(jti);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() >= entry.expiresAt) {
      inMemoryBlacklist.delete(jti);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Token blacklist: Failed to check revocation status:', error);
    // Fail open - if we can't check, allow the token through
    // JWT verification will still catch expired tokens
    return false;
  }
}

/**
 * Decode JWT token without verification (for blacklist operations)
 *
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('binary')
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Get statistics about the blacklist (for monitoring/debugging)
 *
 * @returns Promise with blacklist statistics
 */
export async function getStats(): Promise<{
  redisAvailable: boolean;
  inMemoryCount: number;
}> {
  const stats = {
    redisAvailable,
    inMemoryCount: inMemoryBlacklist.size
  };

  return stats;
}

/**
 * Cleanup expired entries from in-memory storage
 * Runs automatically on an interval
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [jti, entry] of inMemoryBlacklist.entries()) {
    if (now >= entry.expiresAt) {
      inMemoryBlacklist.delete(jti);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Token blacklist: Cleaned up ${cleaned} expired entries from in-memory storage`);
  }
}

/**
 * Start the cleanup interval for in-memory storage
 */
function startCleanupInterval(): void {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
}

/**
 * Shutdown the token blacklist service
 * Closes Redis connection if available
 */
export async function shutdown(): Promise<void> {
  if (redisClient && typeof redisClient.quit === 'function') {
    try {
      await redisClient.quit();
      console.log('Token blacklist: Redis connection closed');
    } catch (error) {
      console.error('Token blacklist: Error closing Redis connection:', error);
    }
  }

  // Clear in-memory storage
  inMemoryBlacklist.clear();
}

// Initialize Redis connection on module load
initializeRedis().catch(() => {
  // Redis initialization failed, in-memory storage will be used
  console.log('Token blacklist: Initialized with in-memory storage');
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
 * Export the token blacklist service
 */
export const tokenBlacklistService = {
  add,
  isRevoked,
  getStats,
  shutdown
};

export default tokenBlacklistService;
