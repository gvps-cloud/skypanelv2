import { apiClient, API_BASE_URL } from '@/lib/api';

type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SshHttpTransportOptions {
  instanceId: string;
  rows: number;
  cols: number;
  onOutput: (data: string) => void;
  onStatus: (message: string) => void;
  onConnected: () => void;
  onError: (message: string) => void;
  onClose: (message: string) => void;
}

export class SshHttpTransport {
  private instanceId: string;
  private rows: number;
  private cols: number;
  private sessionId: string | null = null;
  private eventSource: EventSource | null = null;
  private onOutput: (data: string) => void;
  private onStatus: (message: string) => void;
  private onConnected: () => void;
  private onError: (message: string) => void;
  private onClose: (message: string) => void;
  private status: TransportStatus = 'disconnected';
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(options: SshHttpTransportOptions) {
    this.instanceId = options.instanceId;
    this.rows = options.rows;
    this.cols = options.cols;
    this.onOutput = options.onOutput;
    this.onStatus = options.onStatus;
    this.onConnected = options.onConnected;
    this.onError = options.onError;
    this.onClose = options.onClose;
  }

  async connect(): Promise<void> {
    if (this.disposed) return;
    this.status = 'connecting';

    try {
      const result = await apiClient.post<{ sessionId: string; status: string }>(
        `/vps/${encodeURIComponent(this.instanceId)}/ssh/connect`,
        { rows: this.rows, cols: this.cols },
      );

      if (!result.sessionId) {
        throw new Error(result.status || 'Failed to create SSH session');
      }

      this.sessionId = result.sessionId;
      this.status = 'connected';
      this.onStatus('ssh-ready');
      this.onConnected();
      this.reconnectAttempts = 0;
      this.startStream();
    } catch (err: any) {
      this.status = 'error';
      this.onError(err.message || 'Failed to connect');
    }
  }

  private startStream(): void {
    if (!this.sessionId || this.disposed) return;

    const streamUrl = `${API_BASE_URL}/vps/${encodeURIComponent(this.instanceId)}/ssh/${this.sessionId}/stream`;
    this.eventSource = new EventSource(streamUrl, { withCredentials: true });

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output') {
          this.onOutput(payload.data);
          this.reconnectAttempts = 0;
        } else if (payload.type === 'connected') {
          this.status = 'connected';
          this.onConnected();
          this.reconnectAttempts = 0;
        } else if (payload.type === 'status') {
          this.onStatus(payload.message);
        } else if (payload.type === 'error') {
          this.onError(payload.message);
        } else if (payload.type === 'close') {
          this.onClose(payload.message || 'Session closed');
          this.disconnect();
        }
      } catch {}
    };

    this.eventSource.onerror = () => {
      if (this.disposed) return;
      this.eventSource?.close();
      this.eventSource = null;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.startStream();
        }, delay);
      } else {
        this.onError('SSE stream connection lost');
      }
    };
  }

  async sendInput(data: string): Promise<void> {
    if (!this.sessionId || this.disposed) return;
    try {
      await apiClient.post(
        `/vps/${encodeURIComponent(this.instanceId)}/ssh/${this.sessionId}/input`,
        { type: 'input', data },
      );
    } catch {}
  }

  async resize(rows: number, cols: number): Promise<void> {
    if (!this.sessionId || this.disposed) return;
    this.rows = rows;
    this.cols = cols;
    try {
      await apiClient.post(
        `/vps/${encodeURIComponent(this.instanceId)}/ssh/${this.sessionId}/resize`,
        { rows, cols },
      );
    } catch {}
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.sessionId) {
      apiClient
        .post(
          `/vps/${encodeURIComponent(this.instanceId)}/ssh/${this.sessionId}/disconnect`,
        )
        .catch(() => {});
      this.sessionId = null;
    }
    this.status = 'disconnected';
  }

  getStatus(): TransportStatus {
    return this.status;
  }
}