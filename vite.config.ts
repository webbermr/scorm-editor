import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// When this build was made (dev: when the server started), shown on the start
// screen. It goes in its own build-info.json rather than into the bundle, so the
// hashed asset names depend only on the code: two hosts serving the same commit
// behind one load balancer then produce identical /assets/* files.
const builtAt = new Date().toISOString();
const buildInfo = (): Plugin => ({
  name: 'build-info',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ builtAt }) });
  },
  configureServer(server) {
    server.middlewares.use('/build-info.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ builtAt }));
    });
  },
});

export default defineConfig({
  plugins: [react(), buildInfo()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
});
