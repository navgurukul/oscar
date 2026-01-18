import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oscar.ainotes',
  appName: 'OSCAR',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // For development, point to your local server:
    url: 'http://localhost:3000',
    cleartext: true,
    // For production, point to your deployed Next.js app:
    // url: 'https://your-deployed-app.vercel.app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a', // slate-950
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;

