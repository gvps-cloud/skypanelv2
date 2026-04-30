import { describe, it, expect, vi } from 'vitest';
import { generateAnimalSuffix } from '../../api/lib/animalSuffix.js';

describe('Animal Suffix Generator Security', () => {
  it('should not use Math.random()', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');

    generateAnimalSuffix();

    // This should fail before the fix and pass after the fix
    expect(mathRandomSpy).not.toHaveBeenCalled();

    mathRandomSpy.mockRestore();
  });

  it('should generate a string in the correct format (adjective-animal-number)', () => {
    const suffix = generateAnimalSuffix();
    // Expected format: adjective-animal-number (where number is 100-999)
    expect(suffix).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]{2}$/);
  });
});
