/**
 * Platform Settings Service
 * Shared helper for reading platform_settings rows.
 */
import { query } from "../lib/database.js";

export async function getPlatformSetting(key: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await query(
      `SELECT value FROM platform_settings WHERE key = $1`,
      [key]
    );
    if (result.rows.length > 0 && result.rows[0].value) {
      return result.rows[0].value as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}
