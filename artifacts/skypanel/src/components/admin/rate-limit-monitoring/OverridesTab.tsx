import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { RateLimitOverrideSummary, OverrideFormState } from './types';
import { formatWindowMinutes, formatDateTime, formatNumber } from './utils';

interface OverridesTabProps {
  overrides: RateLimitOverrideSummary[];
  overridesLoading: boolean;
  activeOverrides: number;
  defaultOverrideLimit: number;
  defaultOverrideWindow: number;
  overrideDialogOpen: boolean;
  selectedOverride: RateLimitOverrideSummary | null;
  overrideForm: OverrideFormState;
  setOverrideForm: React.Dispatch<React.SetStateAction<OverrideFormState>>;
  savingOverride: boolean;
  deletingOverrideId: string | null;
  onRefreshOverrides: () => void;
  onOpenOverrideDialog: (override?: RateLimitOverrideSummary) => void;
  onCloseOverrideDialog: () => void;
  onOverrideSubmit: () => void;
  onDeleteOverride: (override: RateLimitOverrideSummary) => void;
}

export function OverridesTab({
  overrides,
  overridesLoading,
  activeOverrides,
  defaultOverrideLimit,
  defaultOverrideWindow,
  overrideDialogOpen,
  selectedOverride,
  overrideForm,
  setOverrideForm,
  savingOverride,
  deletingOverrideId,
  onRefreshOverrides,
  onOpenOverrideDialog,
  onCloseOverrideDialog,
  onOverrideSubmit,
  onDeleteOverride,
}: OverridesTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Override Management</CardTitle>
          <CardDescription>Grant elevated rate limits to trusted or high-volume users.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Active overrides: <span className="font-medium text-foreground">{activeOverrides}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Default authenticated policy: {formatNumber(defaultOverrideLimit)} requests /{' '}
              {defaultOverrideWindow} minutes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void onRefreshOverrides();
              }}
              disabled={overridesLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${overridesLoading ? 'animate-spin' : ''}`} />
              Refresh Overrides
            </Button>
            <Button size="sm" onClick={() => onOpenOverrideDialog()}>
              New Override
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Overrides</CardTitle>
          <CardDescription>Users currently operating under custom rate limits</CardDescription>
        </CardHeader>
        <CardContent>
          {overridesLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Loading overrides...
            </div>
          ) : overrides.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No active overrides. All users are using the global configuration.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Max Requests</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {override.userName ? `${override.userName}` : override.userEmail}
                        </span>
                        {override.userName && (
                          <span className="text-xs text-muted-foreground">{override.userEmail}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatNumber(override.maxRequests)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatWindowMinutes(override.windowMs)} min
                    </TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {override.reason ? override.reason : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{formatDateTime(override.expiresAt)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{formatDateTime(override.createdAt)}</span>
                        {override.createdByEmail && (
                          <span className="text-xs text-muted-foreground">
                            by {override.createdByName ?? override.createdByEmail}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => onOpenOverrideDialog(override)}>
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                              disabled={deletingOverrideId === override.id}
                            >
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove override</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will revert {override.userEmail} to the default rate limit policy.
                                Continue?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  void onDeleteOverride(override);
                                }}
                                disabled={deletingOverrideId === override.id}
                              >
                                {deletingOverrideId === override.id ? 'Removing...' : 'Confirm'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            onCloseOverrideDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedOverride ? 'Edit Rate Limit Override' : 'New Rate Limit Override'}
            </DialogTitle>
            <DialogDescription>
              {selectedOverride
                ? 'Adjust the request budget for this user. Changes take effect immediately.'
                : 'Provide the user email and desired request budget to grant additional capacity.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onOverrideSubmit();
            }}
          >
            {!selectedOverride && (
              <div className="space-y-2">
                <Label htmlFor="override-email">User Email</Label>
                <Input
                  id="override-email"
                  type="email"
                  placeholder="user@example.com"
                  value={overrideForm.email}
                  onChange={(event) =>
                    setOverrideForm((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter the email address associated with the user's SkyPanel account.
                </p>
              </div>
            )}

            {selectedOverride && (
              <div className="space-y-1">
                <Label>User</Label>
                <p className="text-sm font-medium text-foreground">
                  {selectedOverride.userName
                    ? `${selectedOverride.userName} (${selectedOverride.userEmail})`
                    : selectedOverride.userEmail}
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="override-max">Max Requests</Label>
                <Input
                  id="override-max"
                  type="number"
                  min={1}
                  step={1}
                  value={overrideForm.maxRequests}
                  onChange={(event) =>
                    setOverrideForm((previous) => ({
                      ...previous,
                      maxRequests: Number(event.target.value),
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="override-window">Window (minutes)</Label>
                <Input
                  id="override-window"
                  type="number"
                  min={1}
                  step={1}
                  value={overrideForm.windowMinutes}
                  onChange={(event) =>
                    setOverrideForm((previous) => ({
                      ...previous,
                      windowMinutes: Number(event.target.value),
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason (optional)</Label>
              <Textarea
                id="override-reason"
                placeholder="Document why this override is needed..."
                value={overrideForm.reason}
                onChange={(event) =>
                  setOverrideForm((previous) => ({
                    ...previous,
                    reason: event.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="override-expires">Expires At (optional)</Label>
              <Input
                id="override-expires"
                type="datetime-local"
                value={overrideForm.expiresAt}
                onChange={(event) =>
                  setOverrideForm((previous) => ({
                    ...previous,
                    expiresAt: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the override active until it is manually removed.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCloseOverrideDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingOverride}>
                {savingOverride ? 'Saving...' : 'Save Override'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}