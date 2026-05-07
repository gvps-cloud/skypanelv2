import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
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

interface WSMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string;
  rows?: number;
  cols?: number;
}

interface SshIncomingMessage extends IncomingMessage {
  sshRequestId?: string;
  sshInstanceId?: string;
}

interface SshPathMatch {
  isSshPath: boolean;
  instanceId: string | null;
  pathname: string;
}

type LogContext = Record<string, string | number | boolean | null | undefined>;

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compactContext(context: LogContext = {}): LogContext {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  ) as LogContext;
}

function logInfo(message: string, context?: LogContext) {
  console.log(`[ssh-bridge] ${message}`, compactContext(context));
}

function logWarn(message: string, context?: LogContext) {
  console.warn(`[ssh-bridge] ${message}`, compactContext(context));
}

function makeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePath(url: string | undefined): SshPathMatch {
  if (!url) return { isSshPath: false, instanceId: null, pathname: '' };
  try {
    const u = new URL(url, 'http://localhost');
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 4 && segments[0] === 'api' && segments[1] === 'vps' && segments[3] === 'ssh') {
      let instanceId = segments[2];
      try {
        instanceId = decodeURIComponent(instanceId);
      } catch {
        // Keep the encoded segment; the downstream lookup will fail safely.
      }

      return { isSshPath: true, instanceId, pathname: u.pathname };
    }
  } catch {
    // ignore
  }
  return { isSshPath: false, instanceId: null, pathname: url };
}

function rejectUpgrade(socket: Duplex, statusCode: number, reasonPhrase: string) {
  if (socket.destroyed) return;

  try {
    socket.write(
      `HTTP/1.1 ${statusCode} ${reasonPhrase}\r\n` +
        'Connection: close\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n',
    );
  } catch {
    // ignore write failures while rejecting the upgrade
  } finally {
    socket.destroy();
  }
}

function closeReasonText(reason: Buffer): string | undefined {
  const text = reason.toString('utf8').trim();
  return text || undefined;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function getTokenFromRequest(req: IncomingMessage): string | null {
  // 1. Try ?token= query param (backward compat with older clients)
  try {
    const u = new URL(req.url || '', 'http://localhost');
    const queryToken = u.searchParams.get('token');
    if (queryToken) return queryToken;
  } catch {}

  // 2. Fall back to auth_token HttpOnly cookie (current auth model)
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.auth_token) return cookies.auth_token;

  return null;
}

