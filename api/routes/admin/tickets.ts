import express, { type Request, type Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/auth.js";
import { query } from "../../lib/database.js";
import { logActivity } from "../../services/activityLogger.js";
import { tokenBlacklistService } from "../../services/tokenBlacklistService.js";
import { ticketNotificationService } from "../../services/ticketNotificationService.js";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";

const router = express.Router();

const isMissingTableError = (err: any): boolean => {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
};

type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<
  SupportTicketStatus,
  SupportTicketStatus[]
> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["open", "in_progress", "closed"],
  closed: ["open"],
};

router.get(
  "/tickets",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const result = await query(
        `SELECT
           st.*,
           u.id AS creator_id,
           u.name AS creator_name,
           u.email AS creator_email,
           org.name AS organization_name,
           org.slug AS organization_slug,
           COALESCE(vi.label, st.vps_label_snapshot) as vps_label,
           COALESCE(hs.status = 'active', false) AS hosting_subscription_is_active,
           COALESCE(hp.is_active, false) AS hosting_plan_is_active,
           COALESCE(st.hosting_domain_snapshot, hs.domain) AS hosting_domain,
           COALESCE(st.hosting_plan_name_snapshot, hp.name) AS hosting_plan_name
          FROM support_tickets st
          LEFT JOIN users u ON u.id = st.created_by
          LEFT JOIN organizations org ON org.id = st.organization_id
          LEFT JOIN vps_instances vi ON st.vps_id = vi.id
          LEFT JOIN hosting_subscriptions hs ON st.hosting_subscription_id = hs.id
          LEFT JOIN hosting_plans hp ON hp.id = hs.plan_id
          ORDER BY st.created_at DESC`,
      );

      const tickets = (result.rows || []).map((row: any) => {
        const { creator_id, creator_name, creator_email, ...ticketFields } =
          row;

        return {
          ...ticketFields,
          creator: creator_id
            ? {
                id: creator_id,
                name: creator_name ?? null,
                email: creator_email ?? null,
                displayName: creator_name || creator_email || row.created_by,
              }
            : undefined,
        };
      });

      res.json({ tickets });
    } catch (err: any) {
      console.error("Admin tickets list error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch tickets" });
    }
  },
);

router.patch(
  "/tickets/:id/status",
  authenticateToken,
  requireAdmin,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    body("status")
      .isIn(["open", "in_progress", "resolved", "closed"])
      .withMessage("Invalid status"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { status } = req.body as { status: SupportTicketStatus };
      const adminUserId = (req as any).user?.id as string | undefined;

      const ticketRes = await query(
        "SELECT id, status, created_by, organization_id, subject FROM support_tickets WHERE id = $1",
        [id],
      );
      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const existingTicket = ticketRes.rows[0];
      const requestedStatus = status;
      const currentStatus = existingTicket.status as SupportTicketStatus;

      if (requestedStatus === currentStatus) {
        res
          .status(400)
          .json({ error: `Ticket is already marked as ${requestedStatus}.` });
        return;
      }

      const allowedTransitions =
        ALLOWED_TICKET_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(requestedStatus)) {
        res.status(400).json({
          error: `Invalid status transition from ${currentStatus} to ${requestedStatus}. Allowed transitions: ${allowedTransitions.join(", ")}`,
        });
        return;
      }

      const nextStatus = requestedStatus;

      const result = await query(
        "UPDATE support_tickets SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *",
        [nextStatus, new Date().toISOString(), id],
      );

      if (result.rows.length === 0) {
        throw new Error("Failed to update ticket status");
      }

      const statusNotification = {
        type: "ticket_status_change",
        ticket_id: id,
        new_status: nextStatus,
      };
      try {
        await query('SELECT pg_notify($1, $2)', ['ticket_updates', JSON.stringify(statusNotification)]);
      } catch (notifyErr) {
        console.warn('[Admin] Ticket NOTIFY failed for ticket %s:', id, notifyErr);
      }

      const userMessageByStatus: Record<
        string,
        { message: string; status: "success" | "warning" | "error" | "info" }
      > = {
        in_progress: {
          message: `Support is now working on your ticket: "${existingTicket.subject}"`,
          status: "info",
        },
        open: {
          message:
            currentStatus === "closed" || currentStatus === "resolved"
              ? `Your ticket was re-opened by support: "${existingTicket.subject}"`
              : `Your ticket was moved back to open by support: "${existingTicket.subject}"`,
          status: "info",
        },
        resolved: {
          message: `Your ticket was marked as resolved: "${existingTicket.subject}"`,
          status: "success",
        },
        closed: {
          message: `Your ticket was closed by support: "${existingTicket.subject}"`,
          status: "warning",
        },
      };

      const userStatusUpdate = userMessageByStatus[requestedStatus];
      if (userStatusUpdate) {
        await logActivity(
          {
            userId: existingTicket.created_by,
            organizationId: existingTicket.organization_id,
            eventType: "ticket_reply",
            entityType: "support_ticket",
            entityId: id,
            message: userStatusUpdate.message,
            status: userStatusUpdate.status,
            metadata: {
              ticket_id: id,
              ticket_subject: existingTicket.subject,
              is_status_update: true,
              old_status: existingTicket.status,
              requested_status: requestedStatus,
              new_status: nextStatus,
              updated_by: adminUserId || null,
            },
          },
          req,
        );
      }

      res.json({ ticket: result.rows[0] });
    } catch (err: any) {
      console.error("Admin ticket status update error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to update ticket status" });
    }
  },
);

