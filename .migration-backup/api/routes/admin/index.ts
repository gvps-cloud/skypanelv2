import express, { type Request, type Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { adminSecurityHeaders, requestSizeLimit } from "../../middleware/security.js";
import { adminMutationRateLimiter } from "../../middleware/rateLimiting.js";

import themeRouter from "./theme.js";
import rateLimitsRouter from "./rateLimits.js";
import ticketsRouter from "./tickets.js";
import plansRouter from "./plans.js";
import providersRouter from "./providers.js";
import networkingRouter from "./networking.js";
import usersRouter, { handleAdminImpersonationExit } from "./users.js";
import organizationsRouter from "./organizations.js";
import egressRouter from "./egress.js";
import serversRouter from "./servers.js";
import stackscriptsRouter from "./stackscripts.js";
import upstreamRouter from "./upstream.js";
import billingRouter from "./billing.js";
import volumePricingRouter from "./volumePricing.js";
import emailTemplatesRouter from "./emailTemplates.js";
import contactRouter from "./contact.js";
import activityRouter from "./activity.js";
import announcementsRouter from "./announcements.js";
import sshKeysRouter from "./sshKeys.js";
import categoryMappingsRouter from "./categoryMappings.js";
import platformRouter from "./platform.js";
import faqRouter from "./faq.js";
import documentationRouter from "./documentation.js";
import githubRouter from "./github.js";
import enhanceAdminRouter from "./enhance.js";
import refundsRouter from "./refunds.js";
import fraudRouter from "./fraud.js";

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

router.use("/", themeRouter);
router.use("/", rateLimitsRouter);
router.use("/", ticketsRouter);
router.use("/", plansRouter);
router.use("/", providersRouter);
router.use("/networking", networkingRouter);
router.post("/impersonation/exit", authenticateToken, handleAdminImpersonationExit);
router.use("/users", usersRouter);
router.use("/", organizationsRouter);
router.use("/", egressRouter);
router.use("/", serversRouter);
router.use("/", stackscriptsRouter);
router.use("/", upstreamRouter);
router.use("/billing", billingRouter);
router.use("/volume-billing", volumePricingRouter);
router.use("/email-templates", emailTemplatesRouter);
router.use("/contact", contactRouter);
router.use("/activity", activityRouter);
router.use("/announcements", announcementsRouter);
router.use("/ssh-keys", sshKeysRouter);
router.use("/", categoryMappingsRouter);
router.use("/platform", platformRouter);
router.use("/faq", faqRouter);
router.use("/documentation", documentationRouter);
router.use("/github", githubRouter);
router.use("/enhance", enhanceAdminRouter);
router.use("/refunds", refundsRouter);
router.use("/fraud-checks", fraudRouter);

export default router;
