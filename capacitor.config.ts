import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agakai.app',
  appName: 'AgakAI',
  webDir: 'dist',
  plugins: {
    Keyboard: { resize: 'body' },
  },
};

export default config;
