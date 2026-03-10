import express, { Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import { authenticateToken, requireOrganization } from "../middleware/auth.js";
import { query, pool } from "../lib/database.js";
import { logActivity } from "../services/activityLogger.js";
import { RoleService } from "../services/roles.js";

const router = express.Router();

const isMissingTableError = (err: any): boolean => {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
};
const REOPEN_REQUEST_PREFIX = "[REOPEN_REQUEST]";

const notifyAdminsForTicketEvent = async ({
  organizationId,
  ticketId,
  subject,
  message,
  status,
  metadata = {},
  req,
}: {
  organizationId: string;
  ticketId: string;
  subject: string;
  message: string;
  status: "success" | "warning" | "error" | "info";
  metadata?: Record<string, unknown>;
  req: Request;
}) => {
  try {
    const adminUsersRes = await query("SELECT id FROM users WHERE role = $1", [
      "admin",
    ]);
    const adminUserIds = (adminUsersRes.rows || [])
      .map((row: any) => row.id as string)
      .filter((adminId: string) => adminId);

    await Promise.all(
      adminUserIds.map((adminId: string) =>
        logActivity(
          {
            userId: adminId,
            organizationId,
            eventType: "ticket_reply",
            entityType: "support_ticket",
            entityId: ticketId,
            message,
            status,
            metadata: {
              ticket_id: ticketId,
              ticket_subject: subject,
              ...metadata,
            },
          },
          req,
        ),
      ),
    );
  } catch (err) {
    console.warn("Failed to notify admins for ticket event:", err);
  }
};

// List support tickets for user's organization with permission-based filtering
router.get("/tickets", authenticateToken, requireOrganization, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id;
    const userRole = user.role;
    const organizationId = user.organizationId;

    let result;

    // Check permissions (admins automatically have all permissions via RoleService.checkPermission)
    const hasTicketsViewPermission = await RoleService.checkPermission(
      userId,
      organizationId,
      'tickets_view'
    );

    if (hasTicketsViewPermission) {
      result = await query(
        `SELECT st.*, COALESCE(vi.label, st.vps_label_snapshot) as vps_label
         FROM support_tickets st
         LEFT JOIN vps_instances vi ON st.vps_id = vi.id
         WHERE st.organization_id = $1 
         ORDER BY st.created_at DESC`,
        [organizationId],
      );
    } else {
      // Users without tickets_view permission see only their own tickets within their current organization
      result = await query(
        `SELECT st.*, COALESCE(vi.label, st.vps_label_snapshot) as vps_label
         FROM support_tickets st
         LEFT JOIN vps_instances vi ON st.vps_id = vi.id
         WHERE st.organization_id = $1 AND st.created_by = $2
         ORDER BY st.created_at DESC`,
        [organizationId, userId],
      );
    }

    res.json({ tickets: result.rows || [] });
  } catch (err: any) {
    console.error("Support tickets list error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch tickets" });
  }
});

