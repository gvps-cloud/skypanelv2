# Handoff

## State
Fixed category mappings on `/pricing` page for unauthenticated guests. Added public `/api/pricing/category-mappings` endpoint (no auth), updated frontend service to use it, added API documentation. All code changes complete and docs synced/audited.

## Next
1. Test with `npm run dev-up` (kills ports 3001/5173/8000 first for clean startup)
2. Verify `/pricing` in incognito shows custom names ("Basic VPS" not "Nanode")
3. Test `curl http://localhost:3001/api/pricing/category-mappings` returns mappings

## Context
Use `npm run dev-up` NOT `npm run dev` - dev-up kills ports first for clean startup. White-label critical: guests should NEVER see "Linode" branding.
