/**
 * Authentication API routes
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from "express";
import { body, validationResult } from "express-validator";
import { AuthService } from "../services/authService.js";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogger.js";
import { query } from "../lib/database.js";
import { mergeNotificationPreferences } from "../services/userNotificationPreferences.js";

const router = Router();

/**
 * User Registration
 * POST /api/auth/register
 */
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("firstName")
      .trim()
      .isLength({ min: 1 })
      .withMessage("First name is required"),
    body("lastName")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Last name is required"),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password, firstName, lastName } = req.body;

      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
      });

      res.status(201).json({
        message: "User registered successfully",
        user: result.user,
        token: result.token,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * User Login
 * POST /api/auth/login
 */
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
    body("code").optional().isString().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, password, code } = req.body;

      const result = await AuthService.login({ email, password, code });

      if ("require2fa" in result && result.require2fa) {
        res.json({ require2fa: true });
        return;
      }

      // unexpected case or type narrowing
      if (!("user" in result) || !("token" in result)) {
        throw new Error("Unexpected login response");
      }

      const loginResult = result as { user: any; token: string };

      // Log successful login
      try {
        await logActivity(
          {
            userId: loginResult.user.id,
            eventType: "auth.login",
            entityType: "user",
            entityId: loginResult.user.id,
            message: `User ${loginResult.user.email} logged in`,
            status: "success",
            metadata: { email },
          },
          req,
        );
      } catch {}

      res.json({
        message: "Login successful",
        user: loginResult.user,
        token: loginResult.token,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(401).json({ error: error.message });
    }
  },
);

router.post(
  "/verify-password",
  authenticateToken,
  [body("password").isString().notEmpty().withMessage("Password is required")],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { password } = req.body as { password: string };
      const isValid = await AuthService.verifyPassword(req.user.id, password);

      if (!isValid) {
        res.status(401).json({ error: "Incorrect password" });
        return;
      }

      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Password verification error:", error);
      res.status(500).json({ error: "Failed to verify password" });
    }
  },
);

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post(
  "/logout",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // In a stateless JWT system, logout is handled client-side by removing the token
      // For enhanced security, you could maintain a blacklist of tokens
      if (req.user) {
        try {
          await logActivity(
            {
              userId: req.user.id,
              eventType: "auth.logout",
              entityType: "user",
              entityId: req.user.id,
              message: `User ${req.user.email} logged out`,
              status: "success",
            },
            req as any,
          );
        } catch {}
      }
      res.json({ message: "Logout successful" });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  },
);

/**
 * Verify Email
 * POST /api/auth/verify-email
 */
router.post(
  "/verify-email",
  [body("token").notEmpty().withMessage("Verification token is required")],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { token } = req.body;
      const result = await AuthService.verifyEmail(token);

      res.json(result);
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * Request Password Reset
 * POST /api/auth/forgot-password
 */
router.post(
  "/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email } = req.body;
      const result = await AuthService.requestPasswordReset(email);

      res.json(result);
    } catch (error: any) {
      console.error("Password reset request error:", error);
      res
        .status(500)
        .json({ error: "Failed to process password reset request" });
    }
  },
);

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
router.post(
  "/reset-password",
  [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("token").notEmpty().withMessage("Reset token is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email, token, password } = req.body;
      const result = await AuthService.resetPassword(email, token, password);

      res.json(result);
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(400).json({ error: error.message });
    }
  },
);

/**
 * Refresh Token
 * POST /api/auth/refresh
 */
router.post(
  "/refresh",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const result = await AuthService.refreshToken(req.user.id);

      res.json(result);
    } catch (error: any) {
      console.error("Token refresh error:", error);
      res.status(401).json({ error: error.message });
    }
  },
);

/**
 * Get Current User
 * GET /api/auth/me
 */
router.get(
  "/me",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      res.json({ user: req.user });
    } catch (error: any) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user information" });
    }
  },
);

/**
 * Debug endpoint to test database connectivity
 * GET /api/auth/debug/user
 */
