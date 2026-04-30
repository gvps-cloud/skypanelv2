/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 15000,
    // Run test files serially to prevent backend DB/rate-limiter state interference
    fileParallelism: false,
    env: {
      VITE_API_URL: 'http://localhost:3001/api',
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/security/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'api/**/*.test.ts',
    ],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      'dist/**',
      '.idea/**',
      '.git/**',
      '.cache/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})