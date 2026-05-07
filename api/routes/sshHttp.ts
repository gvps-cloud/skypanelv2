import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, requireOrganization, AuthenticatedRequest } from '../middleware/auth.js';
import { query } from '../lib/database.js';
import { linodeService } from '../services/linodeService.js';
import { decryptSecret } from '../lib/crypto.js';
import { Client as SSHClient } from 'ssh2';
import crypto from 'crypto';

const router = Router();

router.use(authenticateToken, requireOrganization);

interface SshSession {
  id: string;
  userId: string;
  instanceId: string;
  ssh: SSHClient;
  stream: any;
  sseResponses: Set<Response>;
  createdAt: number;
  lastActivity: number;
  outputBuffer: string[];
  outputBufferSize: number;
  rows: number;
  cols: number;
}

const sessions = new Map<string, SshSession>();
const MAX_SESSIONS_PER_USER = 3;
const MAX_BUFFER_SIZE = 512 * 1024;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_TOTAL_SESSIONS = 100;

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      cleanupSession(sessionId);
    }
  }
}, 60 * 1000);
cleanupInterval.unref();

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  try { session.stream?.end(); } catch {}
  try { session.ssh?.end(); } catch {}
  for (const res of session.sseResponses) {
    try { res.end(); } catch {}
  }
  sessions.delete(sessionId);
}

function addOutput(session: SshSession, data: string) {
  session.outputBuffer.push(data);
  session.outputBufferSize += data.length;
  while (session.outputBufferSize > MAX_BUFFER_SIZE && session.outputBuffer.length > 1) {
    const removed = session.outputBuffer.shift()!;
    session.outputBufferSize -= removed.length;
  }
  for (const res of session.sseResponses) {
    try {
      res.write(`data: ${JSON.stringify({ type: 'output', data })}\n\n`);
    } catch {}
  }
}

function sendEvent(res: Response, event: Record<string, any>) {
  try {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {}
}

interface ConnectBody {
  rows?: number;
  cols?: number;
}

router.post('/:id/ssh/connect', async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user?.id || !user.organizationId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const instanceId = req.params.id;
  const { rows: requestedRows, cols: requestedCols } = (req.body || {}) as ConnectBody;
  const rows = requestedRows || 30;
  const cols = requestedCols || 120;

  const userSessionCount = Array.from(sessions.values()).filter(s => s.userId === user.id).length;
  if (userSessionCount >= MAX_SESSIONS_PER_USER) {
    return res.status(429).json({ error: 'Too many active SSH sessions. Please disconnect one first.' });
  }

  if (sessions.size >= MAX_TOTAL_SESSIONS) {
    return res.status(503).json({ error: 'Server is at maximum session capacity. Please try again later.' });
  }

  let instRes;
  try {
    instRes = user.role === 'admin'
      ? await query('SELECT * FROM vps_instances WHERE id = $1', [instanceId])
      : await query('SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2', [instanceId, user.organizationId]);
  } catch (err) {
    return res.status(500).json({ error: 'Instance lookup failed' });
  }

  if (instRes.rows.length === 0) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  const instanceRow = instRes.rows[0];

  let ip: string | null = instanceRow.ip_address || null;
  if (!ip) {
    try {
      const providerId = Number(instanceRow.provider_instance_id);
      if (Number.isFinite(providerId)) {
        const detail = await linodeService.getLinodeInstance(providerId);
        ip = Array.isArray(detail.ipv4) && detail.ipv4.length > 0 ? detail.ipv4[0] : null;
      }
    } catch {}
  }

  if (!ip) {
    return res.status(400).json({ error: 'IP address unavailable' });
  }

  const configObj = instanceRow.configuration || {};
  const authCfg = (configObj?.auth && typeof configObj.auth === 'object') ? configObj.auth : null;
  const username = (authCfg?.user && typeof authCfg.user === 'string') ? authCfg.user : 'root';
  let password: string | undefined;
  if (authCfg?.password_enc) {
    try {
      password = decryptSecret(String(authCfg.password_enc));
    } catch {}
  }

  const sessionId = crypto.randomUUID();

  const session: SshSession = {
    id: sessionId,
    userId: user.id,
    instanceId,
    ssh: null as any,
    stream: null,
    sseResponses: new Set(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    outputBuffer: [],
    outputBufferSize: 0,
    rows,
    cols,
  };

  sessions.set(sessionId, session);

  try {
    const ssh = new SSHClient();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSH connection timed out'));
      }, 25000);

      ssh.on('ready', () => {
        clearTimeout(timeout);
        ssh.shell({ term: 'xterm-256color', rows, cols }, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }
          session.ssh = ssh;
          session.stream = stream;

          stream.on('close', () => {
            for (const sseRes of session.sseResponses) {
              sendEvent(sseRes, { type: 'close', message: 'Shell closed' });
            }
            cleanupSession(sessionId);
          });

          stream.on('data', (data: Buffer) => {
            session.lastActivity = Date.now();
            addOutput(session, data.toString('utf8'));
          });

          stream.stderr?.on('data', (data: Buffer) => {
            session.lastActivity = Date.now();
            addOutput(session, data.toString('utf8'));
          });

          resolve();
        });
      });

      ssh.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ssh.connect({
        host: ip,
        port: 22,
        username,
        password,
        readyTimeout: 25000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 6,
      });
    });
  } catch (err: any) {
    cleanupSession(sessionId);
    return res.status(500).json({ error: 'SSH connection failed: ' + (err.message || String(err)) });
  }

  return res.json({ sessionId, status: 'connected' });
});

