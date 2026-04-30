/**
 * API Keys Router
 *
 * Main router for API key management endpoints.
 *
 * Endpoints:
 * - POST   /api/api-keys           - Create a new API key
 * - GET    /api/api-keys           - List user's API keys
 * - GET    /api/api-keys/:id       - Get specific API key details
 * - DELETE /api/api-keys/:id       - Delete (deactivate) an API key
 * - PATCH  /api/api-keys/:id       - Update an API key (reactivate/deactivate)
 *
 * All endpoints require JWT authentication (except when using X-API-Key header).
 * Row-level security (RLS) ensures users can only access their own keys.
 *
 * SECURITY NOTES:
 * - Full API keys are ONLY returned on creation (POST endpoint)
 * - List and detail endpoints only return key prefix (first 12 characters)
 * - Keys are stored as SHA-256 hashes, never in plaintext
 * - Soft delete: deleted keys are marked inactive but retained for audit
 * - Maximum 10 active API keys per user
 * - API keys can have granular permissions for different resources
 */

import { Router } from 'express';
import createRouter from './create.js';
import listRouter from './list.js';
import deleteRouter from './delete.js';

const router = Router();

// Mount route modules
router.use('/', createRouter);  // POST /api/api-keys
router.use('/', listRouter);    // GET /api/api-keys, GET /api/api-keys/:id
router.use('/', deleteRouter);  // DELETE /api/api-keys/:id, PATCH /api/api-keys/:id

export default router;
