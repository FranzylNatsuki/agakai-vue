import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { createLocalVoiceMiddleware } from './server/voiceGateway';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => ({
  plugins: [vue(), {
    name: 'local-elevenlabs-gateway',
    configureServer(server) {
      server.middlewares.use(createLocalVoiceMiddleware({ ...loadEnv(mode, process.cwd(), ''), ...process.env }));
    },
    configurePreviewServer(server) {
      server.middlewares.use(createLocalVoiceMiddleware({ ...loadEnv(mode, process.cwd(), ''), ...process.env }));
    },
  }],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
