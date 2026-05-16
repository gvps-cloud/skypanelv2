import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Terminal as TerminalIcon } from 'lucide-react';
import { buildSshWebSocketUrl } from './sshTerminalUrl';
import { SshHttpTransport } from './sshHttpTransport';

const DEFAULT_ROWS = 30;
const SSH_TRANSPORT_KEY = 'skypanel_ssh_transport';
const DEFAULT_COLS = 120;
const FULLSCREEN_ROWS = 50;
const FULLSCREEN_COLS = 150;
const INITIAL_FONT_SIZE = 14;

const TERMINAL_THEMES: Record<'dark' | 'light' | 'matrix', Terminal['options']['theme']> = {
  dark: {
    background: '#111827',
    foreground: '#e5e7eb',
    cursor: '#93c5fd',
    black: '#000000',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#8b5cf6',
    cyan: '#06b6d4',
    white: '#f3f4f6',
    brightBlack: '#6b7280',
    brightRed: '#f87171',
    brightGreen: '#34d399',
    brightYellow: '#fbbf24',
    brightBlue: '#60a5fa',
    brightMagenta: '#a78bfa',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff',
  },
  light: {
    background: '#ffffff',
    foreground: '#1f2937',
    cursor: '#3b82f6',
    black: '#000000',
    red: '#dc2626',
    green: '#059669',
    yellow: '#d97706',
    blue: '#2563eb',
    magenta: '#7c3aed',
    cyan: '#0891b2',
    white: '#f9fafb',
    brightBlack: '#6b7280',
    brightRed: '#ef4444',
    brightGreen: '#10b981',
    brightYellow: '#f59e0b',
    brightBlue: '#3b82f6',
    brightMagenta: '#8b5cf6',
    brightCyan: '#06b6d4',
    brightWhite: '#ffffff',
  },
  matrix: {
    background: '#000000',
    foreground: '#00ff00',
    cursor: '#00ff00',
    black: '#000000',
    red: '#00ff00',
    green: '#00ff00',
    yellow: '#00ff00',
    blue: '#00ff00',
    magenta: '#00ff00',
    cyan: '#00ff00',
    white: '#00ff00',
    brightBlack: '#006600',
    brightRed: '#00ff00',
    brightGreen: '#00ff00',
    brightYellow: '#00ff00',
    brightBlue: '#00ff00',
    brightMagenta: '#00ff00',
    brightCyan: '#00ff00',
    brightWhite: '#00ff00',
  },
};

