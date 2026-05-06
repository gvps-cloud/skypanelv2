/**
 * Site Status Routes
 * Public endpoint to retrieve platform-wide status (maintenance mode, registration disabled)
 */
import { Router, type Request, type Response } from "express";
import { getPlatformSetting } from "../services/platformSettingsService.js";

const router = Router();

/**
 * Get site status
 * GET /api/site-status
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const maintenanceValue = await getPlatformSetting("maintenance_mode");
    const registrationValue = await getPlatformSetting("registration_disabled");

    const maintenanceMode = Boolean(maintenanceValue?.enabled);
    const registrationDisabled = Boolean(registrationValue?.enabled);
    const maintenanceMessageHtml = typeof maintenanceValue?.messageHtml === "string"
      ? maintenanceValue.messageHtml
      : undefined;

    res.json({
      maintenanceMode,
      registrationDisabled,
      maintenanceMessageHtml,
    });
  } catch (error: any) {
    console.error("Site status error:", error);
    // Fail open — don't break the site if settings query fails
    res.json({
      maintenanceMode: false,
      registrationDisabled: false,
    });
  }
});

export default router;
