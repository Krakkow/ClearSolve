/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pure client-side SPA. The `public/` dir (incl. `_headers`) is copied as-is to
// the build output, so COOP/COEP headers survive on Netlify/Cloudflare Pages.
// We set the same headers on the dev server so `crossOriginIsolated` works locally,
// matching the production hosting contract (ARCHITECTURE Sec 10).
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    // Vite worker output as ES modules (matches `new Worker(url, { type: 'module' })`).
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
