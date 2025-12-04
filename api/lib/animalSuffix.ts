/**
 * Animal Suffix Generator
 * Generates unique organization name suffixes using adjective-animal combinations
 * Used to ensure organization name uniqueness during registration
 */

import { query } from './database.js';

// ~50 adjectives for variety
const adjectives = [
  'swift', 'brave', 'clever', 'calm', 'happy',
  'bright', 'bold', 'cool', 'eager', 'fancy',
  'gentle', 'grand', 'keen', 'kind', 'lively',
  'merry', 'noble', 'proud', 'quick', 'royal',
  'sharp', 'silent', 'smart', 'steady', 'strong',
  'sunny', 'super', 'sure', 'sweet', 'tall',
  'true', 'vivid', 'warm', 'wise', 'witty',
  'agile', 'alert', 'ample', 'azure', 'cosmic',
  'crisp', 'daring', 'epic', 'fair', 'fleet',
  'golden', 'jade', 'lunar', 'prime', 'stellar'
];

// ~50 animals for variety
const animals = [
  'falcon', 'tiger', 'wolf', 'eagle', 'hawk',
  'lion', 'bear', 'fox', 'owl', 'panther',
  'dolphin', 'shark', 'whale', 'otter', 'seal',
  'raven', 'crane', 'heron', 'swan', 'phoenix',
  'dragon', 'griffin', 'cobra', 'viper', 'python',
  'jaguar', 'leopard', 'cheetah', 'puma', 'lynx',
  'badger', 'beaver', 'ferret', 'marten', 'stoat',
  'condor', 'osprey', 'kestrel', 'merlin', 'peregrine',
  'bison', 'elk', 'moose', 'stag', 'stallion',
  'mantis', 'hornet', 'wasp', 'beetle', 'monarch'
];

/**
 * Generate a random adjective-animal suffix
 * @returns A hyphenated suffix like "swift-falcon"
 */
export function generateAnimalSuffix(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective}-${animal}`;
}

/**
 * Check if an organization name already exists (case-insensitive)
 * @param name - The organization name to check
 * @param excludeOrgId - Optional organization ID to exclude from the check (for updates)
 * @returns true if name exists, false otherwise
 */
async function isOrgNameTaken(name: string, excludeOrgId?: string): Promise<boolean> {
  if (excludeOrgId) {
    const result = await query(
      'SELECT id FROM organizations WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name, excludeOrgId]
    );
    return result.rows.length > 0;
  }
  
  const result = await query(
    'SELECT id FROM organizations WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  return result.rows.length > 0;
}

/**
 * Generate a unique organization name, appending a suffix if needed
 * @param baseName - The original organization name requested
 * @param maxRetries - Maximum number of suffix attempts (default 5)
 * @param excludeOrgId - Optional organization ID to exclude from collision check (for updates)
 * @returns An object with the final unique name and whether a suffix was added
 * @throws Error if unable to generate a unique name after maxRetries
 */
export async function generateUniqueOrgName(
  baseName: string,
  maxRetries = 5,
  excludeOrgId?: string
): Promise<{ finalName: string; suffixAdded: boolean }> {
  // First, check if the original name is available
  const isTaken = await isOrgNameTaken(baseName, excludeOrgId);
  
  if (!isTaken) {
    return { finalName: baseName, suffixAdded: false };
  }

  // Name is taken, try adding suffixes
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const suffix = generateAnimalSuffix();
    const candidateName = `${baseName}-${suffix}`;
    
    const candidateTaken = await isOrgNameTaken(candidateName, excludeOrgId);
    
    if (!candidateTaken) {
      return { finalName: candidateName, suffixAdded: true };
    }
  }

  // All retries exhausted - extremely unlikely scenario
  throw new Error(
    `Unable to generate a unique organization name after ${maxRetries} attempts. ` +
    `Please try a different organization name.`
  );
}