// Create a new support ticket
router.post(
  "/tickets",
  authenticateToken,
  requireOrganization,
  [
    body("subject").isLength({ min: 3 }).withMessage("Subject is required"),
    body("message").isLength({ min: 10 }).withMessage("Message is required"),
    body("priority")
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority"),
    body("category").isLength({ min: 2 }).withMessage("Category is required"),
    body("vpsId").optional().isUUID().withMessage("Invalid VPS ID"),
    body("organizationId").optional().isUUID().withMessage("Invalid Organization ID"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const user = (req as any).user;
      const userId = user.id;
      
      // Determine target organization ID
      const targetOrganizationId = req.body.organizationId || user.organizationId;

      // Check tickets_create permission
      // RoleService.checkPermission handles:
      // 1. Global admin bypass (returns true)
      // 2. Organization membership check (returns false if not member)
      // 3. Permission check within organization
      const hasTicketsCreatePermission = await RoleService.checkPermission(
        userId,
        targetOrganizationId,
        'tickets_create'
      );

      if (!hasTicketsCreatePermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: 'tickets_create',
        });
      }

      const organizationId = targetOrganizationId;

      const { subject, message, priority, category, vpsId } = req.body;

    // If a VPS is linked, fetch its details first to store a snapshot
    let vpsLabelSnapshot = null;
    let vpsIpSnapshot = null;

    if (vpsId) {
      try {
        const vpsRes = await query(
          "SELECT label, ip_address FROM vps_instances WHERE id = $1",
          [vpsId],
        );
        if (vpsRes.rows.length > 0) {
          vpsLabelSnapshot = vpsRes.rows[0].label;
          vpsIpSnapshot = vpsRes.rows[0].ip_address;
        }
      } catch (err) {
        console.warn("Failed to fetch VPS details for ticket snapshot", err);
      }
    }

    const result = await query(
      `INSERT INTO support_tickets (organization_id, created_by, subject, message, priority, category, status, vps_id, vps_label_snapshot, vps_ip_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        organizationId,
        userId,
        subject,
        message,
        priority,
        category,
        "open",
        vpsId || null,
        vpsLabelSnapshot,
        vpsIpSnapshot,
      ],
    );

    const ticket = result.rows[0];

    // Use the snapshot label for notification if available
    const vpsLabel = vpsLabelSnapshot;

      await notifyAdminsForTicketEvent({
        organizationId,
        ticketId: ticket.id,
        subject: ticket.subject,
        message: `New support ticket opened: "${ticket.subject}"`,
        status: "info",
        metadata: {
          is_new_ticket: true,
          created_by: userId,
          priority,
          category,
          message_preview: String(message || "").substring(0, 100),
          vps_id: vpsId,
          vps_label: vpsLabel,
        },
        req,
      });

      res.status(201).json({ ticket });
    } catch (err: any) {
      console.error("Create ticket error:", err);
      res.status(500).json({ error: err.message || "Failed to create ticket" });
    }
  },
);

// List replies for a ticket (organization scoped)
router.get(
  "/tickets/:id/replies",
  authenticateToken,
  requireOrganization,
  [param("id").isUUID().withMessage("Invalid ticket id")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const organizationId = (req as any).user.organizationId;

      const ticketCheck = await query(
        "SELECT id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
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
      console.error("List ticket replies error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch replies" });
    }
  },
);

// Reply to a ticket (organization scoped, user reply)
router.post(
  "/tickets/:id/replies",
  authenticateToken,
  requireOrganization,
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
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          // Allow ticket creator to reply
          const ticketCreatorRes = await query(
            "SELECT created_by FROM support_tickets WHERE id = $1",
            [id],
          );
          if (ticketCreatorRes.rows.length === 0 || ticketCreatorRes.rows[0].created_by !== userId) {
            return res.status(403).json({
              error: 'Insufficient permissions to reply to this ticket',
              required: 'tickets_manage',
            });
          }
        }
      }

      const ticketCheckRes = await query(
        "SELECT id, status, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
      if (ticketCheckRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }
      const ticket = ticketCheckRes.rows[0];
      if (ticket.status === "closed") {
        res.status(403).json({
          error:
            "This ticket is closed. Submit a reopen request to continue this conversation.",
        });
        return;
      }
      const shouldReopenResolvedTicket = ticket.status === "resolved";

      const now = new Date().toISOString();
      const insertRes = await query(
        `INSERT INTO support_ticket_replies (ticket_id, user_id, message, is_staff_reply, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, userId, message, false, now],
      );
      if (insertRes.rows.length === 0) {
        throw new Error("Failed to create reply");
      }
      await query(
        "UPDATE support_tickets SET status = $1, updated_at = $2 WHERE id = $3",
        [shouldReopenResolvedTicket ? "open" : ticket.status, now, id],
      );

      await notifyAdminsForTicketEvent({
        organizationId: ticket.organization_id,
        ticketId: id,
        subject: ticket.subject,
        message: shouldReopenResolvedTicket
          ? `Customer replied and re-opened resolved ticket: "${ticket.subject}"`
          : `New customer reply on ticket: "${ticket.subject}"`,
        status: "info",
        metadata: {
          is_user_reply: true,
          replied_by: userId,
          reply_preview: String(message || "").substring(0, 100),
          reopened_by_customer_reply: shouldReopenResolvedTicket,
        },
        req,
      });

      const replyRow = insertRes.rows[0];
      const userRes = await query(
        "SELECT name, email FROM users WHERE id = $1",
        [userId],
      );
      const senderName =
        userRes.rows[0]?.name || userRes.rows[0]?.email || "Unknown";

      // Notify SSE listeners
      const notificationPayload = {
        type: "ticket_message",
        ticket_id: replyRow.ticket_id,
        message_id: replyRow.id,
        message: replyRow.message,
        is_staff_reply: false,
        created_at: replyRow.created_at,
        sender_name: senderName,
      };
      await query(`NOTIFY "ticket_${id}", '${JSON.stringify(notificationPayload)}'`);

      res.status(201).json({
        reply: {
          id: replyRow.id,
          ticket_id: replyRow.ticket_id,
          message: replyRow.message,
          created_at: replyRow.created_at,
          sender_type: "user",
          sender_name: senderName,
        },
      });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.status(400).json({
          error:
            "support_ticket_replies table not found. Apply migrations before replying.",
        });
      }
      console.error("Create ticket reply error:", err);
      res.status(500).json({ error: err.message || "Failed to add reply" });
    }
  },
);

