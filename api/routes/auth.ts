/**
 * Authentication API routes
 * Handle user registration, login, token management, etc.
 */
import { Router, type CookieOptions, type Request, type Response } from "express";
import { body, validationResult } from "express-validator";
import { AuthService } from "../services/authService.js";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogger.js";
import { query } from "../lib/database.js";
import { mergeNotificationPreferences } from "../services/userNotificationPreferences.js";
import { bruteForceProtectionService } from "../services/bruteForceProtectionService.js";
import { tokenBlacklistService } from "../services/tokenBlacklistService.js";
import { getClientIP } from "../lib/ipDetection.js";
import {
  apiKeyMutationRateLimiter,
  loginRateLimiter,
  passwordResetRateLimiter,
} from "../middleware/rateLimiting.js";
import { generateApiKey, hashApiKey } from "../lib/secureRandom.js";
import { toSafeErrorMessage } from "../lib/errorHandling.js";

const router = Router();
const AUTH_COOKIE_NAME = "auth_token";

function getAuthCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "lax" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

/**
 * User Registration
 * POST /api/auth/register
 */
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one digit")
      .matches(/[^a-zA-Z0-9]/)
      .withMessage("Password must contain at least one special character"),
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
      res.status(400).json({ error: toSafeErrorMessage(error, "Registration failed") });
    }
  },
);

/**
 * User Login
 * POST /api/auth/login
 */
