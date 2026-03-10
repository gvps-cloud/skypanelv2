# Email Template System Spec

## Why
Currently, emails (Welcome, Invitation, Password Reset, Contact Form, etc.) are hardcoded in the backend code. This makes it impossible for admins to modify the content or design (HTML theming) without deploying code changes. The contact form email specifically lacks proper formatting and theming.

## What Changes
-   **Database**:
    -   New table `email_templates` to store template definitions (Subject, HTML body, Text body).
    -   Seed data with existing hardcoded templates converted to Handlebars format.
-   **Backend**:
    -   New `EmailTemplateService` to fetch and render templates using `handlebars`.
    -   Update `emailService.ts` and `contact.ts` to use this new service.
    -   New Admin API endpoints (`/api/admin/email-templates`) for CRUD operations.
-   **Frontend**:
    -   New Admin Page: `Email Templates` to list and edit templates.
    -   Editor supports editing Subject, HTML, and Text content.
    -   Display available variables for each template.

## Impact
-   **Affected specs**: None directly, but enhances Admin capabilities.
-   **Affected code**:
    -   `api/services/emailService.ts` (Heavy refactoring)
    -   `api/routes/contact.ts` (Refactoring)
    -   New `api/routes/admin/emailTemplates.ts`
    -   New `src/pages/admin/EmailTemplates.tsx`
    -   New `src/pages/admin/EmailTemplateEditor.tsx`

## ADDED Requirements
### Requirement: Email Template Management
The system SHALL allow Admins to:
-   View a list of all system email templates.
-   Edit the Subject, HTML Body, and Text Body of any template.
-   Reset a template to its system default (optional, but recommended).
-   See which variables are available for substitution in each template (e.g., `{{name}}`, `{{resetLink}}`).

### Requirement: Dynamic Email Rendering
The system SHALL:
-   Use `handlebars` to render email content with dynamic data.
-   Fall back to a file-based or code-based default if a database template is missing or corrupted.
-   Support a global layout/wrapper for HTML emails (header/footer branding).

## MODIFIED Requirements
### Requirement: Contact Form Email
The system SHALL use the `contact_form` template from the database instead of hardcoded strings.
**Migration**: The existing hardcoded logic in `api/routes/contact.ts` will be moved to the `contact_form` template in the database.

### Requirement: System Emails (Welcome, Invite, etc.)
The system SHALL use their respective templates (`welcome`, `invitation`, `password_reset`, etc.) from the database.
