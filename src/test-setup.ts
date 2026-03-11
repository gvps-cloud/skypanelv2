import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock as Storage;

// Mock fetch globally
global.fetch = vi.fn();

// Mock ResizeObserver for Radix/cmdk based popovers in jsdom
global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

// Mock scrollIntoView for cmdk active item focus management in jsdom
HTMLElement.prototype.scrollIntoView = vi.fn();