router.post(
  "/login",
  loginRateLimiter, // Apply stricter rate limiting
  [
    body("email").isEmail().normalizeEmail({ gmail_remove_dots: false }),
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

      // Get client IP for brute force tracking
      const ipResult = getClientIP(req, {
        trustProxy: true, // Always trust proxy for security middleware
        enableLogging: false,
      });
      const clientIP = ipResult.ip;

      // Check if IP or email is locked out due to failed attempts
      const lockoutCheck = await bruteForceProtectionService.isLockedOut(clientIP, email);
      if (lockoutCheck.locked) {
        console.warn('Login blocked due to brute force lockout:', {
          ip: clientIP,
          email: email.toLowerCase(),
          reason: lockoutCheck.reason,
          retryAfter: lockoutCheck.retryAfter
        });

        res.status(429).json({
          error: 'Account temporarily locked',
          message: lockoutCheck.reason,
          retryAfter: lockoutCheck.retryAfter
        });
        return;
      }

      try {
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

        // Reset failed attempts on successful login
        await bruteForceProtectionService.resetAttempts(clientIP, email);

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
              metadata: {
                email,
                ip: clientIP
              },
            },
            req,
          );
        } catch (logError) {
          console.error('Failed to log login activity:', logError);
        }

        res.cookie(AUTH_COOKIE_NAME, loginResult.token, getAuthCookieOptions());
        res.json({
          message: "Login successful",
          user: loginResult.user,
          token: loginResult.token,
        });
      } catch (loginError: any) {
        // Track failed attempt for brute force protection
        await bruteForceProtectionService.trackFailedAttempt(clientIP, email);

        // Don't reveal whether email exists (security best practice)
        const errorMessage = loginError.message.includes('Invalid email or password')
          ? 'Invalid email or password'
          : loginError.message;

        res.status(401).json({ error: errorMessage });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "An unexpected error occurred during login" });
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
      if (req.user) {
        // Extract token from Authorization header or cookie
        let token: string | null = null;

        const authHeader = req.headers['authorization'];
        if (authHeader) {
          const parts = authHeader.split(' ');
          if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
          }
        }

        // Fallback to cookie
        if (!token && req.cookies && req.cookies.auth_token) {
          token = req.cookies.auth_token;
        }

        // Blacklist the token to prevent reuse
        if (token) {
          try {
            await tokenBlacklistService.add(token, req.user.id);
            console.log('Token blacklisted on logout:', {
              userId: req.user.id,
              email: req.user.email
            });
          } catch (blacklistError) {
            console.error('Failed to blacklist token:', blacklistError);
            // Continue with logout even if blacklisting fails
          }
        }

        // Log logout activity
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
        } catch (logError) {
          console.error('Failed to log logout activity:', logError);
        }
      }
      res.clearCookie(AUTH_COOKIE_NAME, {
        ...getAuthCookieOptions(),
        maxAge: undefined,
      });
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
  passwordResetRateLimiter, // Apply stricter rate limiting
  [body("email").isEmail().normalizeEmail({ gmail_remove_dots: false })],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { email } = req.body;

      // Get client IP for security logging
      const ipResult = getClientIP(req, {
        trustProxy: true,
        enableLogging: false,
      });
      const clientIP = ipResult.ip;

      // Log password reset request for security monitoring
      console.info('Password reset requested:', {
        email: email.toLowerCase(),
        ip: clientIP,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      await AuthService.requestPasswordReset(email);

      // Always return the same message regardless of whether email exists
      // This prevents email enumeration attacks
      res.json({
        message: "If an account exists with this email address, a password reset link has been sent."
      });
    } catch (error: any) {
      console.error("Password reset request error:", error);
      // Don't reveal specific errors to prevent enumeration
      res.status(500).json({
        error: "Failed to process password reset request",
        message: "An error occurred while processing your request. Please try again later."
      });
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
      .normalizeEmail({ gmail_remove_dots: false })
      .withMessage("Valid email is required"),
    body("token")
      .trim()
      .matches(/^\d{8}$/)
      .withMessage("Reset code must be exactly 8 digits"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/[0-9]/)
      .withMessage("Password must contain at least one digit")
      .matches(/[^a-zA-Z0-9]/)
      .withMessage("Password must contain at least one special character"),
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
      res.cookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());
      res.json(result);
    } catch (error: any) {
      console.error("Token refresh error:", error);
      res.status(401).json({ error: toSafeErrorMessage(error, "Token refresh failed") });
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

      // Issue a fresh token so clients that authenticated via cookie can
      // populate their in-memory token state (needed for Bearer-header callers).
      const result = await AuthService.refreshToken(req.user.id);
      res.cookie(AUTH_COOKIE_NAME, result.token, getAuthCookieOptions());
      res.json({ user: result.user, token: result.token });
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
    if (process.env.NODE_ENV === "production") {
      res.status(404).json({ error: "Not found" });
      return;
    }

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
      .withMessage("New password must be at least 8 characters")
      .matches(/[A-Z]/)
      .withMessage("New password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("New password must contain at least one lowercase letter")
      .matches(/[0-9]/)
      .withMessage("New password must contain at least one digit")
      .matches(/[^a-zA-Z0-9]/)
      .withMessage("New password must contain at least one special character"),
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
  apiKeyMutationRateLimiter,
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

      // Generate API key using cryptographically secure random generation
      const apiKey = generateApiKey();
      const keyPrefix = apiKey.substring(0, 12) + "...";

      // Hash the key for secure storage
      const keyHash = hashApiKey(apiKey);

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
  apiKeyMutationRateLimiter,
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

/**
 * Switch Organization Context
 * POST /api/auth/switch-organization
 */
router.post(
  "/switch-organization",
  authenticateToken,
  [
    body("organizationId")
      .isUUID()
      .withMessage("Valid organization ID is required"),
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

      const { organizationId } = req.body;

      // Validate that the organization exists
      const orgResult = await query(
        "SELECT id FROM organizations WHERE id = $1",
        [organizationId]
      );

      if (orgResult.rows.length === 0) {
        res.status(404).json({ error: "Organization not found" });
        return;
      }

      // Validate that the user is a member of the organization
      const memberResult = await query(
        "SELECT organization_id FROM organization_members WHERE user_id = $1 AND organization_id = $2",
        [req.user.id, organizationId]
      );

      if (memberResult.rows.length === 0) {
        res.status(403).json({ 
          error: "You are not a member of this organization" 
        });
        return;
      }

      // Update the user's active_organization_id in the database
      const updateResult = await query(
        `UPDATE users 
         SET active_organization_id = $1, updated_at = $2 
         WHERE id = $3 
         RETURNING id, email, role, name, phone, timezone, preferences, two_factor_enabled AS "twoFactorEnabled", active_organization_id AS "activeOrganizationId"`,
        [organizationId, new Date().toISOString(), req.user.id]
      );

      if (updateResult.rows.length === 0) {
        res.status(500).json({ error: "Failed to update organization context" });
        return;
      }

      const updatedUser = updateResult.rows[0];

      // Get organization name for activity log
      const orgNameResult = await query(
        "SELECT name FROM organizations WHERE id = $1",
        [organizationId]
      );
      const orgName = orgNameResult.rows[0]?.name || "Unknown Organization";

      // Log the organization switch
      try {
        await logActivity(
          {
            userId: req.user.id,
            organizationId: organizationId,
            eventType: "organization.switch",
            entityType: "organization",
            entityId: organizationId,
            message: `Switched to ${orgName}`,
            status: "success",
          },
          req as any
        );
      } catch (logError) {
        console.error("Failed to log organization switch:", logError);
        // Continue even if logging fails
      }

      // Return updated user object with new organization context
      res.json({
        message: "Organization context switched successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.name ? updatedUser.name.split(' ')[0] || '' : '',
          lastName: updatedUser.name ? updatedUser.name.split(' ').slice(1).join(' ') || '' : '',
          role: updatedUser.role,
          phone: updatedUser.phone,
          timezone: updatedUser.timezone,
          organizationId: updatedUser.activeOrganizationId,
          preferences: updatedUser.preferences,
          twoFactorEnabled: updatedUser.twoFactorEnabled,
          emailVerified: true,
        },
      });
    } catch (error: any) {
      console.error("Switch organization error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to switch organization context" 
      });
    }
  }
);

export default router;