router.get(
  "/debug/user",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Test basic user lookup
      const userResult = await query("SELECT * FROM users WHERE id = $1", [
        req.user.id,
      ]);

      // Test table structure
      const tableResult = await query(
        `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'users' AND table_schema = 'public'`,
      );

      res.json({
        user: userResult.rows[0] || null,
        userFound: userResult.rows.length > 0,
        tableStructure: tableResult.rows,
        requestUserId: req.user.id,
      });
    } catch (error) {
      console.error("Debug endpoint error:", error);
      res.status(500).json({ error: "Debug failed", details: error });
    }
  },
);

/**
 * Update Current User Profile (extended)
 * PUT /api/auth/profile
 */
router.put(
  "/profile",
  authenticateToken,
  [
    body("firstName").optional().isString().trim().isLength({ min: 1 }),
    body("lastName").optional().isString().trim().isLength({ min: 1 }),
    body("phone").optional().isString().trim(),
    body("timezone").optional().isString().trim(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { firstName, lastName, phone, timezone } = req.body as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        timezone?: string;
      };

      // Fetch current user to derive existing name parts
      const currentResult = await query(
        "SELECT id, email, role, name, phone, timezone FROM users WHERE id = $1",
        [req.user.id],
      );

      if (currentResult.rows.length === 0) {
        console.error("Profile update - User lookup failed:", {
          userId: req.user.id,
          userExists: false,
        });
        res.status(404).json({
          error: "User not found",
          details: "User does not exist in database",
        });
        return;
      }

      const current = currentResult.rows[0];
      const existingFirst = (current.name || "").split(" ")[0] || "";
      const existingLast = (current.name || "").split(" ").slice(1).join(" ");
      const newFirst =
        typeof firstName !== "undefined" ? firstName : existingFirst;
      const newLast = typeof lastName !== "undefined" ? lastName : existingLast;
      const newName = `${newFirst} ${newLast}`.trim();

      // Build update query dynamically
      const updateFields = ["name = $2", "updated_at = $3"];
      const updateValues = [req.user.id, newName, new Date().toISOString()];
      let paramIndex = 4;

      if (typeof phone !== "undefined") {
        updateFields.push(`phone = $${paramIndex}`);
        updateValues.push(phone);
        paramIndex++;
      }
      if (typeof timezone !== "undefined") {
        updateFields.push(`timezone = $${paramIndex}`);
        updateValues.push(timezone);
        paramIndex++;
      }

      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(", ")}
        WHERE id = $1
        RETURNING id, email, role, name, phone, timezone, preferences, two_factor_enabled
      `;

      const updateResult = await query(updateQuery, updateValues);

      if (updateResult.rows.length === 0) {
        res.status(500).json({ error: "Failed to update profile" });
        return;
      }

      const updated = updateResult.rows[0];

      res.json({
        user: {
          id: updated.id,
          email: updated.email,
          firstName: newFirst,
          lastName: newLast,
          phone: updated.phone,
          timezone: updated.timezone,
          role: updated.role,
          emailVerified: true,
          preferences: updated.preferences,
          twoFactorEnabled: updated.two_factor_enabled,
        },
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update profile" });
    }
  },
);

/**
 * Change Password
 * PUT /api/auth/password
 */
router.put(
  "/password",
  authenticateToken,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters"),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password using AuthService
      try {
        await AuthService.login({
          email: req.user.email,
          password: currentPassword,
        });
      } catch {
        res.status(400).json({ error: "Current password is incorrect" });
        return;
      }

      // Update password
      await AuthService.changePassword(req.user.id, newPassword);

      try {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "auth.password_change",
            entityType: "user",
            entityId: req.user.id,
            message: "Your account password was changed successfully.",
            status: "warning",
          },
          req as any,
        );
      } catch {}

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Password change error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to change password" });
    }
  },
);

/**
 * Update Notification Preferences
 * PUT /api/auth/preferences
 */
router.put(
  "/preferences",
  authenticateToken,
  [
    body("notifications").optional().isObject(),
    body("security").optional().isObject(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { notifications, security } = req.body;

      // Get current preferences from PostgreSQL
      const currentRes = await query(
        "SELECT preferences FROM users WHERE id = $1",
        [req.user.id],
      );
      const currentPrefs = currentRes.rows[0]?.preferences || {};
      const updatedPrefs = mergeNotificationPreferences(
        currentPrefs,
        notifications,
      );

      if (
        security &&
        typeof security === "object" &&
        !Array.isArray(security)
      ) {
        updatedPrefs.security = {
          ...(currentPrefs.security || {}),
          ...(security as Record<string, unknown>),
        };
      }

      const prefUpdate = await query(
        "UPDATE users SET preferences = $1, updated_at = $2 WHERE id = $3 RETURNING id",
        [updatedPrefs, new Date().toISOString(), req.user.id],
      );
      if (prefUpdate.rowCount === 0) {
        res.status(500).json({ error: "Failed to update preferences" });
        return;
      }

      res.json({
        message: "Preferences updated successfully",
        preferences: updatedPrefs,
      });
    } catch (error: any) {
      console.error("Preferences update error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to update preferences" });
    }
  },
);

/**
 * Get User API Keys
 * GET /api/auth/api-keys
 */
router.get(
  "/api-keys",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const apiKeysRes = await query(
        `SELECT id,
              key_name AS name,
              key_prefix AS key_preview,
              created_at,
              last_used_at,
              expires_at,
              active
       FROM user_api_keys
       WHERE user_id = $1 AND active = TRUE
       ORDER BY created_at DESC`,
        [req.user.id],
      );
      res.json({ apiKeys: apiKeysRes.rows || [] });
    } catch (error: any) {
      console.error("API keys fetch error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to fetch API keys" });
    }
  },
);

/**
 * Generate New API Key
 * POST /api/auth/api-keys
 */
router.post(
  "/api-keys",
  authenticateToken,
  [
    body("name")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("API key name is required"),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { name } = req.body;

      // Generate API key
      const apiKey = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const keyPrefix = apiKey.substring(0, 12) + "...";

      // Hash the key for storage (in production, use proper hashing)
      const keyHash = Buffer.from(apiKey).toString("base64");

      // Introspect schema to handle legacy 'name' column vs new 'key_name'
      const columnsCheck = await query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'user_api_keys'
           AND column_name IN ('name', 'key_name')`,
      );
      const colNames: string[] = (columnsCheck.rows || []).map(
        (r: any) => r.column_name,
      );
      const hasLegacyName = colNames.includes("name");
      const hasKeyName = colNames.includes("key_name");

      const baseCols = [
        "user_id",
        "key_hash",
        "key_prefix",
        "created_at",
        "active",
      ];
      const baseVals = [
        req.user.id,
        keyHash,
        keyPrefix,
        new Date().toISOString(),
        true,
      ];
      let insertCols = [...baseCols];
      let insertVals = [...baseVals];

      if (hasLegacyName && hasKeyName) {
        insertCols = [
          "user_id",
          "name",
          "key_name",
          "key_hash",
          "key_prefix",
          "created_at",
          "active",
        ];
        insertVals = [
          req.user.id,
          name,
          name,
          keyHash,
          keyPrefix,
          new Date().toISOString(),
          true,
        ];
      } else if (hasLegacyName && !hasKeyName) {
        insertCols = [
          "user_id",
          "name",
          "key_hash",
          "key_prefix",
          "created_at",
          "active",
        ];
        insertVals = [
          req.user.id,
          name,
          keyHash,
          keyPrefix,
          new Date().toISOString(),
          true,
        ];
      } else {
        // Default to modern schema with key_name
        insertCols = [
          "user_id",
          "key_name",
          "key_hash",
          "key_prefix",
          "created_at",
          "active",
        ];
        insertVals = [
          req.user.id,
          name,
          keyHash,
          keyPrefix,
          new Date().toISOString(),
          true,
        ];
      }

      const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(", ");
      const insertSQL = `INSERT INTO user_api_keys (${insertCols.join(", ")})
                         VALUES (${placeholders})
                         RETURNING id,
                                   key_name AS name,
                                   key_prefix AS key_preview,
                                   created_at`;

      const insertRes = await query(insertSQL, insertVals);
      if (insertRes.rows.length === 0) {
        res.status(500).json({ error: "Failed to create API key" });
        return;
      }

      const newKey = insertRes.rows[0];
      // Log API key creation
      try {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId,
            eventType: "api_key.create",
            entityType: "api_key",
            entityId: newKey.id,
            message: `Created API key '${newKey.name}'`,
            status: "success",
            metadata: { key_preview: newKey.key_preview },
          },
          req as any,
        );
      } catch {}
      res.status(201).json({
        message: "API key created successfully",
        apiKey: {
          ...newKey,
          key: apiKey,
        },
      });
    } catch (error: any) {
      console.error("API key creation error:", error);
      // Provide clearer errors for common schema issues
      const msg = (error?.message || "").toLowerCase();
      if (
        msg.includes("null value in column") &&
        msg.includes("violates not-null constraint")
      ) {
        res.status(500).json({
          error:
            "Database schema mismatch detected for user_api_keys. Please apply migrations or run scripts to update the table.",
          details: error.message,
        });
        return;
      }
      if (msg.includes("relation") && msg.includes("does not exist")) {
        res.status(500).json({
          error:
            "user_api_keys table is missing. Apply migrations or run fix-schema script.",
          details: error.message,
        });
        return;
      }
      res
        .status(500)
        .json({ error: error.message || "Failed to create API key" });
    }
  },
);

