# SkyPanelV2 API Context for Gemini

## Project Overview
The `api/` directory contains the backend application for SkyPanelV2, a cloud service billing panel. It exposes a RESTful API used by the frontend (React) and manages core business logic, including VPS provisioning (via Linode), billing, and user authentication.

### Tech Stack
*   **Runtime:** Node.js 20+ (ES Modules)
*   **Framework:** Express 4.21
*   **Language:** TypeScript
*   **Database:** PostgreSQL (accessed via `pg` driver and `DATABASE_URL`)
*   **VPS Provider:** Linode (via `services/providers/LinodeProviderService.ts`)
*   **Authentication:** JWT (JSON Web Tokens)
*   **Real-time:** WebSocket SSH Bridge (`services/sshBridge.ts`)

## Key Files & Entry Points

*   **`server.ts`**: Main entry point for local development. Starts the HTTP server, SSH bridge, and billing scheduler.
*   **`app.ts`**: Express application setup. Configures middleware (Helmet, CORS, Rate Limiting), routes, and error handling.
*   **`config/index.ts`**: Central configuration module. Validates environment variables (`.env`) and provides typed config objects.
*   **`routes/`**: API route definitions.
    *   `routes/admin/`: Admin-only endpoints (platform settings).
    *   `routes/vps.ts`: VPS instance management.
    *   `routes/payments.ts` & `invoices.ts`: Billing and payment handling.
*   **`services/`**: Business logic layer.
    *   `services/providers/`: Provider abstraction layer (currently Linode-focused).
    *   `services/billingService.ts`: Hourly billing logic.
    *   `services/sshBridge.ts`: WebSocket-based SSH terminal handling.

## Configuration

Configuration is loaded from environment variables (managed by `dotenv` in non-Docker environments). Key variables include:

*   **Database:** `DATABASE_URL` (PostgreSQL connection string)
*   **Auth:** `JWT_SECRET`, `JWT_EXPIRES_IN`
*   **Providers:** `LINODE_API_TOKEN`, `SSH_CRED_SECRET` (for encrypting keys)
*   **Billing:** `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
*   **Rate Limiting:** `RATE_LIMIT_ANONYMOUS_MAX`, `RATE_LIMIT_AUTHENTICATED_MAX`, etc.

## Development Conventions

*   **Architecture:** Service-Repository pattern (loosely). Routes delegate to Services. Services handle logic and DB interaction.
*   **Error Handling:** Centralized error handler in `app.ts`. Services should throw errors to be caught by the wrapper or middleware.
*   **Types:** Strict TypeScript. Interfaces for Request/Response bodies should be defined.
*   **Async/Await:** All I/O operations (DB, API calls) must be asynchronous.
*   **Validation:** Zod is used for input validation (implied by context, though explicit usage in `lib/validation.ts` should be checked).

## Directory Structure

*   `api/`
    *   `config/`: Env var parsing and validation.
    *   `lib/`: Shared utilities (Crypto, DB helpers, Validation).
    *   `middleware/`: Express middleware (Auth, Rate Limiting).
    *   `routes/`: API endpoint definitions.
    *   `services/`: Core business logic.
    *   `migrations/`: Database schema changes (usually in parent, but referenced here).

## Common Tasks

*   **Adding a Route:** Create a file in `routes/`, import it in `app.ts`.
*   **Adding a Service:** Create a class in `services/`, implement static or instance methods.
*   **Database Access:** Use the `db` client from `lib/database.ts` (inferred).
*   **Running Locally:** `npm run dev` (from parent) or direct execution via `tsx server.ts` (if configured).
