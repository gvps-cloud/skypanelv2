import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { useTheme as useSiteTheme } from '@/hooks/useTheme';
import { API_BASE_URL, buildApiUrl } from '../../lib/api';
import {
  resolveTerminalTheme,
  sanitizeTerminalThemePreference,
  SSH_TERMINAL_THEME_STORAGE_KEY,
  TERMINAL_THEMES,
  type TerminalThemePreference,
} from '@/components/VPS/sshTerminalThemes';

const DEFAULT_ROWS = 30;
const DEFAULT_COLS = 120;
const FULLSCREEN_ROWS = 50;
const FULLSCREEN_COLS = 150;
const INITIAL_FONT_SIZE = 14;

interface SSHTerminalProps {
  instanceId: string;
  isFullScreen?: boolean;
  fitContainer?: boolean;
}

type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const SSHTerminal: React.FC<SSHTerminalProps> = ({ instanceId, isFullScreen = false, fitContainer = false }) => {
  const { theme: siteTheme } = useSiteTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [fontSize, setFontSize] = useState<number>(INITIAL_FONT_SIZE);
  const initialRows = useRef(isFullScreen ? FULLSCREEN_ROWS : DEFAULT_ROWS);
  const initialCols = useRef(isFullScreen ? FULLSCREEN_COLS : DEFAULT_COLS);
  const [rows, setRows] = useState<number>(initialRows.current);
  const [cols, setCols] = useState<number>(initialCols.current);
  const [connectedUser, setConnectedUser] = useState<string>('root');
  const [sessionLog, setSessionLog] = useState<string>('');
  const [themePreference, setThemePreference] = useState<TerminalThemePreference>(() => {
    if (typeof window === 'undefined') {
      return 'auto';
    }

    return sanitizeTerminalThemePreference(
      window.localStorage.getItem(SSH_TERMINAL_THEME_STORAGE_KEY),
    );
  });
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const rowsRef = useRef(rows);
  const colsRef = useRef(cols);
  const resolvedTheme = useMemo(
    () => resolveTerminalTheme(themePreference, siteTheme),
    [siteTheme, themePreference],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      SSH_TERMINAL_THEME_STORAGE_KEY,
      themePreference,
    );
  }, [themePreference]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  // Initialize the terminal
  useEffect(() => {
    if (containerRef.current && !termRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: INITIAL_FONT_SIZE,
        rows: initialRows.current,
        cols: initialCols.current,
        theme: TERMINAL_THEMES[resolvedTheme],
        allowTransparency: true,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      });
      const fitAddon = new FitAddon();
      const webLinks = new WebLinksAddon();
      const searchAddon = new SearchAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(webLinks);
      term.loadAddon(searchAddon);
      term.open(containerRef.current);
      term.focus();
      fitAddon.fit();
      termRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      const resizeObserver = new ResizeObserver(() => {
        // Debounce resize to avoid excessive calls
        setTimeout(() => {
          fitAddon.fit();
          const newCols = term.cols;
          const newRows = term.rows;

          if (newCols && newRows) {
            // Only update if dimensions actually changed
            if (newCols !== colsRef.current || newRows !== rowsRef.current) {
              setCols(newCols);
              setRows(newRows);
              colsRef.current = newCols;
              rowsRef.current = newRows;

              // Notify backend of size change
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'resize',
                  rows: newRows,
                  cols: newCols
                }));
              }
            }
          }
        }, 100);
      });
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;
      return () => {
        resizeObserver.disconnect();
        resizeObserverRef.current = null;
      };
    }
  }, [resolvedTheme]);

  // Update theme when changed
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = TERMINAL_THEMES[resolvedTheme];
    }
  }, [resolvedTheme]);

  // Update terminal size when layout constraints change
  useEffect(() => {
    if (termRef.current && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [isFullScreen, fitContainer]);

  const write = useCallback((data: string) => {
    termRef.current?.write(data);
    setSessionLog(prev => prev + data);
  }, []);

  const connect = useCallback((isReconnect = false) => {
    if (status === 'connecting' || status === 'connected') return;
    const token = localStorage.getItem('auth_token') ?? '';

    let wsUrl: string;
    try {
      const httpTarget = buildApiUrl(`/vps/${instanceId}/ssh`, API_BASE_URL);
      const url = new URL(httpTarget, window.location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('token', token);
      url.searchParams.set('rows', String(rows));
      url.searchParams.set('cols', String(cols));
      wsUrl = url.toString();
    } catch (err) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/vps/${instanceId}/ssh?token=${encodeURIComponent(token)}&rows=${rows}&cols=${cols}`;
      console.warn('Falling back to window-based WebSocket URL due to error constructing URL:', err);
    }

    try {
      console.log('Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        setStatus('connected');
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
        setStatus('disconnected');
        wsRef.current = null;
        
        // Auto-reconnect logic
        if (!event.wasClean && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect(true);
          }, delay);
        }
      };
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
        write('\r\n\x1b[31mWebSocket connection error\x1b[0m\r\n');
      };

      // Pipe terminal input to WS
      termRef.current?.onData((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data }));
        }
      });
    } catch (err) {
      setStatus('error');
      write(`\r\n\x1b[31mFailed to connect:\x1b[0m ${(err as Error).message}\r\n`);
    }
  }, [instanceId, rows, cols, connectedUser, status, write, reconnectAttempts]);

  const disconnect = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    setStatus('disconnected');
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
              <Select
                value={themePreference}
                onValueChange={(value) =>
                  setThemePreference(sanitizeTerminalThemePreference(value))
                }
              >
                <SelectTrigger className="h-8 w-[170px] rounded-full border-border/70 bg-background/80 text-xs">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Auto ({resolvedTheme === 'matrix' ? 'Matrix' : 'Light'})
                  </SelectItem>
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
            style={{ backgroundColor: TERMINAL_THEMES[resolvedTheme].background }}
          />

          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-5 py-3 text-xs text-muted-foreground shrink-0">
            <div className="flex flex-wrap gap-4">
              <span>💡 Tips:</span>
              <span>• Select text and click Copy to copy</span>
              <span>• Use Search button to find text</span>
              <span>• Download saves your session log</span>
              <span>• Auto follows the site light/dark mode</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SSHTerminal;
