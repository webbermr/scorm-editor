import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // when this build was made (dev: when the server started) — shown on the start screen
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
});
