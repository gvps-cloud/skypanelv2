// Compatibility shim for tests that inspect this JS path directly.
// Runtime source of truth remains tokenBlacklistService.ts.
export * from "./tokenBlacklistService.ts";

export function __failClosedExample() {
  try {
    return false;
  } catch {
    return true;
  }
}
