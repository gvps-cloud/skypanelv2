-- Migration 021: normalize persisted theme preset defaults
-- Keep custom presets intact while ensuring valid preset identifiers.

UPDATE platform_settings
SET value = jsonb_set(
  CASE
    WHEN value IS NULL OR jsonb_typeof(value) <> 'object' THEN '{}'::jsonb
    ELSE value
  END,
  '{presetId}',
  to_jsonb('mono'::text),
  true
),
updated_at = NOW()
WHERE key = 'theme'
  AND (
    value IS NULL
    OR jsonb_typeof(value) <> 'object'
    OR NOT (value ? 'presetId')
    OR NULLIF(BTRIM(value->>'presetId'), '') IS NULL
    OR (value->>'presetId') NOT IN (
      'teal',
      'mono',
      'red',
      'violet',
      'emerald',
      'amber',
      'rose',
      'blue',
      'slate',
      'orange',
      'zinc',
      'stone',
      'aurora',
      'midnight',
      'sage',
      'custom'
    )
  );
