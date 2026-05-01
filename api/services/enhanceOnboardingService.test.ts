import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const mockCreateCustomer = vi.hoisted(() => vi.fn());
const mockGetOrgLogins = vi.hoisted(() => vi.fn());
const mockCreateLogin = vi.hoisted(() => vi.fn());
const mockGetOrgMembers = vi.hoisted(() => vi.fn());
const mockCreateOrgMember = vi.hoisted(() => vi.fn());
const mockUpdateOrgOwner = vi.hoisted(() => vi.fn());
const mockOrgExists = vi.hoisted(() => vi.fn());

vi.mock('../lib/database.js', () => ({
  query: mockQuery,
}));

vi.mock('../config/index.js', () => ({
  config: {
    ENHANCE_MASTER_ORG_ID: 'master-org-123',
  },
}));

vi.mock('./enhanceService.js', () => ({
  EnhanceApiError: class EnhanceApiError extends Error {
    statusCode?: number;
    responseBody?: any;

    constructor(message: string, statusCode?: number, responseBody?: any) {
      super(message);
      this.name = 'EnhanceApiError';
      this.statusCode = statusCode;
      this.responseBody = responseBody;
    }
  },
  EnhanceService: {
    createCustomer: mockCreateCustomer,
    getLogins: vi.fn(),
    getOrgLogins: mockGetOrgLogins,
    createLogin: mockCreateLogin,
    getOrgMembers: mockGetOrgMembers,
    createOrgMember: mockCreateOrgMember,
    updateOrgOwner: mockUpdateOrgOwner,
    orgExists: mockOrgExists,
  },
}));

import { EnhanceOnboardingService } from './enhanceOnboardingService.js';
import { EnhanceApiError, EnhanceService } from './enhanceService.js';

