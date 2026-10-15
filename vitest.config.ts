import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src') },
  },
  test: {
    environment: 'jsdom',
    // Use jsdom's browser Storage rather than Node's native Web Storage.
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    // These physics tests use Node's built-in runner and run in test:physics.
    exclude: ['src/experiments/electromagnetism/**/__tests__/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
