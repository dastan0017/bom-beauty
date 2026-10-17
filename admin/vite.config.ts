import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { adminCsp } from './csp';

const envDir = fileURLToPath(new URL('..', import.meta.url));

/** Production builds carry the CSP as a <meta> tag; the dev server needs inline scripts for React refresh. */
function cspMeta(mode: string): Plugin {
  return {
    name: 'bom-admin-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        // loadEnv lets variables from the real environment (CI, Docker build args) win over .env.
        attrs: { 'http-equiv': 'Content-Security-Policy', content: adminCsp(loadEnv(mode, envDir, 'VITE_')) },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig(({ mode }) => ({
  // VITE_* variables come from the repo-root .env (created by `pnpm dev`).
  envDir,
  plugins: [react(), tailwindcss(), cspMeta(mode)],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
}));
