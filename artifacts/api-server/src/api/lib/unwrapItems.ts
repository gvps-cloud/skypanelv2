export function unwrapItems<T = any>(payload: any, fallbackKeys: string[] = ['items']): T[] {
  if (Array.isArray(payload)) return payload;
  for (const key of fallbackKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}
