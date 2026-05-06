import { Client } from 'pg';
import { EventEmitter } from 'events';
import { config } from '../config/index.js';
import { getLongLivedPgClientConfig } from '../lib/database.js';
import { startPgListenHeartbeat } from '../lib/pgListenHeartbeat.js';

export interface TicketNotificationPayload {
  ticket_id: string;
  [key: string]: unknown;
}

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_BACKOFF_EXPONENT = 12;
const DEV_CLIENT_ERROR_LOG_COOLDOWN_MS = 30_000;

/**
 * Singleton service that maintains a single dedicated PostgreSQL LISTEN
 * connection for the `ticket_updates` channel and fans out parsed payloads
 * to in-process EventEmitter subscribers.
 *
 * This avoids allocating one pg client per connected SSE client, preventing
 * connection-pool exhaustion under high concurrency.
 */
class TicketNotificationService extends EventEmitter {
  private client: Client | null = null;
  private isListening = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private hasHadSuccessfulListen = false;
  private startPromise: Promise<void> | null = null;
  private reconnectEnabled = true;
  private stopHeartbeat: (() => void) | null = null;
  private nextClientErrorLogAllowedAt = 0;
  /** Coalesces `error` + `end` firing back-to-back into one reconnect schedule. */
  private reconnectScheduled = false;

  async start(): Promise<void> {
    if (this.isListening) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.doStart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async doStart(): Promise<void> {
    try {
      const connectionString = config.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
      }

      this.client = new Client(getLongLivedPgClientConfig(connectionString));

      this.client.on('error', (err) => {
        this.logClientError(err);
        this.handleDisconnect();
      });

      this.client.on('end', () => {
        if (process.env.NODE_ENV !== 'production' && this.hasHadSuccessfulListen) {
          console.debug('TicketNotificationService client connection ended');
        } else {
          console.log('TicketNotificationService client connection ended');
        }
        this.handleDisconnect();
      });

      await this.client.connect();
      console.log('TicketNotificationService connected to database');

      await this.client.query('LISTEN ticket_updates');
      console.log('TicketNotificationService listening on channel: ticket_updates');

      this.client.on('notification', (msg) => {
        if (msg.channel === 'ticket_updates' && msg.payload) {
          try {
            const payload: TicketNotificationPayload = JSON.parse(msg.payload);
            this.emit('ticket_update', payload, msg.payload);
          } catch (err) {
            console.error('TicketNotificationService: error parsing payload:', err);
          }
        }
      });

      this.stopHeartbeat?.();
      this.stopHeartbeat = startPgListenHeartbeat(this.client);

      this.isListening = true;
      this.reconnectAttempts = 0;
      this.hasHadSuccessfulListen = true;
    } catch (err) {
      console.error('Failed to start TicketNotificationService:', err);
      this.handleDisconnect();
    }
  }

  private logClientError(err: unknown): void {
    const now = Date.now();
    if (!this.hasHadSuccessfulListen || process.env.NODE_ENV === 'production') {
      console.error('TicketNotificationService client error:', err);
      return;
    }
    if (now >= this.nextClientErrorLogAllowedAt) {
      console.debug('TicketNotificationService client error:', err);
      this.nextClientErrorLogAllowedAt = now + DEV_CLIENT_ERROR_LOG_COOLDOWN_MS;
    }
  }

  private handleDisconnect(): void {
    if (!this.reconnectEnabled) {
      return;
    }
    if (this.reconnectScheduled) {
      return;
    }
    this.reconnectScheduled = true;

    this.isListening = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat?.();
    this.stopHeartbeat = null;

    if (this.client) {
      this.client.removeAllListeners();
      this.client.end().catch(() => {});
      this.client = null;
    }

    this.reconnectAttempts++;
    const exp = Math.min(this.reconnectAttempts - 1, MAX_BACKOFF_EXPONENT);
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, exp), MAX_RECONNECT_DELAY_MS);
    const msg =
      `TicketNotificationService reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`;
    if (process.env.NODE_ENV !== 'production' && this.hasHadSuccessfulListen) {
      console.debug(msg);
    } else {
      console.log(msg);
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectScheduled = false;
      this.start().catch((err) => {
        console.error('TicketNotificationService reconnection attempt failed:', err);
      });
    }, delay);
  }

  async stop(): Promise<void> {
    this.reconnectEnabled = false;
    this.reconnectScheduled = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat?.();
    this.stopHeartbeat = null;

    if (this.client) {
      try {
        await this.client.query('UNLISTEN ticket_updates');
        await this.client.end();
      } catch (err) {
        console.error('TicketNotificationService: error stopping:', err);
      }
      this.client = null;
    }

    this.isListening = false;
    this.removeAllListeners();
    console.log('TicketNotificationService stopped');
  }

  isActive(): boolean {
    return this.isListening && this.client !== null;
  }
}

// Singleton instance
export const ticketNotificationService = new TicketNotificationService();
