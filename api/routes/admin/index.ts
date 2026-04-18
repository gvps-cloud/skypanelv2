import express, { type Request, type Response } from "express";
import { adminSecurityHeaders, requestSizeLimit } from "../../middleware/security.js";
import { adminMutationRateLimiter } from "../../middleware/rateLimiting.js";

import themeRouter from "./theme.js";
import rateLimitsRouter from "./rateLimits.js";
import ticketsRouter from "./tickets.js";
import plansRouter from "./plans.js";
import providersRouter from "./providers.js";
import networkingLegacyRouter from "./networking-legacy.js";
import usersRouter from "./users.js";
import organizationsRouter from "./organizations.js";
import egressRouter from "./egress.js";
import serversRouter from "./servers.js";
import stackscriptsRouter from "./stackscripts.js";
import upstreamRouter from "./upstream.js";

const router = express.Router();

router.use(adminSecurityHeaders);
router.use(requestSizeLimit(500));
router.use((req: Request, res: Response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
    adminMutationRateLimiter(req, res, next);
    return;
  }
  next();
});

router.use("/theme", themeRouter);
router.use("/rate-limits", rateLimitsRouter);
router.use("/tickets", ticketsRouter);
router.use("/plans", plansRouter);
router.use("/providers", providersRouter);
router.use("/networking", networkingLegacyRouter);
router.use("/users", usersRouter);
router.use("/organizations", organizationsRouter);
router.use("/egress", egressRouter);
router.use("/servers", serversRouter);
router.use("/stackscripts", stackscriptsRouter);
router.use("/upstream", upstreamRouter);

export default router;