interface SSHTerminalProps {
  instanceId: string;
  isFullScreen?: boolean;
  fitContainer?: boolean;
}

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const SSHTerminal: React.FC<SSHTerminalProps> = ({ instanceId, isFullScreen = false, fitContainer = false }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transportModeRef = useRef<'ws' | 'http'>('ws');
  const httpTransportRef = useRef<SshHttpTransport | null>(null);
  const connectHttpRef = useRef<(isReconnect?: boolean) => void>((() => {}));
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [fontSize, setFontSize] = useState<number>(INITIAL_FONT_SIZE);
  const initialRows = useRef(isFullScreen ? FULLSCREEN_ROWS : DEFAULT_ROWS);
  const initialCols = useRef(isFullScreen ? FULLSCREEN_COLS : DEFAULT_COLS);
  const [rows, setRows] = useState<number>(initialRows.current);
  const [cols, setCols] = useState<number>(initialCols.current);
  const [connectedUser, setConnectedUser] = useState<string>('root');
  const [sessionLog, setSessionLog] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'matrix'>('dark');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectAttemptsRef = useRef(reconnectAttempts);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const rowsRef = useRef(rows);
  const colsRef = useRef(cols);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  useEffect(() => {
    reconnectAttemptsRef.current = reconnectAttempts;
  }, [reconnectAttempts]);

  // Initialize the terminal
  useEffect(() => {
    const container = containerRef.current;
    if (!container || termRef.current) return;

    let disposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: INITIAL_FONT_SIZE,
      rows: initialRows.current,
      cols: initialCols.current,
      theme: TERMINAL_THEMES.dark,
      allowTransparency: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });
    const fitAddon = new FitAddon();
    const webLinks = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinks);
    term.loadAddon(searchAddon);
    term.open(container);
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Defer initial fit so the renderer has time to compute dimensions
    requestAnimationFrame(() => {
      if (disposed) return;
      try {
        fitAddon.fit();
      } catch { /* container may still be zero-size */ }
    });

    const handleResize = () => {
      if (disposed) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (disposed) return;
        try {
          fitAddon.fit();
        } catch { /* ignore fit errors during transitions */ }
        const newCols = term.cols;
        const newRows = term.rows;
        if (newCols && newRows) {
if (newCols !== colsRef.current || newRows !== rowsRef.current) {
              setCols(newCols);
              setRows(newRows);
              colsRef.current = newCols;
              rowsRef.current = newRows;
              if (transportModeRef.current === 'http' && httpTransportRef.current) {
                httpTransportRef.current.resize(newRows, newCols);
              } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'resize',
                  rows: newRows,
                  cols: newCols
                }));
              }
          }
        }
      }, 100);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    resizeObserverRef.current = resizeObserver;

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  // Update theme when changed
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = TERMINAL_THEMES[theme];
    }
  }, [theme]);

  // Update terminal size when layout constraints change
  useEffect(() => {
    if (termRef.current && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch { /* ignore fit errors during layout transitions */ }
      }, 100);
    }
  }, [isFullScreen, fitContainer]);

  const write = useCallback((data: string) => {
    termRef.current?.write(data);
    setSessionLog(prev => prev + data);
  }, []);

  const connect = useCallback((isReconnect = false) => {
    if (status === 'connecting' || status === 'connected') return;
    if (!isReconnect) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
    }

    const savedTransport = localStorage.getItem(SSH_TRANSPORT_KEY);
    if (savedTransport === 'http') {
      transportModeRef.current = 'http';
      connectHttpRef.current?.(isReconnect);
      return;
    }

    let wsUrl: string;
    try {
      wsUrl = buildSshWebSocketUrl(instanceId, rows, cols);
    } catch (err) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/vps/${encodeURIComponent(instanceId)}/ssh?rows=${rows}&cols=${cols}`;
      console.warn('Falling back to window-based WebSocket URL due to error constructing URL:', err);
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');
      let opened = false;
      let sawError = false;
      let receivedServerError = false;

      ws.onopen = () => {
        opened = true;
        transportModeRef.current = 'ws';
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setLastActivity(Date.now());
        write(`\r\nConnected as ${connectedUser}@${instanceId}\r\n`);
        
        if (isReconnect) {
          write('\r\n[Terminal reconnected]\r\n');
        }
      };
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'output') {
            write(payload.data);
            setLastActivity(Date.now());
          } else if (payload.type === 'error') {
            receivedServerError = true;
            setStatus('error');
            write(`\r\n\x1b[31mError:\x1b[0m ${payload.message}\r\n`);
          } else if (payload.type === 'status') {
            write(`\r\n[${payload.message}]\r\n`);
          } else if (payload.type === 'connected') {
            // noop
          } else if (payload.type === 'close') {
            write(`\r\n[session closed]\r\n`);
            setStatus('disconnected');
          }
        } catch {
          write(String(evt.data || ''));
        }
      };
      ws.onclose = (event) => {
        const reason = event.reason || (event.code ? `code ${event.code}` : 'connection closed');
        const currentReconnectAttempts = reconnectAttemptsRef.current;
        const shouldAutoReconnect = opened && !event.wasClean && currentReconnectAttempts < 5;

        setStatus(shouldAutoReconnect ? 'connecting' : event.wasClean ? 'disconnected' : 'error');
        wsRef.current = null;

        try {
          inputDisposableRef.current?.dispose();
        } catch {}
        inputDisposableRef.current = null;

        if (!opened) {
          localStorage.setItem(SSH_TRANSPORT_KEY, 'http');
          transportModeRef.current = 'http';
          write(`\r\n\x1b[33mWebSocket unavailable\x1b[0m — switching to HTTP transport...\r\n`);
          connectHttpRef.current?.(isReconnect || false);
          return;
        }

        if (!event.wasClean || sawError || event.code !== 1000) {
          if (receivedServerError) {
            write(`\r\n[WebSocket closed: ${reason}]\r\n`);
          } else {
            write(`\r\n\x1b[31mWebSocket closed\x1b[0m (${reason}).\r\n`);
          }
        }
        
        if (shouldAutoReconnect) {
          const nextAttempt = currentReconnectAttempts + 1;
          const delay = Math.min(1000 * Math.pow(2, currentReconnectAttempts), 30000);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            reconnectAttemptsRef.current = nextAttempt;
            setReconnectAttempts(nextAttempt);
            connect(true);
          }, delay);
        }
      };
      ws.onerror = (error) => {
        sawError = true;
        console.error('WebSocket error:', error);
        setStatus('error');
      };

      // Pipe terminal input to WS
      try {
        inputDisposableRef.current?.dispose();
      } catch {}
      inputDisposableRef.current = termRef.current?.onData((data) => {
        if (transportModeRef.current === 'http' && httpTransportRef.current) {
          httpTransportRef.current.sendInput(data);
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
      }) ?? null;
    } catch (err) {
      setStatus('error');
      write(`\r\n\x1b[31mFailed to connect:\x1b[0m ${(err as Error).message}\r\n`);
    }
  }, [instanceId, rows, cols, connectedUser, status, write]);

  const connectHttp = useCallback((isReconnect = false) => {
    if (status === 'connecting' || status === 'connected') return;
    if (!isReconnect) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
    }

    transportModeRef.current = 'http';

    const transport = new SshHttpTransport({
      instanceId,
      rows: rowsRef.current,
      cols: colsRef.current,
      onOutput: (data) => {
        write(data);
        setLastActivity(Date.now());
      },
      onStatus: (message) => {
        write(`\r\n[${message}]\r\n`);
      },
      onConnected: () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setLastActivity(Date.now());
        write(`\r\nConnected as ${connectedUser}@${instanceId}\r\n`);
        if (isReconnect) {
          write('\r\n[Terminal reconnected]\r\n');
        }
      },
      onError: (message) => {
        setStatus('error');
        write(`\r\n\x1b[31mHTTP transport error:\x1b[0m ${message}\r\n`);
      },
      onClose: (message) => {
        setStatus('disconnected');
        write(`\r\n[session closed${message ? ': ' + message : ''}]\r\n`);
      },
    });

    httpTransportRef.current = transport;
    setStatus('connecting');
    write('\r\n\x1b[33mConnecting via HTTP transport...\x1b[0m\r\n');

    transport.connect();

    try { inputDisposableRef.current?.dispose(); } catch {}
    inputDisposableRef.current = termRef.current?.onData((data) => {
      transport.sendInput(data);
    }) ?? null;
  }, [instanceId, connectedUser, status, write]);

  useEffect(() => {
    connectHttpRef.current = connectHttp;
  }, [connectHttp]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (transportModeRef.current === 'http' && httpTransportRef.current) {
      httpTransportRef.current.disconnect();
      httpTransportRef.current = null;
    }
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      } catch (err) {
        // ignore
      }
      try {
        inputDisposableRef.current?.dispose();
        inputDisposableRef.current = null;
      } catch (err) {
        // ignore
      }
      try {
        if (httpTransportRef.current) {
          httpTransportRef.current.disconnect();
          httpTransportRef.current = null;
        }
      } catch (err) {
        // ignore
      }
      try {
        if (wsRef.current) {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, 'Component unmounted');
          } else {
            wsRef.current.close();
          }
          wsRef.current = null;
        }
      } catch (err) {
        // ignore
      }
      try {
        if (termRef.current) {
          termRef.current.dispose();
          termRef.current = null;
        }
      } catch (err) {}
    };
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const increaseFont = useCallback(() => {
    setFontSize((s) => {
      const next = Math.min(s + 1, 24);
      if (termRef.current?.options) {
        termRef.current.options.fontSize = next;
      }
      fitAddonRef.current?.fit();
      return next;
    });
  }, []);

  const decreaseFont = useCallback(() => {
    setFontSize((s) => {
      const next = Math.max(s - 1, 10);
      if (termRef.current?.options) {
        termRef.current.options.fontSize = next;
      }
      fitAddonRef.current?.fit();
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(async () => {
    try {
      const selection = termRef.current?.getSelection();
      if (selection) {
        await navigator.clipboard.writeText(selection);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch (err) {
      console.error('Failed to paste from clipboard:', err);
    }
  }, []);

  const downloadSessionLog = useCallback(() => {
    const cleanLog = sessionLog.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI codes
    const blob = new Blob([cleanLog], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssh-session-${instanceId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sessionLog, instanceId]);

  const performSearch = useCallback(() => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findNext(searchTerm);
    }
  }, [searchTerm]);

  const clearSearch = useCallback(() => {
    if (searchAddonRef.current) {
      searchAddonRef.current.clearDecorations();
    }
    setSearchTerm('');
    setSearchVisible(false);
  }, []);

  const shouldStretch = isFullScreen || fitContainer;

  const statusLabel = status === 'connected'
    ? `Connected as ${connectedUser}`
    : status === 'connecting'
      ? 'Connecting...'
      : status === 'error'
        ? 'Connection error'
        : reconnectAttempts > 0
          ? `Reconnecting... (${reconnectAttempts}/5)`
          : status.charAt(0).toUpperCase() + status.slice(1);

  const statusBadgeClass = cn(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide',
    {
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-400': status === 'connected',
      'border-amber-500/40 bg-amber-500/10 text-amber-400': status === 'connecting',
      'border-red-500/40 bg-red-500/10 text-red-400': status === 'error',
      'border-muted bg-muted/30 text-muted-foreground': status === 'disconnected',
    }
  );

  const statusDotClass = cn('h-2 w-2 rounded-full', {
    'bg-emerald-500': status === 'connected',
    'bg-amber-400 animate-pulse': status === 'connecting',
    'bg-red-500': status === 'error',
    'bg-muted-foreground': status === 'disconnected',
  });

  const terminalSizeClass = fitContainer
    ? 'h-full min-h-0'
    : isFullScreen
      ? 'min-h-[600px]'
      : 'h-[360px] sm:h-[520px]';

  return (
    <div className={cn('flex flex-col gap-4', shouldStretch && 'flex-1 h-full min-h-0 overflow-hidden')}>
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-xl backdrop-blur',
          shouldStretch && 'h-full min-h-0'
        )}
      >
        <header className="shrink-0 border-b border-border/80 bg-muted/20 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <span className="h-3 w-3 rounded-full bg-[#FDBC2F]" />
                <span className="h-3 w-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TerminalIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">SSH Console</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => connect()}
                size="sm"
                className="rounded-full bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={status === 'connecting' || status === 'connected'}
              >
                Connect
              </Button>
              <Button
                type="button"
                onClick={disconnect}
                size="sm"
                variant="outline"
                className="rounded-full px-4 text-sm"
                disabled={status !== 'connected'}
              >
                Disconnect
              </Button>
              <Select value={theme} onValueChange={(value) => setTheme(value as 'dark' | 'light' | 'matrix')}>
                <SelectTrigger className="h-8 w-[150px] rounded-full border-border/70 bg-background/80 text-xs">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="matrix">Matrix</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <Badge variant="outline" className={statusBadgeClass}>
              <span className={statusDotClass} />
              {statusLabel}
            </Badge>
            {status === 'connected' && (
              <span className="text-xs text-muted-foreground">
                Last activity: {new Date(lastActivity).toLocaleTimeString()}
              </span>
            )}
            <Select value={connectedUser} onValueChange={setConnectedUser}>
              <SelectTrigger className="h-8 w-[140px] rounded-full border-border/70 bg-background/80 text-xs">
                <SelectValue placeholder="SSH user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">root</SelectItem>
                <SelectItem value="ubuntu">ubuntu</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className={cn('flex flex-1 flex-col gap-4 px-6 py-5', shouldStretch && 'min-h-0 overflow-hidden')}>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button type="button" onClick={clear} size="sm" variant="outline" className="rounded-full px-4 text-sm">
              Clear
            </Button>
            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-2 py-1">
              <Button
                type="button"
                onClick={decreaseFont}
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full"
              >
                A-
              </Button>
              <span className="px-2 text-xs font-medium text-muted-foreground">{fontSize}px</span>
              <Button
                type="button"
                onClick={increaseFont}
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-full"
              >
                A+
              </Button>
            </div>
            <Button type="button" onClick={copyToClipboard} size="sm" variant="secondary" className="rounded-full px-4 text-sm">
              Copy
            </Button>
            <Button
              type="button"
              onClick={pasteFromClipboard}
              size="sm"
              variant="secondary"
              className="rounded-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status !== 'connected'}
            >
              Paste
            </Button>
            <Button
              type="button"
              onClick={() => setSearchVisible((value) => !value)}
              size="sm"
              variant={searchVisible ? 'default' : 'outline'}
              className="rounded-full px-4 text-sm"
            >
              Search
            </Button>
            <Button
              type="button"
              onClick={downloadSessionLog}
              size="sm"
              className="rounded-full bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!sessionLog}
            >
              Download
            </Button>
          </div>

          {searchVisible && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 shrink-0">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                placeholder="Search in terminal..."
                className="flex-1 min-w-[200px] rounded-lg border-border/70 bg-background/80 text-sm"
              />
              <Button type="button" onClick={performSearch} size="sm" className="rounded-full px-4 text-sm" disabled={!searchTerm}>
                Find
              </Button>
              <Button type="button" onClick={clearSearch} size="sm" variant="outline" className="rounded-full px-4 text-sm">
                Clear
              </Button>
            </div>
          )}

          <div
            ref={containerRef}
            className={cn(
              'flex-1 w-full overflow-hidden rounded-2xl border border-border/80 bg-black/90 shadow-inner',
              terminalSizeClass
            )}
            style={{ backgroundColor: TERMINAL_THEMES[theme].background }}
          />

          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-5 py-3 text-xs text-muted-foreground shrink-0">
            <div className="flex flex-wrap gap-4">
              <span>💡 Tips:</span>
              <span>• Select text and click Copy to copy</span>
              <span>• Use Search button to find text</span>
              <span>• Download saves your session log</span>
              <span>• Try different themes for better visibility</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SSHTerminal;
