/**
 * VPS Label Generation Utility
 * Generates unique labels for VPS instances in the format: ${companyName}-randomname
 */

// List of random name components for generating unique labels
const adjectives = [
  'swift', 'brave', 'calm', 'cool', 'wise', 'bold', 'keen', 'fair', 'true', 'pure',
  'bright', 'clear', 'deep', 'fleet', 'fresh', 'grand', 'happy', 'iron', 'just', 'kind',
  'light', 'lunar', 'maple', 'neat', 'noble', 'ocean', 'prime', 'quick', 'royal', 'safe',
  'sage', 'sharp', 'sleek', 'smart', 'solid', 'sonic', 'steel', 'stone', 'storm', 'super',
  'swift', 'tidal', 'titan', 'ultra', 'vivid', 'warm', 'wild', 'wind', 'zen', 'zest'
];

const nouns = [
  'falcon', 'tiger', 'eagle', 'wolf', 'bear', 'lion', 'hawk', 'fox', 'lynx', 'puma',
  'peak', 'star', 'wave', 'cloud', 'frost', 'blaze', 'spark', 'storm', 'thunder', 'moon',
  'sun', 'river', 'ocean', 'mountain', 'forest', 'delta', 'alpha', 'beta', 'gamma', 'omega',
  'nexus', 'vertex', 'apex', 'zenith', 'core', 'pulse', 'forge', 'beacon', 'cipher', 'quantum',
  'phoenix', 'atlas', 'orion', 'nova', 'vega', 'comet', 'meteor', 'nebula', 'pulsar', 'quasar'
];

/**
 * Generate a random name component
 */
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random suffix (adjective-noun combination)
 */
function generateRandomSuffix(): string {
  const adjective = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  return `${adjective}-${noun}`;
}

/**
 * Sanitize company name for use in label
 * - Convert to lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim hyphens from start/end
 */
function sanitizeCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30); // Limit length to keep labels reasonable
}

/**
 * Generate a unique VPS label
 * @param companyName - The organization/company name
 * @param existingLabels - Array of existing VPS labels to check against
 * @param maxAttempts - Maximum number of attempts to generate a unique label (default: 100)
 * @returns A unique label in the format: ${companyName}-randomname
 */
export function generateUniqueVPSLabel(
  companyName: string,
  existingLabels: string[],
  maxAttempts: number = 100
): string {
  const sanitizedCompany = sanitizeCompanyName(companyName || 'vps');
  const existingSet = new Set(existingLabels.map(label => label.toLowerCase()));
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = generateRandomSuffix();
    const label = `${sanitizedCompany}-${suffix}`;
    
    // Check if this label is unique
    if (!existingSet.has(label.toLowerCase())) {
      return label;
    }
  }
  
  // If we couldn't generate a unique label after max attempts, add a timestamp
  const timestamp = Date.now().toString().slice(-6);
  const fallbackSuffix = generateRandomSuffix();
  return `${sanitizedCompany}-${fallbackSuffix}-${timestamp}`;
}

/**
 * Validate if a label meets Linode's requirements
 * - 3-63 characters
 * - Lowercase alphanumeric and hyphens only
 * - Cannot start or end with hyphen
 */
export function isValidLinodeLabel(label: string): boolean {
  if (label.length < 3 || label.length > 63) return false;
  if (!/^[a-z0-9-]+$/.test(label)) return false;
  if (label.startsWith('-') || label.endsWith('-')) return false;
  return true;
}
