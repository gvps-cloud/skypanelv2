/**
 * Configuration module for SkyPanelV2 API
 */

export interface RateLimitConfig {
  // Anonymous user limits
  anonymousWindowMs: number;
  anonymousMaxRequests: number;

  // Authenticated user limits  
  authenticatedWindowMs: number;
  authenticatedMaxRequests: number;

  // Admin user limits
  adminWindowMs: number;
  adminMaxRequests: number;

  // Trust proxy configuration
  trustProxy: boolean | string | number;
}

export type EmailProvider = "resend" | "smtp";

export interface Config {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DATABASE_URL: string;
  CLIENT_URL: string;
  // Legacy rate limiting (deprecated)
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  // Enhanced rate limiting configuration
  rateLimiting: RateLimitConfig;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_MODE: string;
  RESEND_API_KEY?: string;
  EMAIL_PROVIDER_PRIORITY: EmailProvider[];
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE: boolean;
  SMTP_REQUIRE_TLS: boolean;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  LINODE_API_TOKEN?: string;
  SSH_CRED_SECRET?: string;
  PROVIDER_TOKEN_SECRET?: string;
  CONTACT_FORM_RECIPIENT?: string;
  COMPANY_BRAND_NAME: string;
  RDNS_BASE_DOMAIN: string;
  corsOrigins: string[];
}

/**
 * Parse trust proxy configuration from environment variable
 */
function parseTrustProxy(value?: string): boolean | string | number {
  if (!value) return true; // Default to true for development

  // Handle boolean values
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Handle numeric values (number of hops)
  const numValue = parseInt(value, 10);
  if (!isNaN(numValue)) return numValue;

  // Handle string values (subnet, loopback, etc.)
  return value;
}

