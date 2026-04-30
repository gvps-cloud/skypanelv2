/**
 * SSHKeyAccordionSelect Component
 *
 * A dropdown with multi-select checkboxes for SSH keys.
 */

import { useMemo, useState } from 'react';
import { Search, Check, ChevronDown, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SSHKey {
  id: number;
  label: string;
  ssh_key: string;
  created: string;
}

interface SSHKeyAccordionSelectProps {
  sshKeys: SSHKey[];
  selectedKeyIds: string[];
  onKeyToggle: (keyId: number) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * SSHKeyAccordionSelect Component
 *
 * Displays SSH keys in a dropdown with checkboxes for multi-selection.
 *
 * Features:
 * - Search by key label
 * - Checkboxes for multi-selection
 * - Selected keys shown below dropdown
 * - Loading and error states
 */
export function SSHKeyAccordionSelect({
  sshKeys,
  selectedKeyIds,
  onKeyToggle,
  loading = false,
  error = null,
  disabled = false,
  className,
}: SSHKeyAccordionSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter keys based on search
  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) {
      return sshKeys;
    }
    const query = searchQuery.toLowerCase();
    return sshKeys.filter(
      (key) =>
        key.label.toLowerCase().includes(query) ||
        key.ssh_key.toLowerCase().includes(query)
    );
  }, [sshKeys, searchQuery]);

  // Get selected keys for display
  const selectedKeys = useMemo(() => {
    return sshKeys.filter((key) => selectedKeyIds.includes(String(key.id)));
  }, [sshKeys, selectedKeyIds]);

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">
            SSH Keys (Optional)
          </label>
        </div>
        <div className="flex items-center justify-center py-4 space-x-2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading SSH keys...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">
            SSH Keys (Optional)
          </label>
        </div>
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {error}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            SSH keys are optional. You can continue without them.
          </p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (sshKeys.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">
            SSH Keys (Optional)
          </label>
        </div>
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No SSH keys found. You can add SSH keys in the SSH Keys page.
          </p>
        </div>
      </div>
    );
  }

  // Trigger button content
  const triggerContent = selectedKeys.length > 0
    ? `${selectedKeys.length} key${selectedKeys.length > 1 ? 's' : ''} selected`
    : 'Select SSH keys...';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">
          SSH Keys (Optional)
        </label>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className="truncate">{triggerContent}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="max-h-80 overflow-y-auto">
            {/* Search Input */}
            <div className="p-3 border-b sticky top-0 bg-background z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search SSH keys..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* SSH Keys with checkboxes */}
            {filteredKeys.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No SSH keys found matching "{searchQuery}"
              </div>
            ) : (
              <div className="border-b border-border last:border-b-0">
                {filteredKeys.map((key) => {
                  const isSelected = selectedKeyIds.includes(String(key.id));

                  return (
                    <button
                      key={key.id}
                      type="button"
                      onClick={() => onKeyToggle(key.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0",
                        isSelected && "bg-primary/10"
                      )}
                    >
                      <div className="flex-shrink-0">
                        <div className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-border bg-background"
                        )}>
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {key.label}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {key.ssh_key.substring(0, 50)}...
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Show selected keys below */}
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedKeys.map((key) => (
            <span
              key={key.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border/70 bg-muted/40 text-xs"
            >
              <Key className="h-3 w-3" />
              {key.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default SSHKeyAccordionSelect;
