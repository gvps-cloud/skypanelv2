import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { buildApiUrl } from "@/lib/api";
import {
  DEFAULT_THEME_ID,
  ThemeId,
  ThemePreset,
  themePresets,
  ThemeVariables,
} from "@/theme/presets";

interface ThemeConfigPayload {
  presetId?: string;
  customPreset?: ThemePresetLike | null;
}

interface ThemePresetLike {
  id?: string;
  label?: string;
  description?: string;
  light?: Record<string, unknown>;
  dark?: Record<string, unknown>;
}

interface ThemeContextValue {
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  themes: ThemePreset[];
  reloadTheme: () => Promise<void>;
  customPreset: ThemePreset | null;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "skypanelv2:theme";
const STYLE_ELEMENT_ID = "skypanelv2-theme-style";
const BASE_THEME_IDS = new Set(themePresets.map((preset) => preset.id));

const serializeVariables = (vars: ThemeVariables): string =>
  Object.entries(vars)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");

const ensureStyleElement = (): HTMLStyleElement | null => {
  if (typeof document === "undefined") {
    return null;
  }

  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ELEMENT_ID;
    styleEl.setAttribute("data-managed-by", "ThemeContext");
    document.head.appendChild(styleEl);
  }

  return styleEl;
};

const applyTheme = (preset: ThemePreset) => {
  if (typeof document === "undefined") {
    return;
  }

  const styleEl = ensureStyleElement();
  if (!styleEl) {
    return;
  }

  const lightBlock = serializeVariables(preset.light);
  const darkBlock = serializeVariables(preset.dark);

  styleEl.textContent = `:root {\n${lightBlock}\n}\n:root.dark, .dark {\n${darkBlock}\n}`;
  document.documentElement.dataset.theme = preset.id;
};

const getStoredTheme = (): ThemeId | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  if (stored === "custom") {
    return "custom";
  }

  return themePresets.some((preset) => preset.id === stored)
    ? (stored as ThemeId)
    : null;
};

const sanitizeThemePreset = (preset: ThemePresetLike | null | undefined): ThemePreset | null => {
  if (!preset) {
    return null;
  }

  const label = typeof preset.label === "string" && preset.label.trim().length > 0
    ? preset.label.trim()
    : "Custom Theme";

  const description = typeof preset.description === "string"
    ? preset.description
    : "User-defined theme preset.";

  const sanitizeVariables = (vars: Record<string, unknown> | undefined): ThemeVariables => {
    if (!vars) {
      return {};
    }
    const entries: [string, string][] = [];
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === "string") {
        entries.push([key, value]);
      }
    }
    return Object.fromEntries(entries);
  };

  const light = sanitizeVariables(preset.light);
  const dark = sanitizeVariables(preset.dark);

  if (Object.keys(light).length === 0 || Object.keys(dark).length === 0) {
    return null;
  }

  return {
    id: "custom",
    label,
    description,
    light,
    dark,
  };
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeId, setThemeId] = useState<ThemeId>(() => getStoredTheme() ?? DEFAULT_THEME_ID);
  const [customPreset, setCustomPreset] = useState<ThemePreset | null>(null);

  const themes = useMemo<ThemePreset[]>(() => {
    if (!customPreset) {
      return themePresets;
    }
    const withoutDuplicate = themePresets.filter((preset) => preset.id !== customPreset.id);
    return [...withoutDuplicate, customPreset];
  }, [customPreset]);

  const activePreset = useMemo<ThemePreset>(() => {
    const found = themes.find((item) => item.id === themeId);
    return found ?? themes[0];
  }, [themes, themeId]);

  useLayoutEffect(() => {
    applyTheme(activePreset);
  }, [activePreset]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, activePreset.id);
  }, [activePreset.id]);

  // Note: Light/dark mode is handled by the local useTheme hook
  // This context only manages theme presets and colors

  const handleSetTheme = useCallback((next: ThemeId) => {
    setThemeId(next);
  }, []);

  const applyRemoteConfig = useCallback((config: ThemeConfigPayload | null | undefined) => {
    const remoteCustom = sanitizeThemePreset(config?.customPreset);
    setCustomPreset(remoteCustom);

    const remotePresetId = typeof config?.presetId === "string" ? config?.presetId : undefined;

    if (remotePresetId === "custom" && remoteCustom) {
      setThemeId("custom");
      return;
    }

    if (remotePresetId && BASE_THEME_IDS.has(remotePresetId as ThemeId)) {
      setThemeId(remotePresetId as ThemeId);
      return;
    }

    if (remoteCustom) {
      setThemeId("custom");
      return;
    }

    setThemeId((current) => (BASE_THEME_IDS.has(current) ? current : DEFAULT_THEME_ID));
  }, []);

  const fetchThemeConfig = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const response = await fetch(buildApiUrl('/theme'));
      if (!response.ok) {
        throw new Error(`Failed to load theme configuration: ${response.status}`);
      }
      const payload = await response.json();
      const config: ThemeConfigPayload | null = payload?.theme ?? null;
      applyRemoteConfig(config);
    } catch (error) {
      console.warn('Theme config fetch failed:', error);
    }
  }, [applyRemoteConfig]);

  useEffect(() => {
    fetchThemeConfig();
  }, [fetchThemeConfig]);

  const reloadTheme = useCallback(async () => {
    await fetchThemeConfig();
  }, [fetchThemeConfig]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId: activePreset.id,
      setTheme: handleSetTheme,
      themes,
      reloadTheme,
      customPreset,
    }),
    [activePreset.id, handleSetTheme, themes, reloadTheme, customPreset]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
