import { Client } from 'pg';
import { EventEmitter } from 'events';
import { config } from '../config/index.js';
import { getLongLivedPgClientConfig } from '../lib/database.js';
import { startPgListenHeartbeat } from '../lib/pgListenHeartbeat.js';

export interface Notification {
  id: string;
  user_id: string;
  organization_id?: string | null;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  message?: string | null;
  status: 'success' | 'warning' | 'error' | 'info';
  created_at: string;
  is_read: boolean;
}

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_BACKOFF_EXPONENT = 12;
const DEV_CLIENT_ERROR_LOG_COOLDOWN_MS = 30_000;

class NotificationService extends EventEmitter {
  private client: Client | null = null;
  private isListening = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private hasHadSuccessfulListen = false;
  private startPromise: Promise<void> | null = null;
  private reconnectEnabled = true;
  private stopHeartbeat: (() => void) | null = null;
  private nextClientErrorLogAllowedAt = 0;
  private reconnectScheduled = false;

  async start(): Promise<void> {
    if (this.isListening) {
      console.log('Notification service already listening');
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
          console.debug('Notification service client connection ended');
        } else {
          console.log('Notification service client connection ended');
        }
        this.handleDisconnect();
      });

      await this.client.connect();
      console.log('Notification service connected to database');

      await this.client.query('LISTEN new_activity');
      console.log('Notification service listening on channel: new_activity');

      this.client.on('notification', (msg) => {
        if (msg.channel === 'new_activity' && msg.payload) {
          try {
            const notification: Notification = JSON.parse(msg.payload);
            this.emit('notification', notification);
          } catch (err) {
            console.error('Error parsing notification payload:', err);
          }
        }
      });

      this.stopHeartbeat?.();
      this.stopHeartbeat = startPgListenHeartbeat(this.client);

      this.isListening = true;
      this.reconnectAttempts = 0;
      this.hasHadSuccessfulListen = true;
    } catch (err) {
      console.error('Failed to start notification service:', err);
      this.handleDisconnect();
    }
  }

  private logClientError(err: unknown): void {
    const now = Date.now();
    if (!this.hasHadSuccessfulListen || process.env.NODE_ENV === 'production') {
      console.error('Notification service client error:', err);
      return;
    }
    if (now >= this.nextClientErrorLogAllowedAt) {
      console.debug('Notification service client error:', err);
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
    const msg = `Attempting to reconnect notification service in ${delay}ms (attempt ${this.reconnectAttempts})`;
    if (process.env.NODE_ENV !== 'production' && this.hasHadSuccessfulListen) {
      console.debug(msg);
    } else {
      console.log(msg);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectScheduled = false;
      this.start().catch((err) => {
        console.error('Reconnection attempt failed:', err);
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
        await this.client.query('UNLISTEN new_activity');
        await this.client.end();
      } catch (err) {
        console.error('Error stopping notification service:', err);
      }
      this.client = null;
    }

    this.isListening = false;
    this.removeAllListeners();
    console.log('Notification service stopped');
  }

  isActive(): boolean {
    return this.isListening && this.client !== null;
  }
}

// Singleton instance
export const notificationService = new NotificationService();

// Graceful shutdown
process.on('SIGINT', async () => {
  await notificationService.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await notificationService.stop();
  process.exit(0);
});