/**
 * Validate and parse rate limiting configuration
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseEmailProviderPriority(value?: string): EmailProvider[] {
  const defaultOrder: EmailProvider[] = ["resend", "smtp"];
  if (!value) {
    return defaultOrder;
  }

  const allowed = new Set<EmailProvider>(["resend", "smtp"]);
  const parsed = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is EmailProvider => allowed.has(entry as EmailProvider));

  const deduped: EmailProvider[] = [];
  for (const provider of parsed) {
    if (!deduped.includes(provider)) {
      deduped.push(provider);
    }
  }

  return deduped.length > 0 ? deduped : defaultOrder;
}

function parseRateLimitConfig(): RateLimitConfig {
  const config: RateLimitConfig = {
    // Anonymous user limits (default: 1000 requests per 15 minutes)
    anonymousWindowMs: parseInt(process.env.RATE_LIMIT_ANONYMOUS_WINDOW_MS || '900000', 10),
    anonymousMaxRequests: parseInt(process.env.RATE_LIMIT_ANONYMOUS_MAX || '1000', 10),

    // Authenticated user limits (default: 5000 requests per 15 minutes)
    authenticatedWindowMs: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW_MS || '900000', 10),
    authenticatedMaxRequests: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_MAX || '5000', 10),

    // Admin user limits (default: 10000 requests per 15 minutes)
    adminWindowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || '900000', 10),
    adminMaxRequests: parseInt(process.env.RATE_LIMIT_ADMIN_MAX || '10000', 10),

    // Trust proxy configuration
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  };

  // Validate rate limiting configuration
  const validationErrors: string[] = [];

  if (config.anonymousWindowMs < 60000) { // Minimum 1 minute
    validationErrors.push('RATE_LIMIT_ANONYMOUS_WINDOW_MS must be at least 60000 (1 minute)');
  }

  if (config.authenticatedWindowMs < 60000) {
    validationErrors.push('RATE_LIMIT_AUTHENTICATED_WINDOW_MS must be at least 60000 (1 minute)');
  }

  if (config.adminWindowMs < 60000) {
    validationErrors.push('RATE_LIMIT_ADMIN_WINDOW_MS must be at least 60000 (1 minute)');
  }

  if (config.anonymousMaxRequests < 1) {
    validationErrors.push('RATE_LIMIT_ANONYMOUS_MAX must be at least 1');
  }

  if (config.authenticatedMaxRequests < 1) {
    validationErrors.push('RATE_LIMIT_AUTHENTICATED_MAX must be at least 1');
  }

  if (config.adminMaxRequests < 1) {
    validationErrors.push('RATE_LIMIT_ADMIN_MAX must be at least 1');
  }

  // Log validation errors but use defaults
  if (validationErrors.length > 0) {
    console.warn('Rate limiting configuration validation warnings:');
    validationErrors.forEach(error => console.warn(`  - ${error}`));
    console.warn('Using default values for invalid configurations.');

    // Reset to defaults if invalid
    if (config.anonymousWindowMs < 60000) config.anonymousWindowMs = 900000;
    if (config.authenticatedWindowMs < 60000) config.authenticatedWindowMs = 900000;
    if (config.adminWindowMs < 60000) config.adminWindowMs = 900000;
    if (config.anonymousMaxRequests < 1) config.anonymousMaxRequests = 1000;
    if (config.authenticatedMaxRequests < 1) config.authenticatedMaxRequests = 5000;
    if (config.adminMaxRequests < 1) config.adminMaxRequests = 10000;
  }

  return config;
}

// Use getter functions to read env vars at runtime, not at import time
function getConfig(): Config {
  const rateLimitingConfig = parseRateLimitConfig();

  const smtpPort = process.env.SMTP_PORT
    ? parseInt(process.env.SMTP_PORT, 10)
    : undefined;
  const smtpSecure = parseBoolean(process.env.SMTP_SECURE, false);
  const smtpRequireTls = parseBoolean(process.env.SMTP_REQUIRE_TLS, true);
  const emailProviderPriority = parseEmailProviderPriority(
    process.env.EMAIL_PROVIDER_PRIORITY,
  );

  const config = {
    PORT: parseInt(process.env.PORT || '3001', 10),

    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    DATABASE_URL: process.env.DATABASE_URL || '',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    // Legacy rate limiting (deprecated, kept for backward compatibility)
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    // Enhanced rate limiting configuration
    rateLimiting: rateLimitingConfig,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
    PAYPAL_MODE: process.env.PAYPAL_MODE || 'sandbox',
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_PROVIDER_PRIORITY: emailProviderPriority,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: smtpSecure,
    SMTP_REQUIRE_TLS: smtpRequireTls,
    SMTP_USERNAME: process.env.SMTP_USERNAME,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    FROM_EMAIL: process.env.FROM_EMAIL,
    FROM_NAME: process.env.FROM_NAME,

    LINODE_API_TOKEN: process.env.LINODE_API_TOKEN,
    SSH_CRED_SECRET: process.env.SSH_CRED_SECRET,
    PROVIDER_TOKEN_SECRET: process.env.PROVIDER_TOKEN_SECRET,
    CONTACT_FORM_RECIPIENT: process.env.CONTACT_FORM_RECIPIENT,
    COMPANY_BRAND_NAME:
      process.env.VITE_COMPANY_NAME?.trim() ||
      process.env.COMPANY_NAME?.trim() ||
      process.env.COMPANY_BRAND_NAME?.trim() ||
      'SkyPanelV2',
    RDNS_BASE_DOMAIN:
      process.env.RDNS_BASE_DOMAIN?.trim() || 'ip.rev.example.com',
    corsOrigins: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(url => url.trim()),
  };

  // Debug logging
  console.log('Config loaded:', {

    hasPayPalClientId: !!config.PAYPAL_CLIENT_ID,
    hasPayPalClientSecret: !!config.PAYPAL_CLIENT_SECRET,
    paypalMode: config.PAYPAL_MODE,
    hasSmtpCredentials: !!config.SMTP_USERNAME && !!config.SMTP_PASSWORD,
    hasResendKey: !!config.RESEND_API_KEY,
    hasFromEmail: !!config.FROM_EMAIL,
    emailProviderPriority: config.EMAIL_PROVIDER_PRIORITY,
    smtp: {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      requireTLS: config.SMTP_REQUIRE_TLS
    },
    rateLimiting: {
      anonymous: `${config.rateLimiting.anonymousMaxRequests}/${config.rateLimiting.anonymousWindowMs}ms`,

      authenticated: `${config.rateLimiting.authenticatedMaxRequests}/${config.rateLimiting.authenticatedWindowMs}ms`,
      admin: `${config.rateLimiting.adminMaxRequests}/${config.rateLimiting.adminWindowMs}ms`,
      trustProxy: config.rateLimiting.trustProxy
    },
    companyBrandName: config.COMPANY_BRAND_NAME
  });

  return config;
}

// Export a proxy that reads config values dynamically
export const config = new Proxy({} as Config, {
  get(target, prop: keyof Config) {
    return getConfig()[prop];
  }
});

/**
 * Validate rate limiting configuration values
 */
