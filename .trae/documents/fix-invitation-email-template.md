# Fix Organization Invitation Email Template Name

## Problem
The `sendInvitationEmail` function in `api/services/emailService.ts` is trying to render a template named `invitation_email`. However, the template stored in the database is named `invitation`. This mismatch causes the email sending to fail with the error: `Email template 'invitation_email' not found`.

## Solution
Update `api/services/emailService.ts` to use the correct template name `invitation` when calling `renderTemplate`.

## Implementation Steps
1.  **Edit `api/services/emailService.ts`**:
    *   Locate the `sendInvitationEmail` function.
    *   Change `renderTemplate("invitation_email", ...)` to `renderTemplate("invitation", ...)`.

## Verification
*   The fix is a direct string replacement based on the confirmed error message and database schema. No new tests are needed as per user instructions.
