import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cloud.visuelpro.app',
  appName: 'Ecomfy',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      sound: 'visualpro_cash.wav',
      iconColor: '#000000',
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;