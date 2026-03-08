import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../lib/database.js';
import { linodeService } from './linodeService.js';
import { decryptSecret } from '../lib/crypto.js';
import { Client as SSHClient } from 'ssh2';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId?: string;
}

interface IncomingMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string; // raw input text
  rows?: number;
  cols?: number;
}

function parsePath(url: string | undefined): { instanceId: string | null } {
  if (!url) return { instanceId: null };
  try {
    const u = new URL(url, 'http://localhost');
    const segments = u.pathname.split('/').filter(Boolean);
    // Expect: /api/vps/:id/ssh
    if (segments.length >= 3 && segments[0] === 'api' && segments[1] === 'vps' && segments[3] === 'ssh') {
      return { instanceId: segments[2] };
    }
  } catch {
    // ignore
  }
  return { instanceId: null };
}

async function authenticate(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    const userRes = await query('SELECT id, email, role FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];
    let organizationId: string | undefined = undefined;
    try {
      const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id = $1', [user.id]);
      organizationId = orgRes.rows[0]?.organization_id;
    } catch {
      // fallback by owner org
      const ownerRes = await query('SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
      organizationId = ownerRes.rows[0]?.id;
    }
    return { id: user.id, email: user.email, role: user.role, organizationId };
  } catch (err) {
    console.warn('WS auth failed:', err);
    return null;
  }
}

function send(ws: WebSocket, payload: any) {
  try {
    ws.send(JSON.stringify(payload));
  } catch (err) {
    console.warn('WS send error:', err);
  }
}

export function initSSHBridge(server: Server) {
  const wss = new WebSocketServer({ server });
  console.log('WebSocket SSH bridge initialized');

  wss.on('connection', async (ws, req) => {
    const url = req.url;
    const { instanceId } = parsePath(url);
    const token = (() => {
      try {
        const u = new URL(url || '', 'http://localhost');
        return u.searchParams.get('token');
      } catch {
        return null;
      }
    })();

    if (!instanceId) {
      send(ws, { type: 'error', message: 'Invalid SSH path' });
      ws.close();
      return;
    }

    const user = await authenticate(token);
    if (!user || !user.organizationId) {
      send(ws, { type: 'error', message: 'Unauthorized' });
      ws.close();
      return;
    }

    const instRes =
      user.role === "admin"
        ? await query("SELECT * FROM vps_instances WHERE id = $1", [instanceId])
        : await query(
            "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
            [instanceId, user.organizationId],
          );
    if (instRes.rows.length === 0) {
      send(ws, { type: 'error', message: 'Instance not found' });
      ws.close();
      return;
    }
    const instanceRow = instRes.rows[0];

    // Resolve IP
    let ip: string | null = instanceRow.ip_address || null;
    if (!ip) {
      try {
        const providerId = Number(instanceRow.provider_instance_id);
        if (Number.isFinite(providerId)) {
          const detail = await linodeService.getLinodeInstance(providerId);
          ip = Array.isArray(detail.ipv4) && detail.ipv4.length > 0 ? detail.ipv4[0] : null;
        }
      } catch (err) {
        console.warn('Failed to resolve IP for SSH:', err);
      }
    }
    if (!ip) {
      send(ws, { type: 'error', message: 'IP address unavailable' });
      ws.close();
      return;
    }

    const rowsDefault = 30;
    const colsDefault = 120;
    let initialRows = rowsDefault;
    let initialCols = colsDefault;
    try {
      const u = new URL(url || '', 'http://localhost');
      initialRows = parseInt(u.searchParams.get('rows') || String(rowsDefault), 10);
      initialCols = parseInt(u.searchParams.get('cols') || String(colsDefault), 10);
    } catch {}

    // Extract encrypted password if available
    const configObj = instanceRow.configuration || {};
    const authCfg = (configObj?.auth && typeof configObj.auth === 'object') ? configObj.auth : null;
    const username = (authCfg?.user && typeof authCfg.user === 'string') ? authCfg.user : 'root';
    let password: string | undefined = undefined;
    if (authCfg?.password_enc) {
      try {
        password = decryptSecret(String(authCfg.password_enc));
      } catch (err) {
        console.warn('Failed to decrypt stored password:', err);
      }
    }

    const ssh = new SSHClient();
    let shellStream: any = null;
    let closed = false;

    const closeAll = (code?: number, reason?: string) => {
      if (closed) return;
      closed = true;
      try { shellStream?.end(); } catch {}
      try { ssh.end(); } catch {}
      try { ws.close(code || 1000, reason || 'Session closed'); } catch {}
    };

    ssh.on('ready', () => {
      send(ws, { type: 'status', message: 'ssh-ready' });
      ssh.shell({ term: 'xterm-256color', rows: initialRows, cols: initialCols }, (err, stream) => {
        if (err) {
          send(ws, { type: 'error', message: 'Failed to start shell: ' + (err as Error).message });
          closeAll(1011, 'shell-error');
          return;
        }
        shellStream = stream;
        send(ws, { type: 'connected' });

        stream.on('close', () => {
          send(ws, { type: 'close', message: 'Shell closed' });
          closeAll(1000, 'shell-closed');
        });
        stream.on('data', (data: Buffer) => {
          ws.send(JSON.stringify({ type: 'output', data: data.toString('utf8') }));
        });
        stream.stderr?.on('data', (data: Buffer) => {
          ws.send(JSON.stringify({ type: 'output', data: data.toString('utf8') }));
        });
      });
    }).on('error', (err) => {
      send(ws, { type: 'error', message: 'SSH error: ' + (err as Error).message });
      closeAll(1011, 'ssh-error');
    }).on('end', () => {
      send(ws, { type: 'close', message: 'SSH ended' });
      closeAll(1000, 'ssh-ended');
    });

    try {
      ssh.connect({
        host: ip,
        port: 22,
        username,
        password,
        readyTimeout: 25000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 6,
      });
    } catch (err) {
      send(ws, { type: 'error', message: 'SSH connect failed: ' + (err as Error).message });
      closeAll(1011, 'connect-failed');
      return;
    }

    ws.on('message', (message: Buffer) => {
      let payload: IncomingMessage | null = null;
      try {
        payload = JSON.parse(message.toString('utf8')) as IncomingMessage;
      } catch {}
      if (!payload) return;
      if (payload.type === 'input') {
        const text = payload.data || '';
        if (shellStream) {
          try { shellStream.write(text); } catch {}
        }
      } else if (payload.type === 'resize') {
        const rows = payload.rows || initialRows;
        const cols = payload.cols || initialCols;
        try { shellStream?.setWindow(rows, cols, 0, 0); } catch {}
      }
    });

    ws.on('close', () => {
      closeAll(1000, 'client-closed');
    });
    ws.on('error', () => {
      closeAll(1011, 'ws-error');
    });
  });
}
