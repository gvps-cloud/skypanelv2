# Fix Organization Invitation Email Issues

## Why
Users report that organization invitation emails are not sending. While the email service seems functional in isolation, failures during invitation creation are silently caught, leaving users unaware of the issue. Additionally, the fallback mechanism (Resend -> SMTP) relies on correct configuration which may be inconsistent between documentation (`SMTP2GO_` vars) and application code (`SMTP_` vars).

## What Changes
- **Backend API**:
    - Modify `InvitationService.createInvitation` to return email sending status and error details.
    - Update `POST /api/organizations/:id/members/invite` to include this status in the response.
    - Enhance `emailService.ts` logging to clearly indicate which provider failed and why.
    - Export `sendEmail` from `emailService.ts` for better testing and utility.
- **Scripts**:
    - Update `scripts/test-smtp.js` to use the application's `config` module, ensuring it tests the actual runtime configuration.
- **Documentation**:
    - Update `CLAUDE.md` and `.env.example` to standardize on `SMTP_` environment variables, removing confusion about `SMTP2GO_` specific variables.

## Impact
- **Affected Specs**: `org-invitation-and-role-management`
- **Affected Code**:
    - `api/services/invitations.ts`
    - `api/routes/organizations.ts`
    - `api/services/emailService.ts`
    - `scripts/test-smtp.js`
    - `CLAUDE.md`
    - `.env.example`

## MODIFIED Requirements
### Requirement: Invitation Creation
The system SHALL create an invitation and attempt to send an email.
- **IF** email sending fails:
    - The system SHALL still create the invitation.
    - The system SHALL return a warning indicating the email failed.
    - The system SHALL return the specific error message from the email provider(s) to the admin (if applicable) or log it.
    - The system SHALL return the invitation link in the response so the inviter can share it manually.

### Requirement: Email Configuration Testing
The `test-smtp.js` script SHALL use the same configuration logic as the application to ensure valid testing of the production setup.
