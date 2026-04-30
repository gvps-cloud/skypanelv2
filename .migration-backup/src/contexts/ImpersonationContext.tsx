/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  clearImpersonationSessionStorage,
  getStoredImpersonationSession,
  persistImpersonationSession,
} from '@/lib/impersonationSession';
import { apiClient } from '@/lib/api';

interface ImpersonatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId?: string;
}

interface OriginalAdmin {
  id: string;
  email: string;
  name: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  originalAdmin: OriginalAdmin | null;
  impersonationToken: string | null;
  expiresAt: string | null;
}

interface ImpersonationContextType extends ImpersonationState {
  startImpersonation: (
    targetUserId: string,
    confirmAdminImpersonation?: boolean
  ) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  clearImpersonation: () => void;
  isExiting: boolean;
  isStarting: boolean;
  startingProgress: number;
  startingMessage: string;
  startingTargetUser: ImpersonatedUser | null;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    impersonatedUser: null,
    originalAdmin: null,
    impersonationToken: null,
    expiresAt: null,
  });
  
  const [isExiting, setIsExiting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startingProgress, setStartingProgress] = useState(0);
  const [startingMessage, setStartingMessage] = useState('');
  const [startingTargetUser, setStartingTargetUser] = useState<ImpersonatedUser | null>(null);

  // Initialize impersonation state from localStorage on mount
  useEffect(() => {
    const storedSession = getStoredImpersonationSession();

    if (storedSession) {
      setState({
        isImpersonating: true,
        impersonatedUser: {
          id: storedSession.user.id,
          name: storedSession.user.name || (storedSession.user.firstName ? `${storedSession.user.firstName} ${storedSession.user.lastName || ''}`.trim() : storedSession.user.email),
          email: storedSession.user.email,
          role: storedSession.user.role,
          organizationId: storedSession.user.organizationId
        },
        originalAdmin: {
          id: storedSession.originalAdmin.id,
          email: storedSession.originalAdmin.email,
          name: storedSession.originalAdmin.name || storedSession.originalAdmin.email,
        },
        impersonationToken: storedSession.token,
        expiresAt: storedSession.expiresAt,
      });
    }
  }, []);

  const clearImpersonation = useCallback(() => {
    clearImpersonationSessionStorage();
    setState({
      isImpersonating: false,
      impersonatedUser: null,
      originalAdmin: null,
      impersonationToken: null,
      expiresAt: null,
    });
    setIsExiting(false);
    setIsStarting(false);
    setStartingProgress(0);
    setStartingMessage('');
    setStartingTargetUser(null);
  }, []);

  const startImpersonation = useCallback(async (
    targetUserId: string,
    confirmAdminImpersonation = false
  ) => {
    setIsStarting(true);
    setStartingProgress(0);
    setStartingMessage('Validating permissions...');

    try {
      // First, fetch target user details for the loading overlay
      setStartingProgress(10);
      setStartingMessage('Fetching user details...');

      try {
        const userData = await apiClient.get<{ user: { id: string; name: string; email: string; role: string } }>(`/admin/users/${targetUserId}`);
        setStartingTargetUser({
          id: userData.user.id,
          name: userData.user.name,
          email: userData.user.email,
          role: userData.user.role
        });
      } catch (userFetchError) {
        console.warn('Could not fetch user details for loading overlay:', userFetchError);
      }

      // Simulate progress updates
      setStartingProgress(25);
      setStartingMessage('Preparing impersonation session...');

      // Admin auth is sent via HttpOnly cookie (credentials: "include")
      let data;
      try {
        data = await apiClient.post<{ requiresConfirmation?: boolean; targetUser?: any; error?: string; impersonationToken?: string; user?: any; originalAdmin?: any; expiresAt?: string }>(`/admin/users/${targetUserId}/impersonate`, { confirmAdminImpersonation });
      } catch (err: any) {
        if (err?.requiresConfirmation) {
          throw err;
        }
        throw new Error(err?.message || 'Failed to start impersonation');
      }

      setStartingProgress(50);
      setStartingMessage('Processing response...');

      setStartingProgress(75);
      setStartingMessage('Updating session...');

      // Store impersonation session in sessionStorage (not localStorage)
      persistImpersonationSession({
        token: data.impersonationToken,
        user: data.user,
        originalAdmin: data.originalAdmin,
        expiresAt: data.expiresAt,
      });

      // Update impersonation state
      setState({
        isImpersonating: true,
        impersonatedUser: data.user,
        originalAdmin: data.originalAdmin,
        impersonationToken: data.impersonationToken,
        expiresAt: data.expiresAt,
      });

      setStartingProgress(100);
      setStartingMessage('Redirecting...');

      toast.success(`Now acting as ${data.user.name}`);

      // Small delay to show completion
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (error: any) {
      console.error('Impersonation start error:', error);

      if (error.requiresConfirmation) {
        // Store target user info for confirmation dialog
        if (error.targetUser) {
          setStartingTargetUser({
            id: error.targetUser.id,
            name: error.targetUser.name,
            email: error.targetUser.email,
            role: error.targetUser.role
          });
        }
        // Re-throw for the caller to handle confirmation dialog
        throw error;
      }

      toast.error(error.message || 'Failed to start impersonation');
      throw error;
    } finally {
      setIsStarting(false);
      setStartingProgress(0);
      setStartingMessage('');
      setStartingTargetUser(null);
    }
  }, []);

  const exitImpersonation = useCallback(async () => {
    if (!state.isImpersonating || !state.impersonationToken) {
      return;
    }

    setIsExiting(true);

    try {
      const response = await fetch('/api/admin/impersonation/exit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.impersonationToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to exit impersonation');
      }

      // Clear impersonation session from sessionStorage
      clearImpersonationSessionStorage();

      // Clear impersonation state
      setState({
        isImpersonating: false,
        impersonatedUser: null,
        originalAdmin: null,
        impersonationToken: null,
        expiresAt: null,
      });

      toast.success('Returned to admin session');

      // Redirect back to admin panel
      window.location.href = '/admin#user-management';
    } catch (error: any) {
      console.error('Impersonation exit error:', error);
      toast.error(error.message || 'Failed to exit impersonation');

      // On error, still clear local state and redirect to login for safety
      clearImpersonation();
      window.location.href = '/login';
    } finally {
      setIsExiting(false);
    }
  }, [state.isImpersonating, state.impersonationToken, clearImpersonation]);

  const value = {
    ...state,
    startImpersonation,
    exitImpersonation,
    clearImpersonation,
    isExiting,
    isStarting,
    startingProgress,
    startingMessage,
    startingTargetUser,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};