export function validateRateLimitConfig(rateLimitConfig: RateLimitConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate window times (minimum 1 minute, maximum 24 hours)
  const minWindow = 60000; // 1 minute
  const maxWindow = 86400000; // 24 hours

  if (rateLimitConfig.anonymousWindowMs < minWindow || rateLimitConfig.anonymousWindowMs > maxWindow) {
    errors.push(`Anonymous window must be between ${minWindow} and ${maxWindow} ms`);
  }

  if (rateLimitConfig.authenticatedWindowMs < minWindow || rateLimitConfig.authenticatedWindowMs > maxWindow) {
    errors.push(`Authenticated window must be between ${minWindow} and ${maxWindow} ms`);
  }

  if (rateLimitConfig.adminWindowMs < minWindow || rateLimitConfig.adminWindowMs > maxWindow) {
    errors.push(`Admin window must be between ${minWindow} and ${maxWindow} ms`);
  }

  // Validate request limits (minimum 1, maximum 10000)
  const minRequests = 1;
  const maxRequests = 10000;

  if (rateLimitConfig.anonymousMaxRequests < minRequests || rateLimitConfig.anonymousMaxRequests > maxRequests) {
    errors.push(`Anonymous max requests must be between ${minRequests} and ${maxRequests}`);
  }

  if (rateLimitConfig.authenticatedMaxRequests < minRequests || rateLimitConfig.authenticatedMaxRequests > maxRequests) {
    errors.push(`Authenticated max requests must be between ${minRequests} and ${maxRequests}`);
  }

  if (rateLimitConfig.adminMaxRequests < minRequests || rateLimitConfig.adminMaxRequests > maxRequests) {
    errors.push(`Admin max requests must be between ${minRequests} and ${maxRequests}`);
  }

  // Validate logical hierarchy (admin >= authenticated >= anonymous)
  if (rateLimitConfig.authenticatedMaxRequests < rateLimitConfig.anonymousMaxRequests) {
    errors.push('Authenticated user limits should be higher than or equal to anonymous user limits');
  }

  if (rateLimitConfig.adminMaxRequests < rateLimitConfig.authenticatedMaxRequests) {
    errors.push('Admin user limits should be higher than or equal to authenticated user limits');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate secret key length
 *
 * @param secretName - Name of the secret for error messages
 * @param secret - The secret value to validate
 * @param minLength - Minimum required length (default: 32)
 * @returns Object with isValid flag and error message if invalid
 */
function validateSecretLength(secretName: string, secret: string | undefined, minLength: number = 32): { isValid: boolean; error?: string } {
  if (!secret) {
    return {
      isValid: false,
      error: `${secretName} is not set`,
    };
  }

  if (secret.length < minLength) {
    return {
      isValid: false,
      error: `${secretName} must be at least ${minLength} characters (current: ${secret.length})`,
    };
  }

  // Check for obvious placeholder values
  const placeholders = [
    'your-super-secret-jwt-key',
    'your-32-character-encryption-key',
    'change-in-production',
    'your-linode-api-token',
    'your-paypal-client-id',
    'your-paypal-client-secret',
  ];

  for (const placeholder of placeholders) {
    if (secret.toLowerCase().includes(placeholder)) {
      return {
        isValid: false,
        error: `${secretName} appears to be a placeholder value. Set a strong, unique secret.`,
      };
    }
  }

  return { isValid: true };
}

export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // ========== CRITICAL SECRETS (Required in Production) ==========
  const productionSecrets = [
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL, minLength: 10 },
    { name: 'JWT_SECRET', value: process.env.JWT_SECRET, minLength: 32 },
    { name: 'SSH_CRED_SECRET', value: process.env.SSH_CRED_SECRET, minLength: 32 },
    { name: 'LINODE_API_TOKEN', value: process.env.LINODE_API_TOKEN, minLength: 40 },
    { name: 'PAYPAL_CLIENT_SECRET', value: process.env.PAYPAL_CLIENT_SECRET, minLength: 20 },
  ];

  for (const secret of productionSecrets) {
    if (isProduction) {
      const validation = validateSecretLength(secret.name, secret.value, secret.minLength);
      if (!validation.isValid) {
        errors.push(validation.error!);
      }
    } else {
      // In development, just warn if missing
      if (!secret.value) {
        warnings.push(`${secret.name} is not set (recommended for development)`);
      }
    }
  }

  // Validate NODE_ENV consistency
  if (isProduction && process.env.NODE_ENV !== 'production') {
    errors.push('NODE_ENV is set to production but configuration validation failed');
  }

  if (isDevelopment && process.env.NODE_ENV === 'production') {
    errors.push('NODE_ENV=production but environment appears to be development. Check your configuration.');
  }

  // Validate PAYPAL_CLIENT_ID in production
  if (isProduction) {
    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    if (!paypalClientId || paypalClientId.length < 10) {
      errors.push('PAYPAL_CLIENT_ID must be set and valid in production');
    }
  }

  // Validate PROVIDER_TOKEN_SECRET if set (should be at least 32 chars)
  const providerTokenSecret = process.env.PROVIDER_TOKEN_SECRET;
  if (providerTokenSecret && providerTokenSecret.length < 32) {
    warnings.push('PROVIDER_TOKEN_SECRET should be at least 32 characters for security');
  }

  // Check for legacy JWT secret placeholder in production
  if (isProduction && config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    errors.push('JWT_SECRET must be changed from the default placeholder value in production');
  }

  // ========== RATE LIMITING VALIDATION ==========
  const rateLimitValidation = validateRateLimitConfig(config.rateLimiting);
  if (!rateLimitValidation.isValid) {
    warnings.push('Rate limiting configuration issues detected:');
    rateLimitValidation.errors.forEach(error => warnings.push(`  - ${error}`));
  }

  // ========== REPORT VALIDATION RESULTS ==========
  if (errors.length > 0) {
    console.error('========================================');
    console.error('CONFIGURATION VALIDATION FAILED');
    console.error('========================================');
    errors.forEach(error => console.error(`✗ ${error}`));
    console.error('========================================');
    console.error('Please fix these errors before starting the server.');
    console.error('Check your .env file and environment variables.');
    console.error('========================================');

    // In production, exit on critical errors
    if (isProduction) {
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    console.warn('========================================');
    console.warn('Configuration Warnings');
    console.warn('========================================');
    warnings.forEach(warning => console.warn(`⚠ ${warning}`));
    console.warn('========================================');
    console.warn('These warnings should be addressed for optimal security and functionality.');
    console.warn('========================================');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ Configuration validated successfully');
  }
}