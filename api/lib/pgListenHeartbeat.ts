import type { Client } from "pg";

/** Default interval keeps idle LISTEN sessions active under managed-DB / LB idle cuts. */
const DEFAULT_INTERVAL_MS = 45_000;

/**
 * Periodically runs `SELECT 1` on the same client that holds LISTEN, so the
 * connection is not idle from the network / proxy perspective.
 * Call the returned stop function on disconnect or shutdown.
 */
export function startPgListenHeartbeat(
  client: Client,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): () => void {
  const id = setInterval(() => {
    void client.query("SELECT 1").catch(() => {
      // Failures are handled by the client's `error` / reconnect logic.
    });
  }, intervalMs);
  return () => clearInterval(id);
}
