import { Client } from 'pg';
import { EventEmitter } from 'events';

export interface TicketNotificationPayload {
  ticket_id: string;
  [key: string]: unknown;
}

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
  private readonly maxReconnectAttempts = 10;

  async start(): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
      }

      this.client = new Client({ connectionString });

      this.client.on('error', (err) => {
        console.error('TicketNotificationService client error:', err);
        this.handleDisconnect();
      });

      this.client.on('end', () => {
        console.log('TicketNotificationService client connection ended');
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

      this.isListening = true;
      this.reconnectAttempts = 0;
    } catch (err) {
      console.error('Failed to start TicketNotificationService:', err);
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

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      console.log(
        `TicketNotificationService reconnecting in ${delay}ms ` +
        `(attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
      this.reconnectTimer = setTimeout(() => {
        this.start().catch((err) => {
          console.error('TicketNotificationService reconnection attempt failed:', err);
        });
      }, delay);
    } else {
      console.error('TicketNotificationService: max reconnection attempts reached');
    }
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
