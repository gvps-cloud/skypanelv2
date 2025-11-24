# SkyPanelV2 Frontend Context

## Project Overview
This directory (`src/`) contains the frontend application for SkyPanelV2, a cloud hosting control panel. It is a **React 18** application built with **Vite** and **TypeScript**.

## Tech Stack
*   **Framework:** React 18
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Routing:** React Router (`react-router-dom`)
*   **State Management:**
    *   **Server State:** TanStack Query (`@tanstack/react-query`)
    *   **Client State:** Context API (Auth, Theme, Impersonation) & Zustand (inferred)
*   **Styling:** Tailwind CSS + shadcn/ui components
*   **Forms:** React Hook Form (inferred from usage patterns) + Zod validation

## Key Directories

*   **`components/`**: Reusable UI components.
    *   **`ui/`**: Low-level atomic components (buttons, inputs, cards) based on shadcn/ui.
    *   **`admin/`**: Admin-specific components (user management, system settings).
    *   **`VPS/`**: Components specific to VPS management.
    *   **`layouts/`**: Layout wrapper components (`AppLayout`, `PublicLayout`).
*   **`pages/`**: Route components representing full pages.
    *   **`Dashboard.tsx`**: Main user dashboard.
    *   **`VPS.tsx`** & **`VPSDetail.tsx`**: Virtual Private Server management.
    *   **`Admin.tsx`**: Administration hub.
*   **`lib/`**: Core utilities and business logic.
    *   **`api.ts`**: **CRITICAL**. Handles all communication with the backend API. Contains types for API responses.
    *   **`utils.ts`**: General helper functions (CN class merging, etc.).
*   **`contexts/`**: React Context providers.
    *   **`AuthContext.tsx`**: Authentication state (user, login, logout).
    *   **`ImpersonationContext.tsx`**: Logic for admins to view the app as a specific user.
*   **`types/`**: TypeScript type definitions.
    *   **`vps.ts`**: Core domain models for VPS instances (`VPSInstance`, `CreateVPSForm`).

## Core Workflows

### 1. Routing
Routes are defined in **`App.tsx`**.
*   **Public Routes:** Login, Register, Home (wrapped in `PublicRoute`).
*   **Protected Routes:** Dashboard, VPS, Settings (wrapped in `ProtectedRoute`).
*   **Admin Routes:** Admin panel (wrapped in `AdminRoute`).

### 2. API Communication
All API calls should generally go through **`src/lib/api.ts`** or custom hooks utilizing `useQuery` / `useMutation`.
*   Base URL is determined by `VITE_API_URL` environment variable, defaulting to `/api`.

### 3. VPS Management
The frontend enables users to:
*   **List Instances:** via `VPS.tsx` (fetching list from API).
*   **Create Instances:** via `CreateVPSForm` type and associated forms.
*   **Manage Instance:** via `VPSDetail.tsx` (start, stop, reboot, view stats).

## Development
*   **Run Dev Server:** `npm run dev` (starts Vite on port 5173).
*   **Build:** `npm run build` (outputs to `dist/`).
*   **Type Check:** `npm run check` (runs `tsc`).