interface StreamRequest extends AuthenticatedRequest {
  params: { id: string; sessionId: string };
}

router.get('/:id/ssh/:sessionId/stream', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sessionId } = req.params as { sessionId: string };
  const session = sessions.get(sessionId);

  if (!session || session.userId !== user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.ssh || !session.stream) {
    return res.status(410).json({ error: 'Session expired' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  for (const buffered of session.outputBuffer) {
    res.write(`data: ${JSON.stringify({ type: 'output', data: buffered })}\n\n`);
  }

  session.sseResponses.add(res);
  session.lastActivity = Date.now();

  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    session.sseResponses.delete(res);
    session.lastActivity = Date.now();
  });

  res.on('close', () => {
    clearInterval(heartbeatInterval);
    session.sseResponses.delete(res);
    session.lastActivity = Date.now();
  });
});

interface InputBody {
  type: 'input' | 'ping';
  data?: string;
}

router.post('/:id/ssh/:sessionId/input', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sessionId } = req.params as { sessionId: string };
  const session = sessions.get(sessionId);

  if (!session || session.userId !== user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.stream) {
    return res.status(410).json({ error: 'Session expired' });
  }

  const body = req.body as InputBody;
  if (body?.type === 'input' && typeof body.data === 'string') {
    try {
      session.stream.write(body.data);
      session.lastActivity = Date.now();
    } catch {
      return res.status(500).json({ error: 'Failed to write to SSH stream' });
    }
  }

  return res.json({ ok: true });
});

interface ResizeBody {
  rows: number;
  cols: number;
}

router.post('/:id/ssh/:sessionId/resize', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sessionId } = req.params as { sessionId: string };
  const session = sessions.get(sessionId);

  if (!session || session.userId !== user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!session.stream) {
    return res.status(410).json({ error: 'Session expired' });
  }

  const { rows, cols } = req.body as ResizeBody;
  const newRows = Math.max(1, Math.min(200, Math.floor(rows || session.rows)));
  const newCols = Math.max(1, Math.min(500, Math.floor(cols || session.cols)));

  try {
    session.stream.setWindow(newRows, newCols, 0, 0);
    session.rows = newRows;
    session.cols = newCols;
    session.lastActivity = Date.now();
  } catch {}

  return res.json({ ok: true });
});

router.post('/:id/ssh/:sessionId/disconnect', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sessionId } = req.params as { sessionId: string };
  const session = sessions.get(sessionId);

  if (!session || session.userId !== user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }

  cleanupSession(sessionId);
  return res.json({ ok: true });
});

export default router;