# Tasks

- [x] Task 1: Enhance `InvitationService` to report email failures
    - [x] Modify `InvitationService.createInvitation` signature to return `{ invitation: Invitation, emailSent: boolean, emailError?: string }`
    - [x] Update `POST /api/organizations/:id/members/invite` route handler to pass this information to the client
- [x] Task 2: Update Email Service and Logging
    - [x] Export `sendEmail` in `api/services/emailService.ts`
    - [x] Ensure `attemptProvider` logs detailed errors for each provider attempt
- [x] Task 3: Standardize Configuration and Scripts
    - [x] Rewrite `scripts/test-smtp.js` to import `config` from `api/config/index.ts` and use `sendEmail` (or `sendViaSmtp` if testing specifically SMTP)
    - [x] Update `.env.example` to use `SMTP_HOST`, `SMTP_PORT`, etc., instead of `SMTP2GO_`
    - [x] Update `CLAUDE.md` to reflect standard SMTP variables
- [x] Task 4: Frontend Notification (Optional but recommended)
    - [x] Verify if frontend displays the warning (if API response changes structure, ensure frontend handles it gracefully) - *Note: Keeping this minimal as we are focused on backend fix first.*
