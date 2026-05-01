import crypto from 'crypto';

import { query } from '../lib/database.js';
import { config } from '../config/index.js';
import { EnhanceApiError, EnhanceService } from './enhanceService.js';

const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBER_CHARS = '0123456789';
const SPECIAL_CHARS = '!@#$%^&*()-_=+[]{};:,.?';
const ENHANCE_DEFAULT_MEMBER_ROLES = ['SuperAdmin'];
const ENHANCE_OWNER_ROLE = 'Owner';
const ENHANCE_PASSWORD_LENGTH = 16;

interface EnhancePurchaseContextRow {
  organization_id: string;
  organization_name: string;
  enhance_customer_id: string | null;
  purchaser_user_id: string;
  purchaser_email: string;
  purchaser_name: string | null;
}

interface EnhanceLoginRecord {
  id: string;
  email?: string;
  name?: string;
}

interface EnhanceMemberRecord {
  id: string;
  loginId?: string;
  email?: string;
  name?: string;
  roles?: string[];
}

export interface EnhanceCredentialsEmailPayload {
  recipient: string;
  displayName: string;
  firstName: string;
  organizationName: string;
  password: string;
}

export interface EnsureEnhanceCustomerForPurchaseResult {
  enhanceCustomerId: string;
  purchaserLoginId: string;
  purchaserMemberId: string;
  credentialsCreated: boolean;
  credentialsEmail: EnhanceCredentialsEmailPayload | null;
  ownerAssigned: boolean;
}

const pickRandomChar = (value: string) => value[crypto.randomInt(0, value.length)];

const shuffle = <T>(values: T[]) => {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const generateEnhancePassword = () => {
  const alphabet = `${LOWERCASE_CHARS}${UPPERCASE_CHARS}${NUMBER_CHARS}${SPECIAL_CHARS}`;
  const requiredChars = [
    pickRandomChar(LOWERCASE_CHARS),
    pickRandomChar(UPPERCASE_CHARS),
    pickRandomChar(NUMBER_CHARS),
    pickRandomChar(SPECIAL_CHARS),
  ];

  const remainingChars = Array.from(
    { length: ENHANCE_PASSWORD_LENGTH - requiredChars.length },
    () => pickRandomChar(alphabet)
  );

  return shuffle([...requiredChars, ...remainingChars]).join('');
};

const extractCollection = <T>(value: any): T[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  if (Array.isArray(value?.results)) {
    return value.results;
  }

  return [];
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const getFirstName = (value?: string | null, email?: string | null) => {
  const trimmedName = value?.trim();
  if (trimmedName) {
    return trimmedName.split(/\s+/)[0] || trimmedName;
  }

  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail.split('@')[0] || trimmedEmail;
  }

  return 'Customer';
};

const requireRemoteId = (resourceName: string, payload: any) => {
  const id = payload?.id;
  if (typeof id === 'string' && id.trim().length > 0) {
    return id;
  }

  throw new Error(`${resourceName} creation returned no id`);
};

const hasOwner = (members: EnhanceMemberRecord[]) =>
  members.some((member) => Array.isArray(member.roles) && member.roles.includes(ENHANCE_OWNER_ROLE));

const findRealmLoginByEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const limit = 100;
  let offset = 0;

  while (true) {
    const response = await EnhanceService.getLogins({ limit, offset });
    const items = extractCollection<EnhanceLoginRecord>(response);
    const matchedLogin = items.find(
      (login) => normalizeEmail(login.email) === normalizedEmail
    );

    if (matchedLogin) {
      return matchedLogin;
    }

    const total = typeof response?.total === 'number' ? response.total : items.length;
    offset += items.length;

    if (items.length === 0 || offset >= total) {
      return null;
    }
  }
};