async function authenticate(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    const userRes = await query('SELECT id, email, role, active_organization_id FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0) return null;
    const user = userRes.rows[0];
    let organizationId: string | undefined = undefined;

    // Resolve organization: active_organization_id → membership → owned org
    if (user.active_organization_id) {
      try {
        const activeRes = await query('SELECT organization_id FROM organization_members WHERE user_id = $1 AND organization_id = $2', [user.id, user.active_organization_id]);
        if (activeRes.rows.length > 0) {
          organizationId = user.active_organization_id;
        }
      } catch { /* table may not exist during migration */ }
    }

    if (!organizationId) {
      try {
        const orgRes = await query('SELECT organization_id FROM organization_members WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1', [user.id]);
        organizationId = orgRes.rows[0]?.organization_id;
      } catch { /* ignore */ }
    }

    if (!organizationId) {
      try {
        const ownerRes = await query('SELECT id FROM organizations WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
        organizationId = ownerRes.rows[0]?.id;
      } catch { /* ignore */ }
    }

    return { id: user.id, email: user.email, role: user.role, organizationId };
  } catch (err) {
    logWarn('WS auth failed', { error: safeErrorMessage(err) });
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

async function handleSshConnection(ws: WebSocket, req: SshIncomingMessage) {
  const url = req.url;
  const parsedPath = parsePath(url);
  const instanceId = req.sshInstanceId || parsedPath.instanceId;
  const requestId = req.sshRequestId || makeRequestId();
  const remoteAddress = req.socket.remoteAddress;
  let ssh: SSHClient | null = null;
  let shellStream: any = null;
  let resourcesClosed = false;

  const closeResources = () => {
    if (resourcesClosed) return;
    resourcesClosed = true;
    try { shellStream?.end(); } catch {}
    try { ssh?.end(); } catch {}
  };

  const closeAll = (code = 1000, reason = 'Session closed') => {
    closeResources();
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try { ws.close(code, reason); } catch {}
    }
  };

  ws.on('close', (code, reason) => {
    logInfo('SSH websocket closed', {
      requestId,
      instanceId,
      closeCode: code,
      closeReason: closeReasonText(reason),
    });
    closeResources();
  });

  ws.on('error', (err) => {
    logWarn('SSH websocket error', {
      requestId,
      instanceId,
      error: safeErrorMessage(err),
    });
    closeAll(1011, 'ws-error');
  });

  try {
    if (!instanceId) {
      logWarn('SSH websocket missing instance id', { requestId, remoteAddress });
      send(ws, { type: 'error', message: 'Invalid SSH path' });
      closeAll(1008, 'invalid-ssh-path');
      return;
    }

    logInfo('SSH websocket connection accepted', {
      requestId,
      instanceId,
      remoteAddress,
      host: req.headers.host,
      origin: req.headers.origin,
    });

    const token = getTokenFromRequest(req);
    const user = await authenticate(token);
    if (!user || !user.organizationId) {
      logWarn('SSH websocket auth rejected', { requestId, instanceId, remoteAddress });
      send(ws, { type: 'error', message: 'Unauthorized' });
      closeAll(1008, 'unauthorized');
      return;
    }

    let instRes;
    try {
      instRes =
        user.role === "admin"
          ? await query("SELECT * FROM vps_instances WHERE id = $1", [instanceId])
          : await query(
              "SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
              [instanceId, user.organizationId],
            );
    } catch (err) {
      logWarn('SSH instance lookup failed', {
        requestId,
        instanceId,
        error: safeErrorMessage(err),
      });
      send(ws, { type: 'error', message: 'Instance lookup failed' });
      closeAll(1011, 'instance-lookup-error');
      return;
    }

    if (instRes.rows.length === 0) {
      logWarn('SSH instance not found or not authorized', { requestId, instanceId });
      send(ws, { type: 'error', message: 'Instance not found' });
      closeAll(1008, 'instance-not-found');
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
        logWarn('Failed to resolve IP for SSH', {
          requestId,
          instanceId,
          error: safeErrorMessage(err),
        });
      }
    }
    if (!ip) {
      logWarn('SSH instance has no reachable IP address', { requestId, instanceId });
      send(ws, { type: 'error', message: 'IP address unavailable' });
      closeAll(1011, 'ip-unavailable');
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
        logWarn('Failed to decrypt stored SSH password', {
          requestId,
          instanceId,
          error: safeErrorMessage(err),
        });
      }
    }

    ssh = new SSHClient();

    ssh.on('ready', () => {
      logInfo('SSH client ready', { requestId, instanceId });
      send(ws, { type: 'status', message: 'ssh-ready' });
      ssh?.shell({ term: 'xterm-256color', rows: initialRows, cols: initialCols }, (err, stream) => {
        if (err) {
          logWarn('SSH shell failed to start', {
            requestId,
            instanceId,
            error: safeErrorMessage(err),
          });
          send(ws, { type: 'error', message: 'Failed to start shell: ' + (err as Error).message });
          closeAll(1011, 'shell-error');
          return;
        }
        shellStream = stream;
        logInfo('SSH shell started', { requestId, instanceId });
        send(ws, { type: 'connected' });

        stream.on('close', () => {
          logInfo('SSH shell closed', { requestId, instanceId });
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
      logWarn('SSH client error', {
        requestId,
        instanceId,
        error: safeErrorMessage(err),
      });
      send(ws, { type: 'error', message: 'SSH error: ' + (err as Error).message });
      closeAll(1011, 'ssh-error');
    }).on('end', () => {
      logInfo('SSH client ended', { requestId, instanceId });
      send(ws, { type: 'close', message: 'SSH ended' });
      closeAll(1000, 'ssh-ended');
    });

    try {
      logInfo('Connecting SSH client', { requestId, instanceId, host: ip, username });
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
      logWarn('SSH connect threw synchronously', {
        requestId,
        instanceId,
        error: safeErrorMessage(err),
      });
      send(ws, { type: 'error', message: 'SSH connect failed: ' + (err as Error).message });
      closeAll(1011, 'connect-failed');
      return;
    }

    ws.on('message', (message: Buffer) => {
      let payload: WSMessage | null = null;
      try {
        payload = JSON.parse(message.toString('utf8')) as WSMessage;
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
  } catch (err) {
    logWarn('SSH websocket setup failed', {
      requestId,
      instanceId,
      error: safeErrorMessage(err),
    });
    send(ws, { type: 'error', message: 'SSH websocket setup failed' });
    closeAll(1011, 'setup-error');
  }
}

export function initSSHBridge(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  console.log('[ssh-bridge] WebSocket SSH bridge initialized');

  server.on('upgrade', (req: SshIncomingMessage, socket, head) => {
    const parsedPath = parsePath(req.url);

    if (!parsedPath.isSshPath || !parsedPath.instanceId) {
      logWarn('Rejected non-SSH websocket upgrade', {
        pathname: parsedPath.pathname,
        remoteAddress: req.socket.remoteAddress,
      });
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    req.sshRequestId = makeRequestId();
    req.sshInstanceId = parsedPath.instanceId;
    logInfo('SSH upgrade received', {
      requestId: req.sshRequestId,
      instanceId: req.sshInstanceId,
      remoteAddress: req.socket.remoteAddress,
      host: req.headers.host,
      origin: req.headers.origin,
    });

    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (err) {
      logWarn('SSH upgrade failed', {
        requestId: req.sshRequestId,
        instanceId: req.sshInstanceId,
        error: safeErrorMessage(err),
      });
      rejectUpgrade(socket, 500, 'Internal Server Error');
    }
  });

  wss.on('connection', (ws, req) => {
    void handleSshConnection(ws, req as SshIncomingMessage);
  });
}
