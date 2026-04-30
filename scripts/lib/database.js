import pg from 'pg';

const { Pool } = pg;

function shouldUseSsl(connectionString) {
  if (!connectionString) {
    return false;
  }

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalHost = [
      'localhost',
      '127.0.0.1',
      '::1',
      '[::1]',
    ].includes(hostname);
    const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();

    if (sslMode === 'disable') {
      return false;
    }

    if (sslMode) {
      return true;
    }

    return !isLocalHost;
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function getDatabaseSslConfig(connectionString = process.env.DATABASE_URL) {
  if (!shouldUseSsl(connectionString)) {
    return false;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

export function createScriptPool(overrides = {}) {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getDatabaseSslConfig(process.env.DATABASE_URL),
    ...overrides,
  });
}