/**
 * Revoke API Key
 * DELETE /api/auth/api-keys/:id
 */
router.delete(
  "/api-keys/:id",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { id } = req.params;

      const revokeRes = await query(
        "UPDATE user_api_keys SET active = FALSE, updated_at = $1 WHERE id = $2 AND user_id = $3",
        [new Date().toISOString(), id, req.user.id],
      );
      if (revokeRes.rowCount === 0) {
        res.status(404).json({ error: "API key not found" });
        return;
      }
      // Log API key revocation
      try {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId,
            eventType: "api_key.revoke",
            entityType: "api_key",
            entityId: id,
            message: `Revoked API key '${id}'`,
            status: "success",
          },
          req as any,
        );
      } catch {}
      res.json({ message: "API key revoked successfully" });
    } catch (error: any) {
      console.error("API key revocation error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to revoke API key" });
    }
  },
);

/**
 * Setup 2FA
 * POST /api/auth/2fa/setup
 */
router.post(
  "/2fa/setup",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { secret, qrCode } = await AuthService.setup2FA(req.user.id);

      res.json({
        secret, // In a real app, maybe don't send secret if not needed, but needed for manual entry
        qrCode,
      });
    } catch (error: any) {
      console.error("2FA setup error:", error);
      res.status(500).json({ error: error.message || "Failed to setup 2FA" });
    }
  },
);