describe('EnhanceOnboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the missing customer, login, member, and owner assignment for first purchase', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            organization_id: 'org-1',
            organization_name: 'SkyPanel Org',
            enhance_customer_id: null,
            purchaser_user_id: 'user-1',
            purchaser_email: 'buyer@example.com',
            purchaser_name: 'Jane Doe',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    mockCreateCustomer.mockResolvedValue({ id: 'customer-1' });
    mockGetOrgLogins.mockResolvedValue({ items: [] });
    mockCreateLogin.mockResolvedValue({ id: 'login-1' });
    mockGetOrgMembers.mockResolvedValue({ items: [] });
    mockCreateOrgMember.mockResolvedValue({ id: 'member-1' });
    mockUpdateOrgOwner.mockResolvedValue(undefined);

    const result = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
      organizationId: 'org-1',
      purchaserUserId: 'user-1',
    });

    expect(mockCreateCustomer).toHaveBeenCalledWith('master-org-123', {
      name: 'SkyPanel Org',
    });
    expect(mockCreateLogin).toHaveBeenCalledWith(
      'customer-1',
      expect.objectContaining({
        email: 'buyer@example.com',
        name: 'Jane',
        password: expect.stringMatching(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/),
      })
    );
    expect(mockCreateOrgMember).toHaveBeenCalledWith('customer-1', {
      loginId: 'login-1',
      roles: ['SuperAdmin'],
    });
    expect(mockUpdateOrgOwner).toHaveBeenCalledWith('customer-1', {
      memberId: 'member-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        enhanceCustomerId: 'customer-1',
        purchaserLoginId: 'login-1',
        purchaserMemberId: 'member-1',
        credentialsCreated: true,
        ownerAssigned: true,
        credentialsEmail: expect.objectContaining({
          recipient: 'buyer@example.com',
          firstName: 'Jane',
          organizationName: 'SkyPanel Org',
          password: expect.stringMatching(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/),
        }),
      })
    );
  });

  it('reuses existing customer access when the purchaser already has a remote owner membership', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          organization_id: 'org-1',
          organization_name: 'SkyPanel Org',
          enhance_customer_id: 'customer-1',
          purchaser_user_id: 'user-1',
          purchaser_email: 'buyer@example.com',
          purchaser_name: 'Jane Doe',
        },
      ],
    });

    mockOrgExists.mockResolvedValue(true);
    mockGetOrgLogins.mockResolvedValue({
      items: [{ id: 'login-1', email: 'buyer@example.com', name: 'Jane' }],
    });
    mockGetOrgMembers.mockResolvedValue({
      items: [
        {
          id: 'member-1',
          loginId: 'login-1',
          email: 'buyer@example.com',
          name: 'Jane',
          roles: ['Owner'],
        },
      ],
    });

    const result = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
      organizationId: 'org-1',
      purchaserUserId: 'user-1',
    });

    expect(mockCreateCustomer).not.toHaveBeenCalled();
    expect(mockCreateLogin).not.toHaveBeenCalled();
    expect(mockCreateOrgMember).not.toHaveBeenCalled();
    expect(mockUpdateOrgOwner).not.toHaveBeenCalled();
    expect(result).toEqual({
      enhanceCustomerId: 'customer-1',
      purchaserLoginId: 'login-1',
      purchaserMemberId: 'member-1',
      credentialsCreated: false,
      credentialsEmail: null,
      ownerAssigned: false,
    });
  });

  it('reuses an existing realm login when Enhance reports a login conflict', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          organization_id: 'org-1',
          organization_name: 'SkyPanel Org',
          enhance_customer_id: 'customer-1',
          purchaser_user_id: 'user-1',
          purchaser_email: 'buyer@example.com',
          purchaser_name: 'Jane Doe',
        },
      ],
    });

    mockOrgExists.mockResolvedValue(true);
    mockGetOrgLogins.mockResolvedValue({ items: [] });
    mockCreateLogin.mockRejectedValue(
      new EnhanceApiError('Enhance API error: 409 Conflict', 409, {
        detail: 'login',
      })
    );
    vi.mocked(EnhanceService.getLogins).mockResolvedValue({
      items: [{ id: 'login-2', email: 'buyer@example.com', name: 'Jane' }],
      total: 1,
    });
    mockGetOrgMembers.mockResolvedValue({ items: [] });
    mockCreateOrgMember.mockResolvedValue({ id: 'member-2' });
    mockUpdateOrgOwner.mockResolvedValue(undefined);

    const result = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
      organizationId: 'org-1',
      purchaserUserId: 'user-1',
    });

    expect(EnhanceService.getLogins).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    expect(mockCreateOrgMember).toHaveBeenCalledWith('customer-1', {
      loginId: 'login-2',
      roles: ['SuperAdmin'],
    });
    expect(result).toEqual(
      expect.objectContaining({
        purchaserLoginId: 'login-2',
        purchaserMemberId: 'member-2',
        credentialsCreated: false,
        credentialsEmail: null,
      })
    );
  });

  it('clears stale customer ID and re-creates when the Enhance org no longer exists', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            organization_id: 'org-1',
            organization_name: 'SkyPanel Org',
            enhance_customer_id: 'stale-customer-id',
            purchaser_user_id: 'user-1',
            purchaser_email: 'buyer@example.com',
            purchaser_name: 'Jane Doe',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockOrgExists.mockResolvedValue(false);
    mockCreateCustomer.mockResolvedValue({ id: 'new-customer-1' });
    mockGetOrgLogins.mockResolvedValue({ items: [] });
    mockCreateLogin.mockResolvedValue({ id: 'login-1' });
    mockGetOrgMembers.mockResolvedValue({ items: [] });
    mockCreateOrgMember.mockResolvedValue({ id: 'member-1' });
    mockUpdateOrgOwner.mockResolvedValue(undefined);

    const result = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
      organizationId: 'org-1',
      purchaserUserId: 'user-1',
    });

    expect(mockOrgExists).toHaveBeenCalledWith('stale-customer-id');
    expect(mockQuery).toHaveBeenNthCalledWith(2,
      expect.stringContaining('SET enhance_customer_id = NULL'),
      ['org-1'],
    );
    expect(mockCreateCustomer).toHaveBeenCalledWith('master-org-123', {
      name: 'SkyPanel Org',
    });
    expect(result).toEqual(
      expect.objectContaining({
        enhanceCustomerId: 'new-customer-1',
        credentialsCreated: true,
      }),
    );
  });

  it('does not fail purchase onboarding when owner assignment is forbidden', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          organization_id: 'org-1',
          organization_name: 'SkyPanel Org',
          enhance_customer_id: 'customer-1',
          purchaser_user_id: 'user-1',
          purchaser_email: 'buyer@example.com',
          purchaser_name: 'Jane Doe',
        },
      ],
    });

    mockOrgExists.mockResolvedValue(true);
    mockGetOrgLogins.mockResolvedValue({
      items: [{ id: 'login-1', email: 'buyer@example.com', name: 'Jane' }],
    });
    mockGetOrgMembers.mockResolvedValue({
      items: [
        {
          id: 'member-1',
          loginId: 'login-1',
          email: 'buyer@example.com',
          name: 'Jane',
          roles: ['SuperAdmin'],
        },
      ],
    });
    mockUpdateOrgOwner.mockRejectedValue(
      new EnhanceApiError('Enhance API error: 403 Forbidden', 403, {
        code: 'unauthorized',
      })
    );

    const result = await EnhanceOnboardingService.ensureEnhanceCustomerForPurchase({
      organizationId: 'org-1',
      purchaserUserId: 'user-1',
    });

    expect(result).toEqual({
      enhanceCustomerId: 'customer-1',
      purchaserLoginId: 'login-1',
      purchaserMemberId: 'member-1',
      credentialsCreated: false,
      credentialsEmail: null,
      ownerAssigned: false,
    });
  });
});