/**
 * Base Provider Service
 * 
 * Abstract base class that provides common functionality for all provider
 * implementations. Extend this class when creating a new provider integration.
 * 
 * @abstract
 * @class BaseProviderService
 * @implements {IProviderService}
 * 
 * @example
 * export class MyProviderService extends BaseProviderService {
 *   constructor(apiToken: string, providerId?: string) {
 *     super(apiToken, 'myprovider');
 *   }
 *   
 *   async createInstance(params: CreateInstanceParams): Promise<ProviderInstance> {
 *     this.validateToken();
 *     // Implementation...
 *   }
 * }
 */

import { IProviderService, ProviderType, ProviderError } from './IProviderService.js';

export abstract class BaseProviderService implements IProviderService {
  /** API token for authenticating with the provider */
  protected apiToken: string;
  
  /** Provider type identifier */
  protected providerType: ProviderType;

  /**
   * Creates a new base provider service instance
   * 
   * @param {string} apiToken - API token for provider authentication
   * @param {ProviderType} providerType - Provider type identifier
   */
  constructor(apiToken: string, providerType: ProviderType) {
    this.apiToken = apiToken;
    this.providerType = providerType;
  }

  /**
   * Get the provider type
   * 
   * @returns {ProviderType} The provider type identifier
   */
  getProviderType(): ProviderType {
    return this.providerType;
  }

  /**
   * Create a standardized error object
   * 
   * Helper method for creating consistent error objects across all providers.
   * 
   * @protected
   * @param {string} code - Standardized error code
   * @param {string} message - Human-readable error message
   * @param {string} [field] - Field name that caused the error
   * @param {any} [originalError] - Original error object for debugging
   * @returns {ProviderError} Standardized error object
   * 
   * @example
   * throw this.createError('INVALID_CREDENTIALS', 'API token is invalid');
   */
  protected createError(
    code: string,
    message: string,
    field?: string,
    originalError?: any
  ): ProviderError {
    return {
      code,
      message,
      field,
      provider: this.providerType,
      originalError,
    };
  }

  /**
   * Handle API errors and normalize them
   * 
   * Default error handler that can be overridden by provider-specific
   * implementations for custom error normalization.
   * 
   * @protected
   * @param {any} error - Error object from API call
   * @param {string} context - Context string describing where error occurred
   * @throws {ProviderError} Always throws a normalized error
   * 
   * @example
   * try {
   *   await apiCall();
   * } catch (error) {
   *   this.handleApiError(error, 'createInstance');
   * }
   */
  protected handleApiError(error: any, context: string): never {
    // Log only safe error properties to prevent token exfiltration
    const safeError = {
      code: error?.code,
      message: error?.message,
      statusCode: error?.statusCode,
      status: error?.status,
      url: error?.url,
      method: error?.method,
    };
    console.error(`[${this.providerType}] ${context}:`, safeError);

    if (error instanceof Error) {
      throw this.createError(
        'API_ERROR',
        error.message,
        undefined,
        safeError
      );
    }

    throw this.createError(
      'UNKNOWN_ERROR',
      'An unknown error occurred',
      undefined,
      safeError
    );
  }

  /**
   * Validate that API token is configured
   * 
   * Checks if the API token is present and not empty. Should be called
   * at the beginning of all API methods.
   * 
   * @protected
   * @throws {ProviderError} If token is missing or empty
   * 
   * @example
   * async createInstance(params: CreateInstanceParams) {
   *   this.validateToken();
   *   // Proceed with API call...
   * }
   */
  protected validateToken(): void {
    if (!this.apiToken || this.apiToken.trim() === '') {
      throw this.createError(
        'MISSING_CREDENTIALS',
        `${this.providerType} API token not configured`
      );
    }
  }

  /**
   * Sleep utility for retry logic
   * 
   * Helper method for implementing exponential backoff or rate limit handling.
   * 
   * @protected
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>} Promise that resolves after the specified time
   * 
   * @example
   * // Retry with exponential backoff
   * for (let i = 0; i < 3; i++) {
   *   try {
   *     return await apiCall();
   *   } catch (error) {
   *     if (i < 2) await this.sleep(1000 * Math.pow(2, i));
   *   }
   * }
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Abstract methods that must be implemented by provider-specific classes
  abstract createInstance(params: any): Promise<any>;
  abstract getInstance(instanceId: string): Promise<any>;
  abstract listInstances(): Promise<any[]>;
  abstract performAction(instanceId: string, action: string, params?: Record<string, any>): Promise<void>;
  abstract getPlans(): Promise<any[]>;
  abstract getImages(): Promise<any[]>;
  abstract getRegions(): Promise<any[]>;
  abstract validateCredentials(): Promise<boolean>;

  // ── IP Address Management ──
  abstract listIPs(page?: number, pageSize?: number): Promise<{ data: any[]; pages: number; total: number }>;
  abstract getIPAddress(address: string): Promise<any>;
  abstract allocateIP(request: any): Promise<any>;
  abstract deleteIPAddress(instanceId: string, address: string): Promise<void>;
  abstract assignIPs(request: any): Promise<void>;
  abstract shareIPs(request: any): Promise<void>;
  abstract updateIPReverseDNS(address: string, rdns: string | null): Promise<any>;

  // ── IPv6 Management ──
  abstract listIPv6Pools(): Promise<any[]>;
  abstract listIPv6Ranges(): Promise<any[]>;
  abstract createIPv6Range(request: any): Promise<any>;
  abstract deleteIPv6Range(range: string): Promise<void>;

  // ── VLAN Management ──
  abstract listVLANs(): Promise<any[]>;
  abstract deleteVLAN(regionId: string, label: string): Promise<void>;

  // ── Firewall Management ──
  abstract listFirewalls(): Promise<{ data: any[]; pages: number; total: number }>;
  abstract createFirewall(params: any): Promise<any>;
  abstract getFirewall(firewallId: number): Promise<any>;
  abstract updateFirewall(firewallId: number, updates: any): Promise<any>;
  abstract deleteFirewall(firewallId: number): Promise<void>;
  abstract getFirewallRules(firewallId: number): Promise<any>;
  abstract updateFirewallRules(firewallId: number, rules: any): Promise<any>;
  abstract getFirewallDevices(firewallId: number): Promise<any[]>;
  abstract attachFirewallDevice(firewallId: number, type: string, entityId: number): Promise<any>;
  abstract detachFirewallDevice(firewallId: number, deviceId: number): Promise<void>;
  abstract getFirewallSettings(): Promise<any>;
  abstract updateFirewallSettings(settings: any): Promise<any>;
  abstract listFirewallTemplates(): Promise<any[]>;
  abstract getFirewallTemplate(slug: string): Promise<any>;
}
