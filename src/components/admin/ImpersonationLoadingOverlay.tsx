import React, { useMemo } from 'react';
import { BootSequence, type BootLine } from '@/components/fx/BootSequence';
import { ScanlineOverlay } from '@/components/fx/ScanlineOverlay';
import { cn } from '@/lib/utils';

interface ImpersonationLoadingOverlayProps {
  targetUser: {
    name: string;
    email: string;
    role: string;
  };
  progress?: number;
  message?: string;
}

export const ImpersonationLoadingOverlay: React.FC<ImpersonationLoadingOverlayProps> = ({
  targetUser,
  progress = 0,
  message = 'Initializing impersonation...',
}) => {
  const lines = useMemo<BootLine[]>(
    () => [
      { text: `[0.000000] audit: impersonation request — operator session OK`, kind: 'ok' },
      { text: `[0.042891] target: ${targetUser.name} <${targetUser.email}>`, kind: 'info' },
      {
        text: `[0.120004] rbac: applying context (${targetUser.role})`,
        kind: targetUser.role === 'admin' ? 'warn' : 'info',
      },
      { text: `[0.180112] bridge: ${message}`, kind: 'info' },
      {
        text: `[0.240000] progress: ${Math.round(Math.min(100, Math.max(0, progress)))}% — hold`,
        kind: 'ok',
      },
      { text: `[0.300000] audit: all actions will be logged to activity stream`, kind: 'warn' },
    ],
    [targetUser.email, targetUser.name, targetUser.role, message, progress],
  );

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm',
        'font-mono',
      )}
    >
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-sm border border-primary/30 bg-card shadow-lg">
        <ScanlineOverlay className="pointer-events-none opacity-35" />
        <div className="relative z-[1] border-b border-border/80 bg-muted/30 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          [ impersonation — secure channel ]
        </div>
        <div className="relative z-[1] p-5 sm:p-6">
          <BootSequence lines={lines} lineDelayMs={95} />
        </div>
      </div>
    </div>
  );
};