router.delete(
  "/tickets/:id",
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
      await query("DELETE FROM support_tickets WHERE id = $1", [id]);
      res.status(204).send();
    } catch (err: any) {
      console.error("Admin ticket delete error:", err);
      res.status(500).json({ error: err.message || "Failed to delete ticket" });
    }
  },
);

router.post(
  "/tickets/:id/replies",
  authenticateToken,
  requireAdmin,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    body("message").isLength({ min: 1 }).withMessage("Message is required"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { message } = req.body as { message: string };

      const ticketRes = await query(
        "SELECT organization_id, created_by, subject FROM support_tickets WHERE id = $1",
        [id],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const ticket = ticketRes.rows[0];

      const replyResult = await query(
        `INSERT INTO support_ticket_replies (ticket_id, user_id, message, is_staff_reply, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, (req as any).user?.id, message, true, new Date().toISOString()],
      );

      if (replyResult.rows.length === 0) {
        throw new Error("Failed to create reply");
      }

      await query("UPDATE support_tickets SET updated_at = $1 WHERE id = $2", [
        new Date().toISOString(),
        id,
      ]);

      await logActivity(
        {
          userId: ticket.created_by,
          organizationId: ticket.organization_id,
          eventType: "ticket_reply",
          entityType: "support_ticket",
          entityId: id,
          message: `Staff replied to your ticket: "${ticket.subject}"`,
          status: "info",
          metadata: {
            ticket_id: id,
            reply_preview: message.substring(0, 100),
            is_staff_reply: true,
          },
        },
        req,
      );

      const replyRow = replyResult.rows[0];

      const notificationPayload = {
        type: "ticket_message",
        ticket_id: id,
        message_id: replyRow.id,
        message: replyRow.message,
        is_staff_reply: true,
        created_at: replyRow.created_at,
        sender_name: "Support Team",
      };
      try {
        await query('SELECT pg_notify($1, $2)', ['ticket_updates', JSON.stringify(notificationPayload)]);
      } catch (notifyErr) {
        console.warn('[Admin] Ticket NOTIFY failed for ticket %s:', id, notifyErr);
      }

      res.status(201).json({
        reply: {
          id: replyRow.id,
          ticket_id: replyRow.ticket_id,
          message: replyRow.message,
          created_at: replyRow.created_at,
          sender_type: "admin",
          sender_name: "Staff Member",
        },
      });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.status(400).json({
          error:
            "support_ticket_replies table not found. Apply migrations before replying.",
        });
      }
      console.error("Admin ticket reply error:", err);
      res.status(500).json({ error: err.message || "Failed to add reply" });
    }
  },
);

router.get(
  "/tickets/:id/replies",
  authenticateToken,
  requireAdmin,
  [param("id").isUUID().withMessage("Invalid ticket id")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const ticketCheck = await query(
        "SELECT id FROM support_tickets WHERE id = $1",
        [id],
      );
      if (ticketCheck.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const repliesRes = await query(
        `SELECT r.id, r.ticket_id, r.message, r.is_staff_reply, r.created_at,
                u.name as sender_name, u.email as sender_email
           FROM support_ticket_replies r
           JOIN users u ON u.id = r.user_id
          WHERE r.ticket_id = $1
          ORDER BY r.created_at ASC`,
        [id],
      );
      const replies = (repliesRes.rows || []).map((r: any) => ({
        id: r.id,
        ticket_id: r.ticket_id,
        message: r.message,
        created_at: r.created_at,
        sender_type: r.is_staff_reply ? "admin" : "user",
        sender_name: r.is_staff_reply
          ? "Staff Member"
          : r.sender_name || r.sender_email || "Unknown",
      }));
      res.json({ replies });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.status(400).json({
          error:
            "support_ticket_replies table not found. Apply migrations before listing replies.",
        });
      }
      console.error("Admin list replies error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch replies" });
    }
  },
);

router.get(
  "/tickets/:id/stream",
  [param("id").isUUID().withMessage("Invalid ticket id")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;

      const token = req.query.token as string;
      if (!token) {
        res.status(401).json({ error: "Authentication token required" });
        return;
      }

      const isRevoked = await tokenBlacklistService.isRevoked(token);
      if (isRevoked) {
        res.status(401).json({ error: "Token has been revoked" });
        return;
      }

      let decoded: { userId: string; role?: string };
      try {
        decoded = jwt.verify(token, config.JWT_SECRET) as {
          userId: string;
          role?: string;
        };
      } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      const userRes = await query("SELECT role FROM users WHERE id = $1", [
        decoded.userId,
      ]);
      if (userRes.rows.length === 0 || userRes.rows[0].role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      const ticketCheck = await query(
        "SELECT id FROM support_tickets WHERE id = $1",
        [id],
      );

      if (ticketCheck.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      res.write('data: {"type":"connected"}\n\n');

      let streamClosed = false;
      let heartbeat: NodeJS.Timeout | null = null;

      const closeStream = async (reason: string) => {
        if (streamClosed) {
          return;
        }
        streamClosed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        ticketNotificationService.removeListener("ticket_update", notificationHandler);
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ error: reason })}\n\n`);
        } catch {
        }
        res.end();
      };

      const notificationHandler = async (
        payload: { ticket_id: string; [key: string]: unknown },
        rawPayload: string,
      ) => {
        if (payload.ticket_id !== id) {
          return;
        }
        const revoked = await tokenBlacklistService.isRevoked(token);
        if (revoked) {
          await closeStream("Token has been revoked");
          return;
        }
        try {
          res.write(`data: ${rawPayload}\n\n`);
        } catch {
        }
      };

      ticketNotificationService.on("ticket_update", notificationHandler);

      heartbeat = setInterval(async () => {
        const revoked = await tokenBlacklistService.isRevoked(token);
        if (revoked) {
          await closeStream("Token has been revoked");
          return;
        }
        try {
          res.write(": heartbeat\n\n");
        } catch {
          await closeStream("Client disconnected");
        }
      }, 30000);

      req.on("close", async () => {
        await closeStream("Client disconnected");
      });
    } catch (err: unknown) {
      console.error("Admin ticket stream error:", err);
      const error = err as Error;
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: error.message || "Failed to establish stream" });
      }
    }
  },
);

export default router;