// Update ticket status
router.put(
  "/tickets/:id/status",
  authenticateToken,
  requireOrganization,
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
      const { status } = req.body;
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: 'tickets_manage',
          });
        }
      }

      const ticketRes = await query(
        "SELECT id, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const result = await query(
        "UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [status, id],
      );

      const ticket = ticketRes.rows[0];

      await notifyAdminsForTicketEvent({
        organizationId,
        ticketId: id,
        subject: ticket.subject,
        message: `Ticket status updated to "${status}"`,
        status: "info",
        metadata: {
          status_change: status,
          updated_by: userId,
        },
        req,
      });

      res.json({ ticket: result.rows[0] });
    } catch (err: any) {
      console.error("Update ticket status error:", err);
      res.status(500).json({ error: err.message || "Failed to update ticket status" });
    }
  },
);

// Update ticket priority
router.put(
  "/tickets/:id/priority",
  authenticateToken,
  requireOrganization,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    body("priority")
      .isIn(["low", "medium", "high", "urgent"])
      .withMessage("Invalid priority"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { priority } = req.body;
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: 'tickets_manage',
          });
        }
      }

      const ticketRes = await query(
        "SELECT id, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const result = await query(
        "UPDATE support_tickets SET priority = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [priority, id],
      );

      const ticket = ticketRes.rows[0];

      await notifyAdminsForTicketEvent({
        organizationId,
        ticketId: id,
        subject: ticket.subject,
        message: `Ticket priority updated to "${priority}"`,
        status: "info",
        metadata: {
          priority_change: priority,
          updated_by: userId,
        },
        req,
      });

      res.json({ ticket: result.rows[0] });
    } catch (err: any) {
      console.error("Update ticket priority error:", err);
      res.status(500).json({ error: err.message || "Failed to update ticket priority" });
    }
  },
);

// Assign ticket to a user
router.put(
  "/tickets/:id/assign",
  authenticateToken,
  requireOrganization,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    body("assigned_to").isUUID().withMessage("Invalid user ID"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { assigned_to } = req.body;
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: 'tickets_manage',
          });
        }
      }

      // Verify the assigned user exists and belongs to the organization
      const userRes = await query(
        "SELECT id, name FROM users WHERE id = $1 AND organization_id = $2",
        [assigned_to, organizationId],
      );

      if (userRes.rows.length === 0) {
        res.status(404).json({ error: "User not found in organization" });
        return;
      }

      const ticketRes = await query(
        "SELECT id, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const result = await query(
        "UPDATE support_tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [assigned_to, id],
      );

      const ticket = ticketRes.rows[0];
      const assignedUser = userRes.rows[0];

      await notifyAdminsForTicketEvent({
        organizationId,
        ticketId: id,
        subject: ticket.subject,
        message: `Ticket assigned to ${assignedUser.name}`,
        status: "info",
        metadata: {
          assigned_to: assigned_to,
          assigned_to_name: assignedUser.name,
          updated_by: userId,
        },
        req,
      });

      res.json({ ticket: result.rows[0] });
    } catch (err: any) {
      console.error("Assign ticket error:", err);
      res.status(500).json({ error: err.message || "Failed to assign ticket" });
    }
  },
);

// Delete a ticket
router.delete(
  "/tickets/:id",
  authenticateToken,
  requireOrganization,
  [param("id").isUUID().withMessage("Invalid ticket id")],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: 'tickets_manage',
          });
        }
      }

      const ticketRes = await query(
        "SELECT id, subject FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const _ticket = ticketRes.rows[0];

      // Delete the ticket (cascade will delete replies)
      await query("DELETE FROM support_tickets WHERE id = $1", [id]);

      res.json({ message: "Ticket deleted successfully", ticket_id: id });
    } catch (err: any) {
      console.error("Delete ticket error:", err);
      res.status(500).json({ error: err.message || "Failed to delete ticket" });
    }
  },
);

