/**
 * Resolves UI-facing activity filters (aliases) into SQL predicates for activity_logs.
 * Columns are left unqualified; callers that join with alias `a.` should run their
 * existing qualify step (replace entity_type/event_type etc.) against these fragments.
 */

export function normalizeActivityTypeInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const HOSTING_ALIASES = new Set([
  "hosting",
  "web_hosting",
  "enhance_web_hosting",
  "hosting_subscription",
  "hosting_wallet",
]);

const ENHANCE_ALIASES = new Set(["enhance"]);

/**
 * Append an entity/category filter clause and bound values.
 * Returns the next PostgreSQL placeholder index ($-based numbering).
 */
export function appendActivityEntityTypeFilter(opts: {
  rawValue: string;
  clauses: string[];
  params: unknown[];
  placeholderStart: number;
}): number {
  const trimmed = opts.rawValue.trim();
  if (!trimmed) {
    return opts.placeholderStart;
  }

  const norm = normalizeActivityTypeInput(trimmed);
  let p = opts.placeholderStart;

  if (HOSTING_ALIASES.has(norm)) {
    opts.clauses.push(
      `(entity_type IN ('hosting_subscription', 'hosting_wallet') OR event_type LIKE $${p} OR event_type LIKE $${p + 1})`,
    );
    opts.params.push("hosting.%", "billing.hosting_wallet.%");
    return p + 2;
  }

  if (ENHANCE_ALIASES.has(norm)) {
    opts.clauses.push(
      `(event_type LIKE $${p} OR (entity_type = $${p + 1} AND entity_id = $${p + 2}))`,
    );
    opts.params.push("enhance.%", "platform_integration", "enhance");
    return p + 3;
  }

  opts.clauses.push(`entity_type = $${p}`);
  opts.params.push(trimmed);
  return p + 1;
}
