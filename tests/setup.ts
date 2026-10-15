import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

localStorage.setItem('sparkflow.lang', 'en-US');
await import('../src/i18n/config');

afterEach(() => {
  cleanup();
});
