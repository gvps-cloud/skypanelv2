import { config } from '../config/index.js';
import { query } from './database.js';

export interface HostingSubscriptionWithEnhanceOrg {
  [key: string]: any;
  organization_id: string;
  enhance_customer_org_id?: string | null;
}

const HOSTING_SUBSCRIPTION_WITH_ENHANCE_ORG_SELECT = `
  SELECT hs.*, org.enhance_customer_id AS enhance_customer_org_id
  FROM hosting_subscriptions hs
  JOIN organizations org ON org.id = hs.organization_id
`;

export async function getHostingSubscriptionForOrganization(
  subscriptionId: string,
  organizationId: string,
): Promise<HostingSubscriptionWithEnhanceOrg | null> {
  const result = await query(
    `${HOSTING_SUBSCRIPTION_WITH_ENHANCE_ORG_SELECT}
     WHERE hs.id = $1 AND hs.organization_id = $2 AND hs.status <> 'cancelled'`,
    [subscriptionId, organizationId],
  );

  return (result.rows[0] as HostingSubscriptionWithEnhanceOrg | undefined) ?? null;
}

export async function getHostingSubscriptionById(
  subscriptionId: string,
): Promise<HostingSubscriptionWithEnhanceOrg | null> {
  const result = await query(
    `${HOSTING_SUBSCRIPTION_WITH_ENHANCE_ORG_SELECT}
     WHERE hs.id = $1`,
    [subscriptionId],
  );

  return (result.rows[0] as HostingSubscriptionWithEnhanceOrg | undefined) ?? null;
}

export function getEnhanceWebsiteOrgId(
  subscription: Pick<HostingSubscriptionWithEnhanceOrg, 'enhance_customer_org_id'> | null | undefined,
) {
  const customerOrgId = subscription?.enhance_customer_org_id;
  return typeof customerOrgId === 'string' && customerOrgId.trim().length > 0
    ? customerOrgId
    : config.ENHANCE_MASTER_ORG_ID;
}