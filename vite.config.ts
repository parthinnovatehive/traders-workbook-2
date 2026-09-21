import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/**
 * Refuse to build if a secret has been put somewhere it would be published.
 *
 * Every `VITE_`-prefixed variable is inlined into the JavaScript bundle, so a
 * key secret in `.env` is a key secret on every visitor's machine. This is the
 * kind of mistake that is invisible in review and expensive in production, so
 * the build fails rather than shipping it.
 */
function forbidPublishedSecrets(): Plugin {
  const FORBIDDEN = [
    'VITE_RAZORPAY_KEY_SECRET',
    'VITE_RAZORPAY_WEBHOOK_SECRET',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SERVICE_ROLE_KEY',
  ];

  return {
    name: 'forbid-published-secrets',
    enforce: 'pre',
    config(_config, { mode }) {
      const leaked = FORBIDDEN.filter((name) => process.env[name]);
      if (leaked.length > 0) {
        throw new Error(
          `\n\nRefusing to build (${mode}): ${leaked.join(', ')} ` +
            'would be compiled into the client bundle and readable by anyone.\n' +
            'Secrets belong in Supabase Edge Function secrets:\n' +
            '  supabase secrets set RAZORPAY_KEY_SECRET=...\n' +
            'Remove the VITE_ variable and rotate the key — assume it is burned.\n',
        );
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [forbidPublishedSecrets(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/calculations/**', 'src/utils/**'],
    },
  },
});
