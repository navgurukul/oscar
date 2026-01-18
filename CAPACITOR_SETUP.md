# Capacitor Setup Guide for OSCAR

This guide will help you convert your Next.js OSCAR app into a native mobile app using Capacitor.

## Prerequisites

- Node.js 18+
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio (for Android development)

## Step 1: Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar
```

## Step 2: Initialize Capacitor

```bash
npx cap init
```

When prompted:
- **App name**: OSCAR
- **App ID**: com.oscar.ainotes (or your preferred bundle ID)
- **Web dir**: out (for static export)

## Step 3: Configure Next.js for Static Export

Since Capacitor works best with static sites, we need to configure Next.js for static export.

### Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Enable static export
  images: {
    unoptimized: true, // Required for static export
  },
  swcMinify: true,
  // ... rest of your config
};
```

**⚠️ Important Note**: Static export means API routes won't work. You'll need to:
1. Move API routes to a separate backend server, OR
2. Use Capacitor's HTTP plugin to call your API endpoints

## Step 4: Create Capacitor Configuration

Create `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oscar.ainotes',
  appName: 'OSCAR',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
    },
  },
};

export default config;
```

## Step 5: Add Native Permissions

### iOS Permissions (`ios/App/App/Info.plist`):

Add after Capacitor syncs:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>OSCAR needs microphone access to record your voice notes.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>OSCAR needs speech recognition to convert your voice to text.</string>
```

### Android Permissions (`android/app/src/main/AndroidManifest.xml`):

Add after Capacitor syncs:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Step 6: Update Package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "build": "next build",
    "build:mobile": "next build && npx cap sync",
    "cap:ios": "npx cap open ios",
    "cap:android": "npx cap open android",
    "cap:sync": "npx cap sync"
  }
}
```

## Step 7: Handle API Routes for Mobile

Since static export doesn't support API routes, you have two options:

### Option A: Use Environment Variables for API URLs

Create a config file that points to your deployed API:

```typescript
// lib/config.ts
export const API_CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://your-api-domain.com',
  // ... other config
};
```

Then update your API calls to use fetch with the full URL.

### Option B: Use Capacitor HTTP Plugin

```bash
npm install @capacitor-community/http
```

Then use it in your services:

```typescript
import { Http } from '@capacitor-community/http';

// Instead of fetch('/api/deepseek/format', ...)
const response = await Http.post({
  url: 'https://your-api-domain.com/api/deepseek/format',
  headers: { 'Content-Type': 'application/json' },
  data: { rawText }
});
```

## Step 8: Build and Sync

```bash
# Build the Next.js app
npm run build

# Sync with Capacitor
npx cap sync

# Open in native IDE
npx cap open ios    # For iOS
npx cap open android # For Android
```

## Step 9: Platform-Specific Considerations

### iOS
- Test on a real device for microphone permissions
- Configure signing in Xcode
- Test speech recognition on iOS Safari (has limitations)

### Android
- Test microphone permissions on real device
- Configure signing for release builds
- Test on Android 8.0+ for best compatibility

## Step 10: Handle Browser-Specific Code

Update `lib/services/browser.service.ts` to detect Capacitor:

```typescript
import { Capacitor } from '@capacitor/core';

export const browserService = {
  isCapacitor(): boolean {
    return Capacitor.isNativePlatform();
  },
  
  isSpeechRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    
    // In Capacitor, we might need native plugins
    if (Capacitor.isNativePlatform()) {
      // Consider using @capacitor-community/speech-recognition
      return true; // or implement native plugin check
    }
    
    const win = window as any;
    const SpeechRecognitionAPI =
      win.SpeechRecognition || win.webkitSpeechRecognition;
    return !!SpeechRecognitionAPI;
  },
  // ... rest of your code
};
```

## Troubleshooting

### Issue: API routes not working
**Solution**: Use Option A or B from Step 7 to handle API calls

### Issue: Microphone not working on iOS
**Solution**: 
- Check Info.plist permissions
- Test on real device (not simulator)
- iOS Safari has limitations - consider native speech recognition plugin

### Issue: Build fails
**Solution**: 
- Ensure `output: 'export'` is in next.config.js
- Check all images use `unoptimized: true`
- Remove any server-side only code

### Issue: Speech recognition not working
**Solution**: 
- Consider using `@capacitor-community/speech-recognition` plugin
- Or use native platform APIs via Capacitor plugins

## Next Steps

1. Deploy your API routes to a server (Vercel, AWS, etc.)
2. Update API URLs in your config
3. Test on real devices
4. Submit to App Store / Play Store

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)

