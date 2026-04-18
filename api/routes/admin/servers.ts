import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { normalizeProviderToken } from "../../lib/providerTokens.js";
import { linodeService } from "../../services/linodeService.js";

const router = express.Router();

const isMissingTableError = (err: any): boolean => {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
};

router.get(
  "/servers",
  authenticateToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT
        v.id,
        v.organization_id,
        v.plan_id,
        v.provider_instance_id,
        v.label,
        v.status,
        v.ip_address,
        v.configuration,
        v.created_at,
        v.updated_at,
        org.name AS organization_name,
        org.slug AS organization_slug,
        u.id AS owner_id,
        u.name AS owner_name,
        u.email AS owner_email,
        plan_data.id AS plan_record_id,
        plan_data.name AS plan_name,
        plan_data.provider_plan_id AS plan_provider_plan_id,
        plan_data.specifications AS plan_specifications,
        COALESCE(plan_data.provider_id, v.provider_id) AS provider_id,
        sp.name AS provider_name,
        sp.type AS provider_type
      FROM vps_instances v
      LEFT JOIN organizations org ON org.id = v.organization_id
      LEFT JOIN users u ON u.id = org.owner_id
      LEFT JOIN LATERAL (
        SELECT p.*
        FROM vps_plans p
        WHERE (p.id::text = v.plan_id) OR (p.provider_plan_id = v.plan_id)
        ORDER BY (p.id::text = v.plan_id)::int DESC
        LIMIT 1
      ) AS plan_data ON TRUE
      LEFT JOIN service_providers sp ON sp.id = COALESCE(plan_data.provider_id, v.provider_id)
      ORDER BY v.created_at DESC`,
      );

      const rows = result.rows || [];

      const providerIds = Array.from(
        new Set(
          rows
            .map((row) => row.provider_id)
            .filter(
              (value): value is string =>
                typeof value === "string" && value.length > 0,
            ),
        ),
      );

      const providerSecrets = new Map<
        string,
        { type: string | null; token: string | null }
      >();
      if (providerIds.length > 0) {
        const providerRows = await query(
          `SELECT id, type, api_key_encrypted
             FROM service_providers
            WHERE id = ANY($1::uuid[])`,
          [providerIds],
        );

        await Promise.all(
          providerRows.rows.map(async (provider) => {
            try {
              const token = await normalizeProviderToken(
                provider.id,
                provider.api_key_encrypted,
              );
              providerSecrets.set(provider.id, {
                type: provider.type ?? null,
                token,
              });
            } catch (tokenErr) {
              console.warn(
                `Admin servers: failed to normalize API token for provider ${provider.id}`,
                tokenErr,
              );
              providerSecrets.set(provider.id, {
                type: provider.type ?? null,
                token: null,
              });
            }
          }),
        );
      }

      let regionLabelMap: Record<string, string> = {};
      const requiresLinodeRegions = rows.some((row) => {
        const providerType =
          row.provider_type ?? providerSecrets.get(row.provider_id ?? "")?.type;
        return providerType === "linode";
      });

      if (requiresLinodeRegions) {
        try {
          const regions = await linodeService.getLinodeRegions();
          regionLabelMap = Object.fromEntries(
            regions.map((r) => [r.id, r.label]),
          );
        } catch (regionErr) {
          console.warn(
            "Admin servers: failed to fetch Linode regions",
            regionErr,
          );
        }
      }

      const linodeDetailCache = new Map<number, any>();

      const enriched = await Promise.all(
        rows.map(async (row) => {
          const resolvedProviderId: string | null = row.provider_id ?? null;
          const providerMeta = resolvedProviderId
            ? providerSecrets.get(resolvedProviderId)
            : null;
          const providerType = row.provider_type ?? providerMeta?.type ?? null;

          let status = row.status;
          let ipAddress = row.ip_address;
          const configuration =
            row.configuration && typeof row.configuration === "object"
              ? { ...row.configuration }
              : {};
          let regionLabel: string | null = null;

          const networks: { ipv4: string[]; ipv6: string[] } = {
            ipv4: [],
            ipv6: [],
          };

          if (providerType === "linode") {
            const instanceId = Number(row.provider_instance_id);
            if (Number.isFinite(instanceId)) {
              try {
                let detail = linodeDetailCache.get(instanceId);
                if (!detail) {
                  detail = await linodeService.getLinodeInstance(instanceId);
                  linodeDetailCache.set(instanceId, detail);
                }

                if (detail) {
                  const currentIp =
                    Array.isArray(detail.ipv4) && detail.ipv4.length > 0
                      ? detail.ipv4[0]
                      : null;
                  const normalizedStatus =
                    detail.status === "offline" ? "stopped" : detail.status;

                  if (normalizedStatus !== status || currentIp !== ipAddress) {
                    await query(
                      "UPDATE vps_instances SET status = $1, ip_address = $2, updated_at = NOW() WHERE id = $3",
                      [normalizedStatus, currentIp, row.id],
                    );
                    status = normalizedStatus;
                    ipAddress = currentIp;
                  }

                  configuration.image =
                    configuration.image || detail.image || null;
                  configuration.region =
                    configuration.region || detail.region || null;
                  configuration.type =
                    configuration.type || detail.type || null;
                  configuration.ipv6 =
                    configuration.ipv6 || detail.ipv6 || null;

                  networks.ipv4 = Array.isArray(detail.ipv4)
                    ? Array.from(
                        new Set(detail.ipv4.filter(Boolean).map(String)),
                      )
                    : [];
                  networks.ipv6 = detail.ipv6
                    ? Array.from(new Set([String(detail.ipv6)]))
                    : [];

                  const regionCode = configuration.region ?? null;
                  if (regionCode && regionLabelMap[regionCode]) {
                    regionLabel = regionLabelMap[regionCode];
                  }
                }
              } catch (detailErr) {
                console.warn(
                  `Admin servers: unable to refresh Linode instance ${row.provider_instance_id}`,
                  detailErr,
                );
              }
            }
          }

          return {
            ...row,
            status,
            ip_address: ipAddress,
            configuration,
            region_label: regionLabel,
            provider_type: providerType,
            networks,
          };
        }),
      );

      res.json({ servers: enriched });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.json({
          servers: [],
          warning: "vps_instances table not found. Apply migrations.",
        });
      }
      console.error("Admin servers list error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch servers" });
    }
  },
);

export default router;
