import express from "express";
import { authenticateToken, requireOrganization } from "../../middleware/auth.js";
import { requireVpsEnabledForUsers } from "../../middleware/vpsHosting.js";

import providersRouter from "./providers.js";
import plansRouter from "./plans.js";
import statsRouter from "./stats.js";
import stackscriptsRouter from "./stackscripts.js";
import backupsRouter from "./backups.js";
import firewallsRouter from "./firewalls.js";
import networkingRouter from "./networking.js";
import disksRouter from "./disks.js";
import instancesRouter from "./instances.js";

const router = express.Router();

router.use(authenticateToken, requireOrganization, requireVpsEnabledForUsers);

router.use("/", providersRouter);
router.use("/", plansRouter);
router.use("/stats", statsRouter);
router.use("/", stackscriptsRouter);
router.use("/", backupsRouter);
router.use("/", firewallsRouter);
router.use("/", networkingRouter);
router.use("/", disksRouter);
router.use("/", instancesRouter);

export default router;
