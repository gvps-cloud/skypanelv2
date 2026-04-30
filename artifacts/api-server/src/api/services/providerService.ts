/**
 * Provider Service
 * High-level service for managing provider operations with database integration
 */

import { query } from '../lib/database.js';
import { ProviderFactory } from './providers/ProviderFactory.js';
import { IProviderService, ProviderType } from './providers/IProviderService.js';
import { normalizeProviderToken } from '../lib/providerTokens.js';

interface ServiceProvider {
  id: string;
  name: string;
  type: ProviderType;
  api_key_encrypted: string;
  configuration: Record<string, any>;
  active: boolean;
}

/**
 * Get a provider service instance by provider ID
 */
export async function getProviderService(providerId: string): Promise<IProviderService> {
  // Fetch provider from database
  const result = await query(
    'SELECT id, name, type, api_key_encrypted, configuration, active FROM service_providers WHERE id = $1',
    [providerId]
  );

  if (result.rows.length === 0) {
    throw new Error('Provider not found');
  }

  const provider = result.rows[0] as ServiceProvider;

  if (!provider.active) {
    throw new Error('Provider is not active');
  }

  // Resolve stored API token (handles encrypted and legacy plaintext values)
  const apiToken = await normalizeProviderToken(provider.id, provider.api_key_encrypted);

  if (!apiToken) {
    throw new Error('Provider API key not configured');
  }

  // Create and return provider service instance with provider ID for caching
  return ProviderFactory.createProvider(provider.type, apiToken, provider.id);
}

/**
 * Get a provider service instance by provider type
 * Uses the first active provider of the specified type
 */
export async function getProviderServiceByType(providerType: ProviderType): Promise<IProviderService> {
  // Fetch provider from database
  const result = await query(
    'SELECT id, name, type, api_key_encrypted, configuration, active FROM service_providers WHERE type = $1 AND active = true LIMIT 1',
    [providerType]
  );

  if (result.rows.length === 0) {
    throw new Error(`No active ${providerType} provider found`);
  }

  const provider = result.rows[0] as ServiceProvider;

  // Resolve stored API token (handles encrypted and legacy plaintext values)
  const apiToken = await normalizeProviderToken(provider.id, provider.api_key_encrypted);

  if (!apiToken) {
    throw new Error('Provider API key not configured');
  }

  // Create and return provider service instance with provider ID for caching
  return ProviderFactory.createProvider(provider.type, apiToken, provider.id);
}

/**
 * Get all active providers
 */
export async function getActiveProviders(): Promise<ServiceProvider[]> {
  const result = await query(
    'SELECT id, name, type, configuration, active FROM service_providers WHERE active = true ORDER BY name'
  );

  return result.rows as ServiceProvider[];
}

/**
 * Validate provider credentials
 */
export async function validateProviderCredentials(providerId: string): Promise<boolean> {
  try {
    const providerService = await getProviderService(providerId);
    return await providerService.validateCredentials();
  } catch (error) {
    console.error('Error validating provider credentials:', error);
    return false;
  }
}

/**
 * Get provider info by ID
 */
export async function getProviderInfo(providerId: string): Promise<ServiceProvider | null> {
  const result = await query(
    'SELECT id, name, type, configuration, active FROM service_providers WHERE id = $1',
    [providerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as ServiceProvider;
}
