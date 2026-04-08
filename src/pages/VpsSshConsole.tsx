import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Terminal as TerminalIcon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SSHTerminal from '@/components/VPS/SSHTerminal';
import { useAuth } from '@/contexts/AuthContext';

const decodeLabel = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type AccessState = 'checking' | 'allowed' | 'denied' | 'error';

const VpsSshConsole: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<AccessState>('checking');
  const [retryNonce, setRetryNonce] = useState(0);
  const instanceLabel = decodeLabel(searchParams.get('label'));

  useEffect(() => {
    if (access !== 'allowed') {
      return;
    }
    const previousTitle = document.title;
    document.title = instanceLabel ? `${instanceLabel} · SSH Console` : 'SSH Console';
    return () => {
      document.title = previousTitle;
    };
  }, [access, instanceLabel]);

  useEffect(() => {
    if (!id || !token || authLoading) {
      return;
    }

    let cancelled = false;
    setAccess('checking');

    (async () => {
      try {
        const response = await fetch(`/api/vps/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (response.status === 401) {
          navigate('/login', { replace: true });
          return;
        }

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (cancelled) return;

        const okBody =
          response.ok &&
          payload !== null &&
          typeof payload === 'object' &&
          'instance' in payload &&
          (payload as { instance?: unknown }).instance !== null &&
          typeof (payload as { instance?: unknown }).instance === 'object';

        if (!okBody) {
          setAccess('denied');
          return;
        }

        setAccess('allowed');
      } catch {
        if (!cancelled) {
          setAccess('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, token, authLoading, navigate, retryNonce]);

  const handleClose = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        navigate(-1);
      }
    }, 150);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-sm text-muted-foreground">
        <p>Instance ID unavailable. Close this window and relaunch the SSH console from the dashboard.</p>
        <Button variant="outline" size="sm" onClick={handleClose}>
          Close
        </Button>
      </div>
    );
  }

  if (access === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Unable to open this SSH console.
        </p>
        <Button variant="outline" size="sm" onClick={handleClose}>
          Close
        </Button>
      </div>
    );
  }

  if (access === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Could not verify access. Check your connection and try again.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border/70 bg-card/95 px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <TerminalIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SSH Console</span>
            <span className="text-sm font-semibold text-foreground">{instanceLabel ?? id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reload
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={handleClose}>
            Close Window
          </Button>
        </div>
      </header>
      <main className="flex flex-1 min-h-0 flex-col overflow-hidden p-6">
        <SSHTerminal instanceId={id} isFullScreen fitContainer />
      </main>
    </div>
  );
};

export default VpsSshConsole;
