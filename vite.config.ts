import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/@ionic/core/components/ion-')) {
            const component = id.match(/\/ion-([^/]+)\.js$/)?.[1] ?? '';
            const firstLetter = component[0]?.toLowerCase() ?? 'a';
            const group = firstLetter <= 'h' ? 'a-h' : firstLetter <= 'p' ? 'i-p' : 'q-z';
            return `ionic-components-${group}`;
          }
          if (id.includes('/@ionic/core/components/p-')) return 'ionic-runtime';
          if (id.includes('/@stencil/core/')) return 'ionic-runtime';
          if (id.includes('/@ionic/vue/')) return 'ionic-vue';
          if (id.includes('/ionicons/')) return 'ionicons';
          if (id.includes('/@supabase/')) return 'supabase';
          if (id.includes('/@capacitor/')) return 'capacitor';
          if (id.includes('/@vue/') || id.includes('/vue-router/') || id.includes('/node_modules/vue/')) {
            return 'vue-vendor';
          }
          if (id.includes('/leaflet/')) return 'leaflet-vendor';
          if (id.includes('/marked/') || id.includes('/dompurify/')) return 'markdown';
        },
      },
    },
  },
});
