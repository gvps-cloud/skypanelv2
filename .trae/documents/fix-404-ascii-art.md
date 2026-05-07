# Plan: Fix ASCII 404 Art on 404 Page

## Summary
Replace the ambiguous box-drawing character-based ASCII art for "404" with clear ASCII characters that unambiguously spell "404".

## Current State
`src/components/fx/ascii/logo.ts` contains `ASCII_404` using block characters (███) and box-drawing characters (╗, ║, ╔, etc.) that can render poorly and be misread as "NO3".

## Proposed Changes

### File: `src/components/fx/ascii/logo.ts`
- **What**: Replace the `ASCII_404` string
- **Why**: The current art with box-drawing characters doesn't clearly read as "404"
- **How**: Swap in clean ASCII art using only standard characters that unambiguously spell "404"

**Old:**
```
  ███╗   ██╗ ██████╗ ██████╗
  ████╗  ██║██╔═══██╗╚════██╗
  ██╔██╗ ██║██║   ██║ █████╔╝
  ██║╚██╗██║██║   ██║ ╚═══██╗
  ██║ ╚████║╚██████╔╝██████╔╝
  ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝
```

**New:**
```
 _  _   __   ____  ____
/ )( \\ /  \\ (  _ \\/ ___)
\\ \\/ // (_) \\ )   /\\___ \\
 \\__/  \\____/(____/(____/
```

## Verification
1. Run `npm run check` to verify TypeScript
2. View the 404 page in browser to confirm the ASCII art renders correctly as "404"
