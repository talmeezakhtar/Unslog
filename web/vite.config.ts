import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Reads VITE_* variables from the repo-root .env (envDir: '..'), or from the environment (e.g. Vercel).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '..',
  server: { port: 5173 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
