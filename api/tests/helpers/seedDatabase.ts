import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export interface SeedUserOptions {
  id?: string;
  email?: string;
  name?: string;
  role?: "admin" | "user";
  passwordHash?: string;
}

export interface SeedOrganizationOptions {
  id?: string;
  name?: string;
  slug?: string;
  settings?: Record<string, unknown>;
  ownerRoleName?: string;
  ownerPermissions?: string[];
}

export interface SeedWalletOptions {
  organizationId: string;
  balance?: number;
  currency?: string;
}

export interface SeedPaymentTransactionOptions {
  organizationId: string;
  amount: number;
  currency?: string;
  status?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  providerTransactionId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

type SeededUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

type SeededOrganization = {
  id: string;
  name: string;
  slug: string;
  ownerRoleId: string;
};

export async function seedUser(
  pool: Pool,
  options: SeedUserOptions = {},
): Promise<SeededUser> {
  const id = options.id ?? randomUUID();
  const email = options.email ?? `test-${id}@example.com`;
  const name = options.name ?? "Test User";
  const role = options.role ?? "user";
  const passwordHash = options.passwordHash ?? "hash";

  await pool.query(
    `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [id, email, name, role, passwordHash],
  );

  return { id, email, name, role };
}

export async function seedOrganizationWithOwner(
  pool: Pool,
  ownerId: string,
  options: SeedOrganizationOptions = {},
): Promise<SeededOrganization> {
  const id = options.id ?? randomUUID();
  const name = options.name ?? "Test Organization";
  const slug = options.slug ?? `test-org-${Date.now()}`;
  const settings = options.settings ?? {};
  const ownerRoleName = options.ownerRoleName ?? "owner";
  const ownerPermissions = options.ownerPermissions ?? ["egress_view", "egress_manage"];

  await pool.query(
    `INSERT INTO organizations (id, name, slug, owner_id, settings, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    [id, name, slug, ownerId, settings],
  );

  await pool.query(
    `UPDATE organization_roles
     SET permissions = permissions || $2::jsonb
     WHERE organization_id = $1 AND name = $3`,
    [id, JSON.stringify(ownerPermissions), ownerRoleName],
  );

  const ownerRoleResult = await pool.query(
    `SELECT id FROM organization_roles WHERE organization_id = $1 AND name = $2`,
    [id, ownerRoleName],
  );

  const ownerRoleId = ownerRoleResult.rows[0]?.id as string;

  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role, role_id, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT DO NOTHING`,
    [id, ownerId, ownerRoleName, ownerRoleId],
  );

  return { id, name, slug, ownerRoleId };
}

export async function seedUserWithOrganization(
  pool: Pool,
  userOptions: SeedUserOptions = {},
  organizationOptions: SeedOrganizationOptions = {},
): Promise<{ user: SeededUser; organization: SeededOrganization }> {
  const user = await seedUser(pool, userOptions);
  const organization = await seedOrganizationWithOwner(pool, user.id, organizationOptions);
  return { user, organization };
}

export async function seedWallet(
  pool: Pool,
  options: SeedWalletOptions,
): Promise<{ organizationId: string; balance: number; currency: string }> {
  const balance = options.balance ?? 0;
  const currency = options.currency ?? "USD";

  await pool.query(
    `INSERT INTO wallets (organization_id, balance, currency, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (organization_id) DO UPDATE
     SET balance = EXCLUDED.balance,
         currency = EXCLUDED.currency,
         updated_at = NOW()`,
    [options.organizationId, balance, currency],
  );

  return {
    organizationId: options.organizationId,
    balance,
    currency,
  };
}

export async function seedPaymentTransaction(
  pool: Pool,
  options: SeedPaymentTransactionOptions,
): Promise<{ providerTransactionId: string }> {
  const providerTransactionId =
    options.providerTransactionId ?? `mock-payment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  await pool.query(
    `INSERT INTO payment_transactions (
       organization_id,
       amount,
       currency,
       payment_method,
       payment_provider,
       status,
       provider_transaction_id,
       description,
       metadata,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
    [
      options.organizationId,
      options.amount,
      options.currency ?? "USD",
      options.paymentMethod ?? "paypal",
      options.paymentProvider ?? "paypal",
      options.status ?? "completed",
      providerTransactionId,
      options.description ?? "Seeded payment transaction",
      JSON.stringify(options.metadata ?? {}),
    ],
  );

  return { providerTransactionId };
}

export async function cleanupSeededOrganization(
  pool: Pool,
  organizationId: string,
  userId?: string,
): Promise<void> {
  await pool.query("DELETE FROM organization_egress_credits WHERE organization_id = $1", [organizationId]);
  await pool.query("DELETE FROM egress_credit_packs WHERE organization_id = $1", [organizationId]);
  await pool.query("DELETE FROM payment_transactions WHERE organization_id = $1", [organizationId]);
  await pool.query("DELETE FROM wallets WHERE organization_id = $1", [organizationId]);
  await pool.query("DELETE FROM organization_members WHERE organization_id = $1", [organizationId]);
  await pool.query("DELETE FROM organization_roles WHERE organization_id = $1", [organizationId]);
  await pool.query("DELETE FROM organizations WHERE id = $1", [organizationId]);

  if (userId) {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }
}
