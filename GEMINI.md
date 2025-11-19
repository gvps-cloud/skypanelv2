# SkyPanelV2 Project Overview

SkyPanelV2 is an open-source cloud service billing panel designed for cloud hosting businesses. It provides a white-label control plane, enabling service providers to offer VPS hosting services with integrated billing, customer management, and comprehensive administrative tools. The project emphasizes a modern UI/UX, robust security, and a developer-friendly experience.

## Technologies Used

*   **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query v5, Zustand, shadcn/ui components, React Router v7.
*   **Backend:** Node.js 20+, Express.js (ESM), TypeScript, PostgreSQL, Nodemailer, WebSockets (ssh2).
*   **Database:** PostgreSQL with `migrations/` for schema management.
*   **Integrations:** PayPal REST SDK, Linode/Akamai API, SMTP2GO, optional InfluxDB metrics.
*   **Testing:** Vitest (Unit Tests), React Testing Library (Component Tests), Supertest (API Integration Tests).

## Architecture

The project follows a full-stack architecture with a clear separation between the frontend and backend:

*   **Frontend (`src/`):** A React Single Page Application (SPA) built with Vite, handling user interfaces, state management (Zustand, TanStack Query), and routing.
*   **Backend (`api/`):** An Express.js application acting as a RESTful API, handling authentication, data management, billing logic, notifications, and integrations with external services. It also includes an SSH WebSocket bridge.
*   **Database:** PostgreSQL is used for data persistence, with migrations managed through SQL scripts.

Key features include comprehensive VPS management (Linode support, backup pricing, SSH console, monitoring), integrated billing (PayPal, invoicing, usage tracking), robust administration (user, organization, and platform management, role-based access, rate limiting, activity logging), white-label branding, and real-time features using WebSockets and PostgreSQL LISTEN/NOTIFY.

## Building and Running

### Prerequisites

*   Node.js 20+
*   npm 9+
*   PostgreSQL 12+
*   Optional: InfluxDB 2.x for metrics collection

### Getting Started

1.  **Clone and Install:**
    ```bash
    git clone https://github.com/skyvps360/skypanelv2
    cd skypanelv2
    npm install
    ```

2.  **Configure Environment:**
    *   Copy `.env.example` to `.env`.
    *   Generate `SSH_CRED_SECRET`: `node scripts/generate-ssh-secret.js`.
    *   Update `.env` with your `DATABASE_URL`, PayPal credentials, Linode API token, branding details, and SMTP settings.
    *   Refer to `repo-docs/ENVIRONMENT_VARIABLES.md` for a complete list.

3.  **Apply Database Migrations:**
    ```bash
    node scripts/run-migration.js
    ```
    To replay a specific file:
    ```bash
    node scripts/apply-single-migration.js migrations/001_initial_schema.sql
    ```

4.  **Start Development Servers:**
    ```bash
    npm run dev
    ```
    This concurrently starts:
    *   Frontend: Vite dev server at `http://localhost:5173`
    *   Backend: Express API at `http://localhost:3001` (with Nodemon for auto-restart)

    Individual servers can be started with `npm run client:dev` (frontend only) and `npm run server:dev` (backend only).

5.  **Seed Admin Access:**
    *   Default admin from migrations: `admin@skypanelv2.com` / `admin123`.
    *   Create manually: `node scripts/create-test-admin.js --email you@example.com --password changeme`

### Building & Testing

*   **Build for Production:** `npm run build`
*   **Run Tests:** `npm run test`
*   **Run Tests in Watch Mode:** `npm run test:watch`
*   **Lint Code:** `npm run lint`
*   **TypeScript Type Checking:** `npm run check`

## Development Conventions

*   **Code Style:** ESLint is used for code quality, and Prettier is likely integrated for formatting (though not explicitly in `package.json` scripts, it's a common practice in modern JS/TS projects).
*   **Type Safety:** TypeScript is used extensively, with strict checking enabled.
*   **Testing:** Comprehensive testing suite including unit, component, and API integration tests. Developers are encouraged to use `npm run test:watch` for TDD.
*   **State Management:** TanStack Query for server state, Zustand for client-side state, and React Context for global state like authentication and theme.
*   **API Communication:** All frontend API calls are routed through `src/lib/api.ts` for consistent authentication and error handling.
*   **Database Access:** Direct database operations are encapsulated in `api/lib/database.ts`.
*   **Validation:** A comprehensive form validation system is implemented in `src/lib/validation.ts` for real-time feedback and robust data integrity.

## Documentation

*   **API Documentation:** Located in `repo-docs/api-docs/` with detailed references for various endpoints, including admin and organization management.
*   **Configuration:** `repo-docs/ENVIRONMENT_VARIABLES.md` provides a complete reference for environment variables.
*   **Troubleshooting:** The `README.md` itself contains a detailed troubleshooting section for common development and integration issues.
*   **Contributing:** Standard GitHub workflow with forking, feature branches, and pull requests.
