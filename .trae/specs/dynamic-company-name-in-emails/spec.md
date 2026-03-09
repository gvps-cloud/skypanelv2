# Dynamic Company Name in Emails Spec

## Why
Currently, the application has hardcoded company names like "SkyVPS360" and "skyvps360.xyz" in various email templates and configuration fallbacks. This makes it difficult to rebrand or white-label the application. The user wants to use environment variables (`VITE_COMPANY_NAME`, `COMPANY_NAME`, or `COMPANY_BRAND_NAME`) to dynamically set the company name in emails.

## What Changes
- **Configuration Logic**: Update `api/config/index.ts` to prioritize `VITE_COMPANY_NAME`, then `COMPANY_NAME`, then `COMPANY_BRAND_NAME` from the environment, falling back to "SkyPanelV2".
- **Email Templates**: Refactor `api/services/emailService.ts` to replace all hardcoded instances of "SkyVPS360" with the dynamic `config.COMPANY_BRAND_NAME`.

## Impact
- **Affected specs**: Email notification system.
- **Affected code**:
  - `api/config/index.ts`
  - `api/services/emailService.ts`

## ADDED Requirements
### Requirement: Dynamic Company Name Resolution
The system SHALL resolve the company name from the following environment variables in order of precedence:
1. `VITE_COMPANY_NAME`
2. `COMPANY_NAME`
3. `COMPANY_BRAND_NAME`
4. Fallback: "SkyPanelV2"

#### Scenario: Sending Emails
- **WHEN** the system sends any email (Welcome, Password Reset, Login Notification, etc.)
- **THEN** the email subject, body, and footer SHALL use the resolved company name instead of "SkyVPS360".

## MODIFIED Requirements
### Requirement: Email Service Templates
All email functions in `api/services/emailService.ts` (`sendWelcomeEmail`, `sendLoginNotificationEmail`, `sendPasswordResetEmail`, `sendAccountNotificationEmail`) SHALL use `config.COMPANY_BRAND_NAME` for the company name.

## REMOVED Requirements
### Requirement: Hardcoded "SkyVPS360" strings
**Reason**: To support white-labeling and dynamic configuration.
**Migration**: Replaced with configuration variables.