// Update a ticket reply
router.put(
  "/tickets/:id/replies/:replyId",
  authenticateToken,
  requireOrganization,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    param("replyId").isUUID().withMessage("Invalid reply id"),
    body("message").isLength({ min: 1 }).withMessage("Message is required"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id, replyId } = req.params;
      const { message } = req.body;
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          // Allow reply creator to update their own reply
          const replyRes = await query(
            "SELECT user_id FROM support_ticket_replies WHERE id = $1 AND ticket_id = $2",
            [replyId, id],
          );

          if (replyRes.rows.length === 0 || replyRes.rows[0].user_id !== userId) {
            return res.status(403).json({
              error: 'Insufficient permissions to update this reply',
              required: 'tickets_manage',
            });
          }
        }
      }

      // Verify ticket belongs to organization
      const ticketRes = await query(
        "SELECT id, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const ticket = ticketRes.rows[0];

      // Update the reply
      const result = await query(
        "UPDATE support_ticket_replies SET message = $1 WHERE id = $2 AND ticket_id = $3 RETURNING *",
        [message, replyId, id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Reply not found" });
        return;
      }

      await notifyAdminsForTicketEvent({
        organizationId,
        ticketId: id,
        subject: ticket.subject,
        message: `Reply updated on ticket: "${ticket.subject}"`,
        status: "info",
        metadata: {
          reply_id: replyId,
          updated_by: userId,
        },
        req,
      });

      res.json({ reply: result.rows[0] });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.status(400).json({
          error: "support_ticket_replies table not found. Apply migrations before updating replies.",
        });
      }
      console.error("Update reply error:", err);
      res.status(500).json({ error: err.message || "Failed to update reply" });
    }
  },
);

// Delete a ticket reply
router.delete(
  "/tickets/:id/replies/:replyId",
  authenticateToken,
  requireOrganization,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    param("replyId").isUUID().withMessage("Invalid reply id"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id, replyId } = req.params;
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userId = user.id;
      const userRole = user.role;

      // Check tickets_manage permission for non-admin users
      if (userRole !== 'admin') {
        const hasTicketsManagePermission = await RoleService.checkPermission(
          userId,
          organizationId,
          'tickets_manage'
        );

        if (!hasTicketsManagePermission) {
          // Allow reply creator to delete their own reply
          const replyRes = await query(
            "SELECT user_id FROM support_ticket_replies WHERE id = $1 AND ticket_id = $2",
            [replyId, id],
          );

          if (replyRes.rows.length === 0 || replyRes.rows[0].user_id !== userId) {
            return res.status(403).json({
              error: 'Insufficient permissions to delete this reply',
              required: 'tickets_manage',
            });
          }
        }
      }

      // Verify ticket belongs to organization
      const ticketRes = await query(
        "SELECT id, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const ticket = ticketRes.rows[0];

      // Delete the reply
      const result = await query(
        "DELETE FROM support_ticket_replies WHERE id = $1 AND ticket_id = $2 RETURNING *",
        [replyId, id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Reply not found" });
        return;
      }

      await notifyAdminsForTicketEvent({
        organizationId,
        ticketId: id,
        subject: ticket.subject,
        message: `Reply deleted from ticket: "${ticket.subject}"`,
        status: "warning",
        metadata: {
          reply_id: replyId,
          deleted_by: userId,
        },
        req,
      });

      res.json({ message: "Reply deleted successfully", reply_id: replyId });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.status(400).json({
          error: "support_ticket_replies table not found. Apply migrations before deleting replies.",
        });
      }
      console.error("Delete reply error:", err);
      res.status(500).json({ error: err.message || "Failed to delete reply" });
    }
  },
);

