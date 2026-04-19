const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toHex = (value: number) => value.toString(16).padStart(2, "0");

const stripPercent = (value: string) => value.replace(/%/g, "");

const parseHslComponents = (value: string): [number, number, number] | null => {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 3) {
    return null;
  }

  const [hRaw, sRaw, lRaw] = parts;
  const h = Number.parseFloat(hRaw);
  const s = Number.parseFloat(stripPercent(sRaw));
  const l = Number.parseFloat(stripPercent(lRaw));

  if ([h, s, l].some((component) => Number.isNaN(component))) {
    return null;
  }

  return [clamp(h, 0, 360), clamp(s, 0, 100), clamp(l, 0, 100)];
};

const parseHex = (hex: string): [number, number, number] | null => {
  const normalized = hex.trim().replace('#', '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalized)) {
    return null;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return [r, g, b];
};

export const hslStringToHex = (value: string, fallback = '#000000'): string => {
  const components = parseHslComponents(value);
  if (!components) {
    return fallback;
  }

  const [h, sPercent, lPercent] = components;
  const s = sPercent / 100;
  const l = lPercent / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) {
    rPrime = c;
    gPrime = x;
  } else if (h < 120) {
    rPrime = x;
    gPrime = c;
  } else if (h < 180) {
    gPrime = c;
    bPrime = x;
  } else if (h < 240) {
    gPrime = x;
    bPrime = c;
  } else if (h < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToHslString = (hex: string, fallback = '0 0% 0%'): string => {
  const rgb = parseHex(hex);
  if (!rgb) {
    return fallback;
  }

  const [rRaw, gRaw, bRaw] = rgb;
  const r = rRaw / 255;
  const g = gRaw / 255;
  const b = bRaw / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }

    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const hRounded = Math.round(clamp(h, 0, 360));
  const sRounded = Math.round(clamp(s * 100, 0, 100) * 10) / 10;
  const lRounded = Math.round(clamp(l * 100, 0, 100) * 10) / 10;

  return `${hRounded} ${sRounded}% ${lRounded}%`;
};
