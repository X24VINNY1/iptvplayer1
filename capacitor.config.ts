import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onyxstream.app',
  appName: 'OnyxStream',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true
  }
};

export default config;
