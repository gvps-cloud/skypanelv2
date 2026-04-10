import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSpriteDisplayState, resolveThemeColors } from '@/components/home/ParticleGlobe';

describe('ParticleGlobe helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers testing state over selected/hovered state', () => {
    expect(getSpriteDisplayState('us-east', 'us-east', 'us-east', 'us-east', undefined)).toBe('testing');
    expect(getSpriteDisplayState('us-east', 'us-east', 'us-east', null, undefined)).toBe('selected');
    expect(getSpriteDisplayState('us-east', 'us-east', null, null, undefined)).toBe('hovered');
    expect(getSpriteDisplayState('us-east', null, null, null, undefined)).toBe('default');
  });

  it('prefers selected state over hovered state', () => {
    expect(getSpriteDisplayState('us-east', 'us-east', 'us-east', null, undefined)).toBe('selected');
    expect(getSpriteDisplayState('us-east', 'us-east', null, null, undefined)).toBe('hovered');
    expect(getSpriteDisplayState('us-east', null, null, null, undefined)).toBe('default');
  });

  it('derives marker colors from CSS theme tokens', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(({
      getPropertyValue: (name: string) => {
        if (name === '--primary') {
          return '200 80% 50%';
        }
        if (name === '--accent') {
          return '120 40% 45%';
        }
        return '';
      },
    } as unknown as CSSStyleDeclaration));

    const colors = resolveThemeColors();
    const expectedPrimary = `#${new THREE.Color().setHSL(200 / 360, 0.8, 0.5).getHexString()}`;
    const expectedAccent = `#${new THREE.Color().setHSL(120 / 360, 0.4, 0.45).getHexString()}`;

    expect(colors.markerHex).toBe(expectedPrimary);
    expect(colors.selectedMarkerHex).toBe(expectedAccent);
  });

  it('falls back to defaults when CSS tokens are missing', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration));

    const colors = resolveThemeColors();
    const expectedPrimary = `#${new THREE.Color().setHSL(188 / 360, 0.82, 0.46).getHexString()}`;
    const expectedAccent = `#${new THREE.Color().setHSL(188 / 360, 0.53, 0.88).getHexString()}`;

    expect(colors.markerHex).toBe(expectedPrimary);
    expect(colors.selectedMarkerHex).toBe(expectedAccent);
  });
});
