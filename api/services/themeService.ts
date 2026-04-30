import { query } from '../lib/database.js';
import { themePresets, type ThemeId } from '../../src/theme/presets.ts';

const THEME_KEY = 'theme';
const DEFAULT_THEME_ID = 'mono';
const CUSTOM_THEME_ID = 'custom';

export interface ThemeVariablesMap {
  [key: string]: string;
}

export interface StoredThemePreset {
  id: string;
  label: string;
  description?: string;
  light: ThemeVariablesMap;
  dark: ThemeVariablesMap;
}

export interface ThemeConfig {
  presetId: string;
  customPreset?: StoredThemePreset | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

const presetMap = new Map<ThemeId, (typeof themePresets)[number]>(
  themePresets.map((preset) => [preset.id, preset])
);

const fallbackPreset = presetMap.get(DEFAULT_THEME_ID as ThemeId) ?? themePresets[0];

const formatCssColor = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      if (/^(#|rgb|hsl|var\()/i.test(trimmed)) {
        return trimmed;
      }
      return `hsl(${trimmed})`;
    }
  }
  return fallback;
};

const getPresetVariables = (config: ThemeConfig): ThemeVariablesMap => {
  if (config.customPreset && Object.keys(config.customPreset.light || {}).length > 0) {
    return config.customPreset.light;
  }

  const preset = presetMap.get(config.presetId as ThemeId);
  return preset?.light ?? fallbackPreset.light;
};

const defaultFallbacks: Record<string, string> = {
  background: 'hsl(0 0% 100%)',
  foreground: 'hsl(240 10% 3.9%)',
  card: 'hsl(0 0% 100%)',
  'card-foreground': 'hsl(240 10% 3.9%)',
  muted: 'hsl(240 4.8% 95.9%)',
  'muted-foreground': 'hsl(240 3.8% 46.1%)',
  border: 'hsl(240 5.9% 90%)',
  primary: 'hsl(240 6.5% 16.1%)',
  'primary-foreground': 'hsl(0 0% 98%)',
  secondary: 'hsl(240 4.8% 95.9%)',
  'secondary-foreground': 'hsl(240 6.5% 16.1%)',
  accent: 'hsl(240 4.8% 95.9%)',
  'accent-foreground': 'hsl(240 6.5% 16.1%)',
  destructive: 'hsl(0 84.2% 60.2%)',
  'destructive-foreground': 'hsl(0 0% 98%)',
  ring: 'hsl(240 5.9% 10%)',
};

export interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  ring: string;
}

export const resolveThemePalette = (config: ThemeConfig): ThemePalette => {
  const presetVariables = getPresetVariables(config);
  const fallbackVariables = fallbackPreset.light;

  const pickColor = (key: string): string => {
    const fallbackColor = formatCssColor(
      fallbackVariables[key],
      defaultFallbacks[key] ?? 'hsl(0 0% 0%)'
    );
    return formatCssColor(presetVariables[key], fallbackColor);
  };

  return {
    background: pickColor('background'),
    foreground: pickColor('foreground'),
    card: pickColor('card'),
    cardForeground: pickColor('card-foreground'),
    muted: pickColor('muted'),
    mutedForeground: pickColor('muted-foreground'),
    border: pickColor('border'),
    primary: pickColor('primary'),
    primaryForeground: pickColor('primary-foreground'),
    secondary: pickColor('secondary'),
    secondaryForeground: pickColor('secondary-foreground'),
    accent: pickColor('accent'),
    accentForeground: pickColor('accent-foreground'),
    destructive: pickColor('destructive'),
    destructiveForeground: pickColor('destructive-foreground'),
    ring: pickColor('ring'),
  };
};

const isMissingTableError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as { message?: string }).message?.toLowerCase() ?? '';
  return msg.includes('platform_settings') && msg.includes('does not exist');
};

const sanitizeVariables = (vars: unknown): ThemeVariablesMap => {
  if (!vars || typeof vars !== 'object') {
    return {};
  }

  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(vars as Record<string, unknown>)) {
    if (typeof value === 'string') {
      entries.push([key, value]);
    }
  }
  return Object.fromEntries(entries);
};

const sanitizePreset = (preset: unknown): StoredThemePreset | null => {
  if (!preset || typeof preset !== 'object') {
    return null;
  }

  const base = preset as Partial<StoredThemePreset>;
  const light = sanitizeVariables(base.light);
  const dark = sanitizeVariables(base.dark);

  const label = typeof base.label === 'string' && base.label.trim().length > 0
    ? base.label.trim()
    : 'Custom Theme';

  const description = typeof base.description === 'string'
    ? base.description
    : 'Organization-defined theme preset.';

  if (Object.keys(light).length === 0 || Object.keys(dark).length === 0) {
    return {
      id: CUSTOM_THEME_ID,
      label,
      description,
      light: {
        background: '0 0% 100%',
        foreground: '0 0% 0%',
        primary: '0 0% 0%',
        'primary-foreground': '0 0% 100%'
      },
      dark: {
        background: '0 0% 0%',
        foreground: '0 0% 100%',
        primary: '0 0% 100%',
        'primary-foreground': '0 0% 0%'
      }
    };
  }

  return {
    id: CUSTOM_THEME_ID,
    label,
    description,
    light,
    dark,
  };
};

const mapRowToConfig = (row: Record<string, unknown>): ThemeConfig => {
  const rawValue = row?.value as Record<string, unknown> | undefined;
  const presetId = typeof rawValue?.presetId === 'string' ? rawValue.presetId : DEFAULT_THEME_ID;
  const customPreset = sanitizePreset(rawValue?.customPreset);
  const updatedBy = typeof rawValue?.updatedBy === 'string' ? rawValue.updatedBy : null;
  const rawUpdatedAt = row ? (row['updated_at'] as string | Date | undefined) : undefined;
  const updatedAt = rawUpdatedAt ? new Date(rawUpdatedAt).toISOString() : null;

  return {
    presetId,
    customPreset,
    updatedBy,
    updatedAt,
  };
};

export const themeService = {
  async getThemeConfig(): Promise<ThemeConfig> {
    try {
      const result = await query('SELECT value, updated_at FROM platform_settings WHERE key = $1 LIMIT 1', [THEME_KEY]);
      if (result.rows?.length) {
        return mapRowToConfig(result.rows[0]);
      }
      return { presetId: DEFAULT_THEME_ID, customPreset: null };
    } catch (err) {
      if (isMissingTableError(err)) {
        return { presetId: DEFAULT_THEME_ID, customPreset: null };
      }
      throw err;
    }
  },

  async updateThemeConfig(input: ThemeConfig): Promise<ThemeConfig> {
    const presetId = typeof input.presetId === 'string' && input.presetId.trim().length > 0
      ? input.presetId.trim()
      : DEFAULT_THEME_ID;

    const customPreset = sanitizePreset(input.customPreset);
    const payload = {
      presetId,
      customPreset,
      updatedBy: input.updatedBy ?? null,
    };

    const now = new Date().toISOString();

    await query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [THEME_KEY, payload, now]
    );

    return this.getThemeConfig();
  },
};
