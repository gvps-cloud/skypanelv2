import express, { Request, Response } from "express";
import { query } from '../../lib/database.js';
import { linodeService } from '../../services/linodeService.js';
import {
  loadProviderTokenById,
  normalizeImageTemplate,
} from "./shared/utils.js";
import { handleProviderError, sendSafeErrorResponse } from '../../lib/errorHandling.js';

const router = express.Router();

router.get("/apps", async (req: Request, res: Response) => {
  try {
    const configsRes = await query(
      `SELECT stackscript_id, label, description, is_enabled, display_order, metadata
         FROM vps_stackscript_configs
        WHERE is_enabled = TRUE
        ORDER BY display_order ASC, created_at ASC`,
    );

    const configs = configsRes.rows || [];

    if (configs.length === 0) {
      return res.json({ apps: [] });
    }

    const ownedScripts = await linodeService
      .getLinodeStackScripts({ mineOnly: true })
      .catch(() => []);
    const scriptMap = new Map<number, any>();
    ownedScripts.forEach((s: any) => scriptMap.set(Number(s.id), s));

    const apps: any[] = [];
    for (const row of configs) {
      const id = Number(row.stackscript_id);
      let script = scriptMap.get(id);
      if (!script) {
        try {
          script = await linodeService.getStackScript(id);
        } catch (err) {
          console.warn(
            'Configured StackScript could not be loaded',
            { stackscriptId: id, error: err?.message || String(err) },
          );
          continue;
        }
      }

      const displayLabel = row.label || script.label || `StackScript ${id}`;
      const displayDescription =
        row.description || script.description || script.rev_note || "";
      const user_defined_fields = Array.isArray(script.user_defined_fields)
        ? script.user_defined_fields
        : [];

      apps.push({
        slug: `stackscript-${id}`,
        id,
        name: script.label || displayLabel,
        display_name: displayLabel,
        description: displayDescription,
        summary: script.description || script.rev_note || "",
        images: Array.isArray(script.images) ? script.images : [],
        user_defined_fields,
        stackscript_id: id,
        isMarketplace: false,
      });
    }

    res.json({ apps });
  } catch (err: any) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch configured apps" });
  }
});

router.get("/images", async (req: Request, res: Response) => {
  try {
    const providerId =
      typeof req.query.provider_id === "string" ? req.query.provider_id.trim() : "";

    if (!providerId) {
      return res.status(400).json({
        error: "provider_id query parameter is required",
        code: "PROVIDER_ID_REQUIRED",
      });
    }

    const providerToken = await loadProviderTokenById(providerId, "linode");
    if (!providerToken) {
      return res.status(404).json({
        error: "Provider not found or inactive",
        code: "PROVIDER_NOT_FOUND",
      });
    }

    const images = await linodeService.getLinodeImages(providerToken);
    const templates = images.map((image) =>
      normalizeImageTemplate(image, providerId),
    );
    res.json({ images: templates });
  } catch (err) {
    const structuredError = handleProviderError(err, "linode", "fetch images");
    res.status(structuredError.statusCode).json({ error: structuredError.message, code: structuredError.code });
  }
});

router.get("/stackscripts", async (req: Request, res: Response) => {
  const isTruthy = (value: any) => String(value || "").toLowerCase() === "true";
  const configuredOnly = isTruthy(
    (req.query as any).configured ||
      (req.query as any).allowed ||
      (req.query as any).allowedOnly,
  );
  const mineOnly = isTruthy(req.query.mine);

  try {
    if (configuredOnly) {
      let configs: any[] = [];
      try {
        const configRes = await query(
          `SELECT stackscript_id, label, description, is_enabled, display_order, metadata
             FROM vps_stackscript_configs
            WHERE is_enabled = TRUE
            ORDER BY display_order ASC, created_at ASC`,
        );
        configs = configRes.rows || [];
      } catch (configErr: any) {
        const msg = String(configErr?.message || "").toLowerCase();
        if (
          msg.includes("does not exist") ||
          (msg.includes("relation") && msg.includes("vps_stackscript_configs"))
        ) {
          console.warn(
            "StackScript config table missing; returning empty configured list",
          );
          return res.json({ stackscripts: [] });
        }
        throw configErr;
      }

      if (configs.length === 0) {
        return res.json({ stackscripts: [] });
      }

      let ownedScripts: any[] = [];
      const scriptMap = new Map<number, any>();
      try {
        ownedScripts = await linodeService.getLinodeStackScripts({
          mineOnly: true,
        });
        ownedScripts.forEach((script) => scriptMap.set(script.id, script));
      } catch (err) {
        console.warn(
          "Failed to fetch owned StackScripts list, will query individually:",
          err,
        );
      }

      const enriched: any[] = [];
      for (const row of configs) {
        const stackscriptId = Number(row.stackscript_id);
        let script = scriptMap.get(stackscriptId);
        if (!script) {
          try {
            const single = await linodeService.getStackScript(stackscriptId);
            if (single) {
              script = single;
              scriptMap.set(single.id, single);
            }
          } catch (err) {
            console.warn('Failed to fetch StackScript', { stackscriptId }, err);
          }
        }

        if (!script) {
          continue;
        }

        const displayLabel =
          row.label || script.label || `StackScript ${stackscriptId}`;
        const displayDescription =
          row.description || script.description || script.rev_note || "";
        const metadata =
          row.metadata && typeof row.metadata === "object" ? row.metadata : {};

        enriched.push({
          ...script,
          label: displayLabel,
          description: displayDescription,
          config: {
            stackscript_id: stackscriptId,
            label: row.label,
            description: row.description,
            is_enabled: row.is_enabled !== false,
            display_order: Number(row.display_order || 0),
            metadata,
          },
        });
      }

      enriched.sort((a, b) => {
        const orderA = Number(a?.config?.display_order ?? 0);
        const orderB = Number(b?.config?.display_order ?? 0);
        if (orderA !== orderB) return orderA - orderB;
        return String(a?.label || "").localeCompare(
          String(b?.label || ""),
          undefined,
          { sensitivity: "base" },
        );
      });

      return res.json({ stackscripts: enriched });
    }

    const stackscripts = await linodeService.getLinodeStackScripts({
      mineOnly,
    });
    return res.json({ stackscripts });
  } catch (err: any) {
    sendSafeErrorResponse(res, err, 500, { fallbackMessage: "Failed to fetch stack scripts" });
  }
});

export default router;
