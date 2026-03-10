# Tasks

- [x] Task 1: Backend Infrastructure & Migration
  - [x] Install `handlebars` dependency.
  - [x] Create migration for `email_templates` table.
  - [x] Create seed data/script to populate `email_templates` with existing hardcoded emails (converted to Handlebars format).
  - [x] Create `EmailTemplateService` class to handle template fetching and rendering with caching (optional) and fallback.

- [x] Task 2: Refactor Email Sending Logic
  - [x] Refactor `api/services/emailService.ts` to use `EmailTemplateService` for:
    - [x] Welcome Email
    - [x] Invitation Email
    - [x] Login Notification Email
    - [x] Password Reset Email
    - [x] Account Notification Email
  - [x] Refactor `api/routes/contact.ts` to use `EmailTemplateService` (via `emailService` or directly).

- [x] Task 3: Admin API for Templates
  - [x] Create `api/routes/admin/emailTemplates.ts`.
  - [x] Implement GET `/` (list).
  - [x] Implement GET `/:id` (detail).
  - [x] Implement PUT `/:id` (update).
  - [x] Implement POST `/preview` (render a preview with dummy data).
  - [x] Register new routes in `api/index.ts` (or `api/routes/admin/index.ts`).

- [x] Task 4: Frontend Admin UI
  - [x] Create `src/services/adminEmailTemplateService.ts` (frontend API client).
  - [x] Add "Email Templates" item to the Admin Sidebar.
  - [x] Create `src/pages/admin/EmailTemplates/List.tsx` (List view).
  - [x] Create `src/pages/admin/EmailTemplates/Edit.tsx` (Edit view with form).
    - [x] Include "Available Variables" cheat sheet in the editor.
    - [x] (Optional) Preview button using the preview API.

- [x] Task 5: Verification & Polish
  - [x] Verify Contact Form sends the templated email correctly.
  - [x] Verify Admin can update the template and changes take effect immediately.
