import express, { type Request, type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { ProviderResourceCache } from "../../services/providerResourceCache.js";
import { encryptSecret } from "../../lib/crypto.js";
import { normalizeProviderToken } from "../../lib/providerTokens.js";
import {
  DEFAULT_LINODE_ALLOWED_REGIONS,
  normalizeRegionList,
  parseStoredAllowedRegions,
} from "../../lib/providerRegions.js";
import { invalidateRegionsCache } from "../pricing.js";
import { PlatformStatsService } from "../../services/platformStatsService.js";
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
  "/providers",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT id, name, type, active, display_order, configuration,
                allowed_regions, created_at, updated_at
           FROM service_providers
       ORDER BY display_order ASC NULLS LAST, created_at DESC`,
      );

      const providers = result.rows.map((provider) => ({
        ...provider,
        validation_status:
          provider.configuration?.validation_status || "unknown",
        validation_message: provider.configuration?.validation_message || null,
        last_api_call: provider.configuration?.last_api_call || null,
      }));

      res.json({ providers });
    } catch (err: any) {
      console.error("Admin providers list error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch providers" });
    }
  },
);

router.post(
  "/providers",
  authenticateToken,
  requireAdmin,
  [
    body("name").isString().trim().notEmpty(),
    body("type").isIn(["linode"]),
    body("apiKey").isString().trim().notEmpty(),
    body("active").optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, type, apiKey, active = true } = req.body;

      const encryptedApiKey = encryptSecret(apiKey);

      const maxOrderResult = await query(
        "SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM service_providers",
      );
      const nextOrder = maxOrderResult.rows[0].next_order;

      const result = await query(
        `INSERT INTO service_providers (name, type, api_key_encrypted, active, display_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, type, active, display_order, configuration,
                   created_at, updated_at`,
        [name, type, encryptedApiKey, active, nextOrder],
      );

      const newProvider = result.rows[0];

      ProviderResourceCache.invalidateProvider(newProvider.id);

      res.status(201).json({ provider: newProvider });
    } catch (err: any) {
      console.error("Admin provider create error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to create provider" });
    }
  },
);

router.put(
  "/providers/reorder",
  authenticateToken,
  requireAdmin,
  [
    body("providerIds")
      .isArray({ min: 1 })
      .withMessage("providerIds must be a non-empty array"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { providerIds } = req.body;

      console.log("Received reorder request:", { providerIds });

      for (let i = 0; i < providerIds.length; i++) {
        await query(
          "UPDATE service_providers SET display_order = $1, updated_at = NOW() WHERE id = $2",
          [i + 1, providerIds[i]],
        );
      }

      res.json({
        success: true,
        message: "Provider order updated successfully",
      });
    } catch (err: any) {
      console.error("Admin provider reorder error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to reorder providers" });
    }
  },
);

router.put(
  "/providers/:id",
  authenticateToken,
  requireAdmin,
  [
    param("id").isUUID(),
    body("name").optional().isString().trim().notEmpty(),
    body("active").optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, active } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (active !== undefined) {
        updates.push(`active = $${paramCount++}`);
        values.push(active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(
        `UPDATE service_providers SET ${updates.join(
          ", ",
        )} WHERE id = $${paramCount}
          RETURNING id, name, type, active, display_order, configuration,
                    created_at, updated_at`,
        values,
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const updatedProvider = result.rows[0];

      ProviderResourceCache.invalidateProvider(updatedProvider.id);

      res.json({ provider: updatedProvider });
    } catch (err: any) {
      console.error("Admin provider update error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to update provider" });
    }
  },
);

router.get(
  "/providers/:id/regions",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const providerResult = await query(
        `SELECT id, name, type, api_key_encrypted, allowed_regions
           FROM service_providers
          WHERE id = $1
          LIMIT 1`,
        [id],
      );

      if (providerResult.rows.length === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const provider = providerResult.rows[0];
      const providerType = provider.type as "linode";

      if (providerType !== "linode") {
        return res
          .status(400)
          .json({ error: "Region management is only supported for Linode" });
      }

      let allowedRegions: string[] = [];
      try {
        const overridesResult = await query(
          "SELECT region FROM provider_region_overrides WHERE provider_id = $1",
          [id],
        );

        if (overridesResult.rows.length > 0) {
          allowedRegions = normalizeRegionList(
            overridesResult.rows
              .map((row) => row.region)
              .filter((value): value is string => typeof value === "string"),
          );
        }
      } catch (overrideErr: any) {
        const message = String(overrideErr?.message || "").toLowerCase();
        const missingTable =
          message.includes("relation") &&
          message.includes("provider_region_overrides");
        if (!missingTable) {
          throw overrideErr;
        }
      }

      if (allowedRegions.length === 0) {
        allowedRegions = parseStoredAllowedRegions(
          provider.allowed_regions ?? null,
        );
      }

      const mode: "default" | "custom" =
        allowedRegions.length > 0 ? "custom" : "default";

      const linodeRegions = await linodeService.getLinodeRegions();
      const allRegions = linodeRegions.map((region) => ({
        id: region.id,
        label: region.label,
        country: region.country ?? "",
        capabilities: Array.isArray(region.capabilities)
          ? region.capabilities
          : [],
        status: region.status ?? "unknown",
      }));

      const normalizedDefaultSet = new Set(
        DEFAULT_LINODE_ALLOWED_REGIONS.map((slug) => slug.toLowerCase()),
      );

      const effectiveAllowedSet =
        mode === "custom"
          ? new Set(allowedRegions)
          : new Set(
              allRegions
                .map((region) =>
                  typeof region.id === "string" ? region.id.toLowerCase() : "",
                )
                .filter(Boolean),
            );

      const regions = allRegions.map((region) => {
        const slug =
          typeof region.id === "string" ? region.id.toLowerCase() : "";
        return {
          id: region.id,
          label: region.label || region.id,
          country: region.country,
          status: region.status,
          capabilities: region.capabilities,
          allowed: slug ? effectiveAllowedSet.has(slug) : false,
          isDefault: slug ? normalizedDefaultSet.has(slug) : false,
        };
      });

      res.json({
        provider: {
          id: provider.id,
          name: provider.name,
          type: providerType,
        },
        mode,
        allowedRegions,
        defaultRegions: Array.from(normalizedDefaultSet),
        regions,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Admin provider regions fetch error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to fetch provider regions" });
    }
  },
);

router.put(
  "/providers/:id/regions",
  authenticateToken,
  requireAdmin,
  [
    param("id").isUUID(),
    body("mode").optional().isString(),
    body("regions").optional().isArray(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const modeRaw =
        typeof req.body.mode === "string"
          ? req.body.mode.toLowerCase().trim()
          : "custom";
      const mode: "default" | "custom" =
        modeRaw === "default" ? "default" : "custom";

      const providerResult = await query(
        `SELECT id, name, type, api_key_encrypted
           FROM service_providers
          WHERE id = $1
          LIMIT 1`,
        [id],
      );

      if (providerResult.rows.length === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const provider = providerResult.rows[0];
      const providerType = provider.type as "linode";

      if (providerType !== "linode") {
        return res
          .status(400)
          .json({ error: "Region management is only supported for Linode" });
      }

      let requestedRegions: string[] = [];

      if (mode === "custom") {
        if (!Array.isArray(req.body.regions)) {
          return res
            .status(400)
            .json({ error: "regions must be an array when mode is custom" });
        }

        requestedRegions = normalizeRegionList(
          req.body.regions.filter(
            (value: unknown): value is string => typeof value === "string",
          ),
        );

        if (requestedRegions.length === 0) {
          return res.status(400).json({
            error: "Select at least one region or switch to default mode",
          });
        }
      }

      const token = await normalizeProviderToken(
        provider.id,
        provider.api_key_encrypted,
      );

      if (mode === "custom") {
        if (!token) {
          return res
            .status(503)
            .json({ error: "Provider credentials not available" });
        }

        let validRegionSlugs: Set<string> = new Set();

        const linodeRegions = await linodeService.getLinodeRegions();
        validRegionSlugs = new Set(
          linodeRegions
            .map((region) => region.id?.toLowerCase())
            .filter((value): value is string => Boolean(value)),
        );

        const invalidSelections = requestedRegions.filter(
          (region) => !validRegionSlugs.has(region),
        );
        if (invalidSelections.length > 0) {
          return res.status(400).json({
            error:
              "One or more selected regions are not available from the provider",
            invalidRegions: invalidSelections,
          });
        }
      }

      const jsonPayload =
        mode === "custom"
          ? JSON.stringify(requestedRegions)
          : JSON.stringify([]);

      await query("BEGIN");
      try {
        await query(
          "DELETE FROM provider_region_overrides WHERE provider_id = $1",
          [id],
        );

        if (mode === "custom" && requestedRegions.length > 0) {
          const values: string[] = [];
          const queryParams: any[] = [id];

          requestedRegions.forEach((region, index) => {
            queryParams.push(region);
            values.push(`($1, $${index + 2})`);
          });

          await query(
            `INSERT INTO provider_region_overrides (provider_id, region)
             VALUES ${values.join(", ")}
             ON CONFLICT (provider_id, region)
             DO UPDATE SET updated_at = NOW()`,
            queryParams,
          );
        }

        await query(
          "UPDATE service_providers SET allowed_regions = $2::jsonb, updated_at = NOW() WHERE id = $1",
          [id, jsonPayload],
        );

        await query("COMMIT");
      } catch (txnError) {
        await query("ROLLBACK");
        throw txnError;
      }

      ProviderResourceCache.invalidateProvider(id);

      invalidateRegionsCache();

      PlatformStatsService.clearCache();

      res.json({
        success: true,
        mode,
        allowedRegions: requestedRegions,
        message:
          mode === "custom"
            ? `Configured ${requestedRegions.length} allowed region${requestedRegions.length === 1 ? "" : "s"}`
            : "Reverted to provider defaults",
      });
    } catch (err: any) {
      console.error("Admin provider regions update error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to update provider regions" });
    }
  },
);

router.delete(
  "/providers/:id",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: errors.array() });
      }

      const { id } = req.params;

      ProviderResourceCache.invalidateProvider(id);

      await query("DELETE FROM service_providers WHERE id = $1", [id]);
      res.status(204).send();
    } catch (err: any) {
      console.error("Admin provider delete error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to delete provider" });
    }
  },
);

router.post(
  "/providers/:id/validate",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ error: "Invalid input", details: errors.array() });
      }

      const { id } = req.params;

      const providerResult = await query(
        "SELECT * FROM service_providers WHERE id = $1",
        [id],
      );

      if (providerResult.rows.length === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const provider = providerResult.rows[0];
      const apiToken = await normalizeProviderToken(
        provider.id,
        provider.api_key_encrypted,
      );

      if (!apiToken) {
        return res.status(400).json({
          error: "Provider API token is not configured",
        });
      }
      let validationStatus: "valid" | "invalid" = "invalid";
      let validationMessage = "";

      try {
        if (provider.type === "linode") {
          const testResult = await linodeService.testConnection(apiToken);
          validationStatus = testResult.success ? "valid" : "invalid";
          validationMessage = testResult.message || "";
        } else {
          validationStatus = "invalid";
          validationMessage = "Provider type not supported for validation";
        }

        await query(
          `UPDATE service_providers
           SET configuration = jsonb_set(
             jsonb_set(
               COALESCE(configuration, '{}'::jsonb),
               '{validation_status}',
               $1::jsonb
             ),
             '{validation_message}',
             $2::jsonb
           ),
           updated_at = NOW()
           WHERE id = $3`,
          [
            JSON.stringify(validationStatus),
            JSON.stringify(validationMessage),
            id,
          ],
        );

        if (validationStatus === "valid") {
          await query(
            `UPDATE service_providers
             SET configuration = jsonb_set(
               COALESCE(configuration, '{}'::jsonb),
               '{last_api_call}',
               $1::jsonb
             )
             WHERE id = $2`,
            [JSON.stringify(new Date().toISOString()), id],
          );
        }

        res.json({
          validation_status: validationStatus,
          validation_message: validationMessage,
          last_api_call:
            validationStatus === "valid" ? new Date().toISOString() : null,
        });
      } catch (validationError: any) {
        validationStatus = "invalid";
        validationMessage =
          validationError.message || "Failed to validate credentials";

        await query(
          `UPDATE service_providers
           SET configuration = jsonb_set(
             jsonb_set(
               COALESCE(configuration, '{}'::jsonb),
               '{validation_status}',
               $1::jsonb
             ),
             '{validation_message}',
             $2::jsonb
           ),
           updated_at = NOW()
           WHERE id = $3`,
          [
            JSON.stringify(validationStatus),
            JSON.stringify(validationMessage),
            id,
          ],
        );

        res.json({
          validation_status: validationStatus,
          validation_message: validationMessage,
          last_api_call: null,
        });
      }
    } catch (err: any) {
      console.error("Admin provider validation error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to validate provider" });
    }
  },
);

export default router;