// Request ticket reopen (organization scoped, user request)
router.post(
  "/tickets/:id/reopen-request",
  authenticateToken,
  requireOrganization,
  [
    param("id").isUUID().withMessage("Invalid ticket id"),
    body("message")
      .optional()
      .isString()
      .isLength({ max: 2000 })
      .withMessage("Message must be at most 2000 characters"),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { id } = req.params;
      const { message } = req.body as { message?: string };
      const organizationId = (req as any).user.organizationId;
      const userId = (req as any).user.id;

      const ticketRes = await query(
        "SELECT id, status, subject, organization_id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
      if (ticketRes.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const ticket = ticketRes.rows[0];
      if (ticket.status !== "closed") {
        res.status(400).json({ error: "Only closed tickets can be reopened." });
        return;
      }

      const recentRequestRes = await query(
        `SELECT created_at
           FROM support_ticket_replies
          WHERE ticket_id = $1
            AND user_id = $2
            AND is_staff_reply = FALSE
            AND message LIKE $3
          ORDER BY created_at DESC
          LIMIT 1`,
        [id, userId, `${REOPEN_REQUEST_PREFIX}%`],
      );

      if (recentRequestRes.rows.length > 0) {
        const lastRequestedAt = new Date(
          recentRequestRes.rows[0].created_at,
        ).getTime();
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - lastRequestedAt < fiveMinutes) {
          res.status(429).json({
            error:
              "A reopen request was already sent recently. Please wait a few minutes before trying again.",
          });
          return;
        }
      }

      const requestedMessage =
        typeof message === "string" ? message.trim() : "";
      const reopenMessage =
        requestedMessage.length > 0
          ? `${REOPEN_REQUEST_PREFIX} Customer requested this closed ticket to be reopened.\n\nCustomer note:\n${requestedMessage}`
          : `${REOPEN_REQUEST_PREFIX} Customer requested this closed ticket to be reopened.`;
      const now = new Date().toISOString();

      const insertRes = await query(
        `INSERT INTO support_ticket_replies (ticket_id, user_id, message, is_staff_reply, created_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, userId, reopenMessage, false, now],
      );

      if (insertRes.rows.length === 0) {
        throw new Error("Failed to submit reopen request");
      }

      await query("UPDATE support_tickets SET updated_at = $1 WHERE id = $2", [
        now,
        id,
      ]);

      await notifyAdminsForTicketEvent({
        organizationId: ticket.organization_id,
        ticketId: id,
        subject: ticket.subject,
        message: `Reopen requested for ticket: "${ticket.subject}"`,
        status: "warning",
        metadata: {
          is_reopen_request: true,
          requested_by: userId,
          note_preview: requestedMessage.substring(0, 100),
        },
        req,
      });

      const replyRow = insertRes.rows[0];
      const userRes = await query(
        "SELECT name, email FROM users WHERE id = $1",
        [userId],
      );
      const senderName =
        userRes.rows[0]?.name || userRes.rows[0]?.email || "Unknown";

      res.status(201).json({
        message: "Reopen request submitted",
        reply: {
          id: replyRow.id,
          ticket_id: replyRow.ticket_id,
          message: replyRow.message,
          created_at: replyRow.created_at,
          sender_type: "user",
          sender_name: senderName,
        },
      });
    } catch (err: any) {
      if (isMissingTableError(err)) {
        return res.status(400).json({
          error:
            "support_ticket_replies table not found. Apply migrations before requesting a reopen.",
        });
      }
      console.error("Ticket reopen request error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to request ticket reopen" });
    }
  },
);

// Stream real-time updates for a specific ticket (SSE)
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

      // For SSE, we need to get token from query param since EventSource doesn't support headers
      const token = req.query.token as string;
      if (!token) {
        res.status(401).json({ error: "Authentication token required" });
        return;
      }

      // Validate token manually (similar to notification stream)
      const jwt = await import("jsonwebtoken");
      const { config } = await import("../config/index.js");

      let decoded: { userId: string; organizationId?: string };
      try {
        decoded = jwt.default.verify(token, config.JWT_SECRET) as {
          userId: string;
          organizationId?: string;
        };
      } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      let organizationId = decoded.organizationId;
      if (!organizationId) {
        // Fallback lookup if not in token
        try {
          const orgResult = await query(
            "SELECT organization_id FROM organization_members WHERE user_id = $1",
            [decoded.userId],
          );
          organizationId = orgResult.rows[0]?.organization_id;

          if (!organizationId) {
            const ownerOrg = await query(
              "SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1",
              [decoded.userId],
            );
            organizationId = ownerOrg.rows[0]?.id;
          }
        } catch (err) {
          console.warn("Organization lookup failed for stream:", err);
        }
      }

      if (!organizationId) {
        res.status(403).json({ error: "Organization data not found" });
        return;
      }

      // Verify ticket belongs to user's organization
      const ticketCheck = await query(
        "SELECT id FROM support_tickets WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );

      if (ticketCheck.rows.length === 0) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      // Send initial connection success
      res.write('data: {"type":"connected"}\n\n');

      // Create PostgreSQL client for LISTEN
      const client = await pool.connect();
      const channelName = `ticket_${id}`;

      await client.query(`LISTEN "${channelName}"`);

      // Handle notifications
      const notificationHandler = (msg: {
        channel: string;
        payload?: string;
      }) => {
        if (msg.channel === channelName && msg.payload) {
          res.write(`data: ${msg.payload}\n\n`);
        }
      };

      client.on("notification", notificationHandler);

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, 30000);

      // Cleanup on client disconnect
      req.on("close", async () => {
        clearInterval(heartbeat);
        client.removeListener("notification", notificationHandler);
        await client.query(`UNLISTEN "${channelName}"`);
        client.release();
        res.end();
      });
    } catch (err: unknown) {
      console.error("Ticket stream error:", err);
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
