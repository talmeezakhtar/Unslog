import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reads VITE_* variables from the repo-root .env (envDir: '..'), or from the environment (e.g. Vercel).
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: { port: 5173 },
});
