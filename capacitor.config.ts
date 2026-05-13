import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cloud.visuelpro.app',
  appName: 'VisualPro',
  webDir: 'dist',
  server: {
    url: 'https://8e12da65-322f-4003-b2ce-9fb33dc5ff21.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
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