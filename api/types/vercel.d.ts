/**
 * Minimal type declarations for @vercel/node compatibility.
 *
 * We do NOT install @vercel/node as a dependency because its transitive graph
 * has multiple high-severity CVEs with only breaking downgrade fixes available.
 * Primary deployment is PM2-based; Vercel serverless is a secondary target and
 * when deployed to Vercel, the runtime provides its own @vercel/node package,
 * so these types are only needed during local typecheck.
 *
 * Keep these declarations minimal — only what api/index.ts actually consumes.
 */
declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'node:http';

  export interface VercelRequest extends IncomingMessage {
    query: Record<string, string | string[]>;
    cookies: Record<string, string>;
    body: unknown;
  }

  export interface VercelResponse extends ServerResponse {
    send: (body: unknown) => VercelResponse;
    json: (body: unknown) => VercelResponse;
    status: (statusCode: number) => VercelResponse;
    redirect: (statusOrUrl: number | string, url?: string) => VercelResponse;
  }
}