export class EnhanceOnboardingService {
  static async ensureEnhanceCustomerForPurchase(params: {
    organizationId: string;
    purchaserUserId: string;
  }): Promise<EnsureEnhanceCustomerForPurchaseResult> {
    const { organizationId, purchaserUserId } = params;

    const contextResult = await query(
      `SELECT
         org.id AS organization_id,
         org.name AS organization_name,
         org.enhance_customer_id,
         usr.id AS purchaser_user_id,
         usr.email AS purchaser_email,
         usr.name AS purchaser_name
       FROM organizations org
       JOIN organization_members om
         ON om.organization_id = org.id
        AND om.user_id = $2
       JOIN users usr ON usr.id = om.user_id
       WHERE org.id = $1
       LIMIT 1`,
      [organizationId, purchaserUserId]
    );

    if (contextResult.rows.length === 0) {
      throw new Error('Organization or purchasing user not found');
    }

    const context = contextResult.rows[0] as EnhancePurchaseContextRow;
    const firstName = getFirstName(context.purchaser_name, context.purchaser_email);

    let enhanceCustomerId = context.enhance_customer_id;

    if (enhanceCustomerId) {
      console.log(`[EnhanceOnboarding] Checking if customer org ${enhanceCustomerId} exists...`);
      const exists = await EnhanceService.orgExists(enhanceCustomerId);
      if (!exists) {
        console.log(`[EnhanceOnboarding] Customer org ${enhanceCustomerId} is stale (deleted from Enhance), clearing...`);
        await query(
          `UPDATE organizations
           SET enhance_customer_id = NULL,
               updated_at = now()
           WHERE id = $1`,
          [organizationId]
        );
        enhanceCustomerId = null;
      } else {
        console.log(`[EnhanceOnboarding] Customer org ${enhanceCustomerId} exists`);
      }
    }

    if (!enhanceCustomerId) {
      console.log(`[EnhanceOnboarding] Creating new customer org for "${context.organization_name}"...`);
      const customer = await EnhanceService.createCustomer(config.ENHANCE_MASTER_ORG_ID, {
        name: context.organization_name,
      });

      enhanceCustomerId = requireRemoteId('Enhance customer', customer);
      console.log(`[EnhanceOnboarding] Created customer org: ${enhanceCustomerId}`);

      await query(
        `UPDATE organizations
         SET enhance_customer_id = $1,
             updated_at = now()
         WHERE id = $2`,
        [enhanceCustomerId, organizationId]
      );
    }

    const orgLogins = extractCollection<EnhanceLoginRecord>(
      await EnhanceService.getOrgLogins(enhanceCustomerId)
    );
    console.log(`[EnhanceOnboarding] Found ${orgLogins.length} existing logins in customer org`);
    const matchedLogin = orgLogins.find(
      (login) => normalizeEmail(login.email) === normalizeEmail(context.purchaser_email)
    );

    let purchaserLoginId = matchedLogin?.id;
    let generatedPassword: string | null = null;

    if (!purchaserLoginId) {
      generatedPassword = generateEnhancePassword();
      try {
        const newLogin = await EnhanceService.createLogin(enhanceCustomerId, {
          email: context.purchaser_email,
          name: firstName,
          password: generatedPassword,
        });
        purchaserLoginId = requireRemoteId('Enhance login', newLogin);
      } catch (error) {
        const loginAlreadyExists =
          error instanceof EnhanceApiError &&
          error.statusCode === 409 &&
          error.responseBody?.detail === 'login';

        if (!loginAlreadyExists) {
          throw error;
        }

        console.log(`[EnhanceOnboarding] Login 409 conflict for ${context.purchaser_email}, searching realm...`);
        const existingRealmLogin = await findRealmLoginByEmail(context.purchaser_email);

        if (existingRealmLogin?.id) {
          purchaserLoginId = existingRealmLogin.id;
          generatedPassword = null;
          console.log(`[EnhanceOnboarding] Resolved existing login: ${purchaserLoginId}`);
        } else {
          // Login was likely deleted with the old customer org; retry creation.
          console.log(`[EnhanceOnboarding] Login not found in realm, retrying creation...`);
          generatedPassword = generateEnhancePassword();
          const retryLogin = await EnhanceService.createLogin(enhanceCustomerId, {
            email: context.purchaser_email,
            name: firstName,
            password: generatedPassword,
          });
          purchaserLoginId = requireRemoteId('Enhance login (retry)', retryLogin);
          console.log(`[EnhanceOnboarding] Retry succeeded: ${purchaserLoginId}`);
        }
      }
    }

    const orgMembers = extractCollection<EnhanceMemberRecord>(
      await EnhanceService.getOrgMembers(enhanceCustomerId)
    );
    console.log(`[EnhanceOnboarding] Found ${orgMembers.length} existing members in customer org`);
    const matchedMember = orgMembers.find(
      (member) =>
        member.loginId === purchaserLoginId ||
        normalizeEmail(member.email) === normalizeEmail(context.purchaser_email)
    );

    let purchaserMemberId = matchedMember?.id;
    if (!purchaserMemberId) {
      console.log(`[EnhanceOnboarding] Creating org member with login ${purchaserLoginId}...`);
      const newMember = await EnhanceService.createOrgMember(enhanceCustomerId, {
        loginId: purchaserLoginId,
        roles: ENHANCE_DEFAULT_MEMBER_ROLES,
      });
      purchaserMemberId = requireRemoteId('Enhance member', newMember);
      console.log(`[EnhanceOnboarding] Created member: ${purchaserMemberId}`);
    } else {
      console.log(`[EnhanceOnboarding] Matched existing member: ${purchaserMemberId}`);
    }

    let ownerAssigned = false;
    if (!hasOwner(orgMembers)) {
      console.log(`[EnhanceOnboarding] No owner found, assigning ${purchaserMemberId} as owner...`);
      try {
        await EnhanceService.updateOrgOwner(enhanceCustomerId, {
          memberId: purchaserMemberId,
        });
        ownerAssigned = true;
        console.log(`[EnhanceOnboarding] Owner assigned successfully`);
      } catch (error) {
        const ownerAssignmentUnauthorized =
          error instanceof EnhanceApiError && error.statusCode === 403;

        if (!ownerAssignmentUnauthorized) {
          throw error;
        }
        console.log(`[EnhanceOnboarding] Owner assignment skipped (403 - already owner or insufficient perms)`);
      }
    }

    console.log(`[EnhanceOnboarding] Onboarding complete: customer=${enhanceCustomerId}, login=${purchaserLoginId}, member=${purchaserMemberId}, owner=${ownerAssigned}`);

    return {
      enhanceCustomerId,
      purchaserLoginId,
      purchaserMemberId,
      credentialsCreated: generatedPassword !== null,
      credentialsEmail:
        generatedPassword === null
          ? null
          : {
              recipient: context.purchaser_email,
              displayName: context.purchaser_name?.trim() || firstName,
              firstName,
              organizationName: context.organization_name,
              password: generatedPassword,
            },
      ownerAssigned,
    };
  }
}
