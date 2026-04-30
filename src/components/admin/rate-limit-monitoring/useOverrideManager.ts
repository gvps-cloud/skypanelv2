import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import type { RateLimitOverrideSummary, OverrideFormState } from './types';
import { formatWindowMinutes, toDateTimeLocalInput } from './utils';

export function useOverrideManager(deps: {
  defaultOverrideLimit: number;
  defaultOverrideWindow: number;
  fetchOverrides: () => Promise<void>;
  fetchHealthCheck: () => Promise<void>;
}) {
  const { defaultOverrideLimit, defaultOverrideWindow, fetchOverrides, fetchHealthCheck } = deps;
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<RateLimitOverrideSummary | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    userId: '',
    email: '',
    maxRequests: 0,
    windowMinutes: 15,
    reason: '',
    expiresAt: '',
  });
  const [savingOverride, setSavingOverride] = useState(false);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);

  const closeOverrideDialog = useCallback(() => {
    setOverrideDialogOpen(false);
    setSelectedOverride(null);
    setOverrideForm({
      userId: '',
      email: '',
      maxRequests: defaultOverrideLimit,
      windowMinutes: defaultOverrideWindow,
      reason: '',
      expiresAt: '',
    });
  }, [defaultOverrideLimit, defaultOverrideWindow]);

  const openOverrideDialog = useCallback(
    (override?: RateLimitOverrideSummary) => {
      if (override) {
        setSelectedOverride(override);
        setOverrideForm({
          userId: override.userId,
          email: override.userEmail,
          maxRequests: override.maxRequests,
          windowMinutes: formatWindowMinutes(override.windowMs) || defaultOverrideWindow,
          reason: override.reason ?? '',
          expiresAt: toDateTimeLocalInput(override.expiresAt),
        });
      } else {
        setSelectedOverride(null);
        setOverrideForm({
          userId: '',
          email: '',
          maxRequests: defaultOverrideLimit,
          windowMinutes: defaultOverrideWindow,
          reason: '',
          expiresAt: '',
        });
      }
      setOverrideDialogOpen(true);
    },
    [defaultOverrideLimit, defaultOverrideWindow],
  );

  const handleOverrideSubmit = useCallback(async () => {
    if (!selectedOverride && overrideForm.email.trim().length === 0) {
      toast.error('User email is required to create a new override');
      return;
    }

    if (overrideForm.maxRequests <= 0 || overrideForm.windowMinutes <= 0) {
      toast.error('Max requests and window must be positive values');
      return;
    }

    setSavingOverride(true);
    try {
      const payload: Record<string, unknown> = {
        maxRequests: Number(overrideForm.maxRequests),
        windowMinutes: Number(overrideForm.windowMinutes),
      };

      if (overrideForm.reason.trim().length > 0) {
        payload.reason = overrideForm.reason.trim();
      }

      if (overrideForm.expiresAt) {
        const expiresDate = new Date(overrideForm.expiresAt);
        if (Number.isNaN(expiresDate.getTime())) {
          toast.error('Invalid expiration date');
          setSavingOverride(false);
          return;
        }
        payload.expiresAt = expiresDate.toISOString();
      }

      if (selectedOverride) {
        payload.userId = selectedOverride.userId;
      } else {
        payload.email = overrideForm.email.trim().toLowerCase();
      }

      await apiClient.post('/api/admin/rate-limits/overrides', payload);

      await Promise.all([fetchOverrides(), fetchHealthCheck()]);
      toast.success('Rate limit override saved');
      closeOverrideDialog();
    } catch (error: any) {
      console.error('Failed to save override:', error);
      toast.error(error?.message ?? 'Failed to save override');
    } finally {
      setSavingOverride(false);
    }
  }, [overrideForm, selectedOverride, fetchOverrides, fetchHealthCheck, closeOverrideDialog]);

  const handleDeleteOverride = useCallback(
    async (override: RateLimitOverrideSummary) => {
      setDeletingOverrideId(override.id);
      try {
        await apiClient.delete(`/api/admin/rate-limits/overrides/${override.userId}`);

        await Promise.all([fetchOverrides(), fetchHealthCheck()]);
        toast.success('Rate limit override removed');
      } catch (error: any) {
        console.error('Failed to delete override:', error);
        toast.error(error?.message ?? 'Failed to delete override');
      } finally {
        setDeletingOverrideId(null);
      }
    },
    [fetchOverrides, fetchHealthCheck],
  );

  return {
    overrideDialogOpen,
    selectedOverride,
    overrideForm,
    setOverrideForm,
    savingOverride,
    deletingOverrideId,
    openOverrideDialog,
    closeOverrideDialog,
    handleOverrideSubmit,
    handleDeleteOverride,
  };
}
