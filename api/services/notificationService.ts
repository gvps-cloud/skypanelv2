import { Client } from 'pg';
import { EventEmitter } from 'events';
import { config } from '../config/index.js';
import { getLongLivedPgClientConfig } from '../lib/database.js';

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

class NotificationService extends EventEmitter {
  private client: Client | null = null;
  private isListening = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  /** After at least one successful LISTEN, downgrade reconnect chatter in development. */
  private hasHadSuccessfulListen = false;

  async start(): Promise<void> {
    if (this.isListening) {
      console.log('Notification service already listening');
      return;
    }

    try {
      const connectionString = config.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
      }

      this.client = new Client(getLongLivedPgClientConfig(connectionString));

      this.client.on('error', (err) => {
        console.error('Notification service client error:', err);
        this.handleDisconnect();
      });

      this.client.on('end', () => {
        console.log('Notification service client connection ended');
        this.handleDisconnect();
      });

      await this.client.connect();
      console.log('Notification service connected to database');

      // Listen for new activity notifications
      await this.client.query('LISTEN new_activity');
      console.log('Notification service listening on channel: new_activity');

      this.client.on('notification', (msg) => {
        if (msg.channel === 'new_activity' && msg.payload) {
          try {
            const notification: Notification = JSON.parse(msg.payload);
            // Emit event for SSE clients listening for this user
            this.emit('notification', notification);
          } catch (err) {
            console.error('Error parsing notification payload:', err);
          }
        }
      });

      this.isListening = true;
      this.reconnectAttempts = 0;
      this.hasHadSuccessfulListen = true;
    } catch (err) {
      console.error('Failed to start notification service:', err);
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    this.isListening = false;

    if (this.client) {
      this.client.removeAllListeners();
      this.client.end().catch(() => {});
      this.client = null;
    }

    // Attempt to reconnect with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      const msg =
        `Attempting to reconnect notification service in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
      if (process.env.NODE_ENV !== 'production' && this.hasHadSuccessfulListen) {
        console.debug(msg);
      } else {
        console.log(msg);
      }
      
      this.reconnectTimer = setTimeout(() => {
        this.start().catch(err => {
          console.error('Reconnection attempt failed:', err);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached for notification service');
    }
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
