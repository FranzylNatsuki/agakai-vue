import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.agakai.app',
  appName: 'AgakAI',
  webDir: 'dist',
  plugins: {
    Keyboard: { resize: KeyboardResize.None },
  },
};

export default config;
