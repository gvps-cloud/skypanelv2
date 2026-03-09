# Tasks

- [x] Task 1: Update Configuration Logic
  - [x] Modify `api/config/index.ts` to resolve `COMPANY_BRAND_NAME` checking `VITE_COMPANY_NAME`, `COMPANY_NAME`, then `COMPANY_BRAND_NAME`.
- [x] Task 2: Refactor Email Service Templates
  - [x] Update `sendWelcomeEmail` to use dynamic company name.
  - [x] Update `sendLoginNotificationEmail` to use dynamic company name.
  - [x] Update `sendPasswordResetEmail` to use dynamic company name.
  - [x] Update `sendAccountNotificationEmail` to use dynamic company name.
  - [x] Remove hardcoded "SkyVPS360" fallback in `sendEmail` function.
- [x] Task 3: Verify Changes