/**
 * Verify 2FA Setup
 * POST /api/auth/2fa/verify
 */
router.post(
  "/2fa/verify",
  authenticateToken,
  [body("token").isString().isLength({ min: 6 })],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { token } = req.body;
      await AuthService.verify2FASetup(req.user.id, token);

      try {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "auth.2fa.enabled",
            entityType: "user",
            entityId: req.user.id,
            message: "Two-factor authentication was enabled for your account.",
            status: "warning",
          },
          req as any,
        );
      } catch {}

      res.json({ message: "2FA enabled successfully" });
    } catch (error: any) {
      console.error("2FA verification error:", error);
      res.status(400).json({ error: error.message || "Failed to verify 2FA" });
    }
  },
);

/**
 * Disable 2FA
 * POST /api/auth/2fa/disable
 */
router.post(
  "/2fa/disable",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      await AuthService.disable2FA(req.user.id);

      try {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: req.user.organizationId ?? null,
            eventType: "auth.2fa.disabled",
            entityType: "user",
            entityId: req.user.id,
            message: "Two-factor authentication was disabled for your account.",
            status: "warning",
          },
          req as any,
        );
      } catch {}

      res.json({ message: "2FA disabled successfully" });
    } catch (error: any) {
      console.error("2FA disable error:", error);
      res.status(500).json({ error: error.message || "Failed to disable 2FA" });
    }
  },
);

export default router;
