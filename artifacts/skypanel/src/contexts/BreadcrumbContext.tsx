import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DynamicBreadcrumbOverride } from '@/lib/breadcrumbs';

interface BreadcrumbContextType {
  dynamicOverrides: DynamicBreadcrumbOverride[];
  setDynamicOverride: (path: string, label: string) => void;
  removeDynamicOverride: (path: string) => void;
  clearDynamicOverrides: () => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useBreadcrumb = () => {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
  }
  return context;
};

interface BreadcrumbProviderProps {
  children: ReactNode;
}

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({ children }) => {
  const [dynamicOverrides, setDynamicOverrides] = useState<DynamicBreadcrumbOverride[]>([]);

  const setDynamicOverride = useCallback((path: string, label: string) => {
    setDynamicOverrides(prev => {
      const filtered = prev.filter(override => override.path !== path);
      return [...filtered, { path, label }];
    });
  }, []);

  const removeDynamicOverride = useCallback((path: string) => {
    setDynamicOverrides(prev => prev.filter(override => override.path !== path));
  }, []);

  const clearDynamicOverrides = useCallback(() => {
    setDynamicOverrides([]);
  }, []);

  return (
    <BreadcrumbContext.Provider
      value={{
        dynamicOverrides,
        setDynamicOverride,
        removeDynamicOverride,
        clearDynamicOverrides,
      }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
};