# Fix MarketingNavbar Dropdown Display Issue

## Summary

The MarketingNavbar dropdown menu (Company dropdown) is not displaying properly because the parent container has `overflow-hidden` which clips the absolutely-positioned dropdown content.

## Current State Analysis

**File:** `src/components/MarketingNavbar.tsx`

**Problem:**
- Line 168: The navbar container div has `overflow-hidden` class
- The dropdown menu (lines 122-145) is positioned absolutely with `top-full`
- The `overflow-hidden` on the parent clips the dropdown, preventing it from being visible

**Current Code (line 168):**
```tsx
<div className="pointer-events-auto relative flex items-center justify-between overflow-hidden rounded-sm border border-border/60 bg-background/85 px-4 py-3 font-mono shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
```

## Proposed Changes

### File: `src/components/MarketingNavbar.tsx`

**Change:** Remove `overflow-hidden` from the navbar container div (line 168)

**Before:**
```tsx
<div className="pointer-events-auto relative flex items-center justify-between overflow-hidden rounded-sm border border-border/60 bg-background/85 px-4 py-3 font-mono shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
```

**After:**
```tsx
<div className="pointer-events-auto relative flex items-center justify-between rounded-sm border border-border/60 bg-background/85 px-4 py-3 font-mono shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
```

**Why this works:**
- Removing `overflow-hidden` allows the absolutely-positioned dropdown to extend beyond the navbar bounds
- The backdrop blur effect (`backdrop-blur-xl`) still works without `overflow-hidden`
- The rounded corners (`rounded-sm`) are applied via border-radius and don't require `overflow-hidden` to display correctly
- The dropdown will now properly display below the "Company" button

## Assumptions & Decisions

1. **Backdrop blur compatibility:** The `backdrop-blur-xl` effect works without `overflow-hidden` because it applies to the element's own background, not its children
2. **Rounded corners:** CSS `border-radius` creates visual rounding without needing `overflow-hidden` to clip content
3. **No side effects:** Removing `overflow-hidden` won't cause other visual issues since the navbar content is flexbox-based and doesn't overflow

## Verification Steps

1. Start the development server: `npm run dev-up`
2. Navigate to the homepage (`/`)
3. Click the "Company" dropdown button in the MarketingNavbar
4. Verify the dropdown menu appears below the button with all items (About, Contact, FAQ)
5. Verify clicking outside the dropdown closes it
6. Verify the navbar still has proper backdrop blur and rounded corners
7. Test on mobile viewport to ensure mobile menu still works correctly
