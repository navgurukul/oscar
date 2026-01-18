# Capacitor Quick Start for OSCAR

## ⚠️ Important Considerations

Your app uses **Next.js API routes** (`/api/deepseek/format` and `/api/deepseek/title`). These won't work with static export. You have two options:

### Option 1: Deploy API Routes Separately (Recommended)
Deploy your API routes to a server (Vercel, AWS, etc.) and update your code to call those URLs.

### Option 2: Use Capacitor HTTP Plugin
Use `@capacitor-community/http` to make API calls directly from the mobile app.

## Quick Setup Steps

### 1. Install Dependencies

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar
```

### 2. Initialize Capacitor

```bash
npx cap init
```

Use these values:
- **App name**: OSCAR
- **App ID**: com.oscar.ainotes
- **Web dir**: out

### 3. Update next.config.js

Add static export configuration:

```javascript
const nextConfig = {
  output: 'export', // Add this
  images: {
    unoptimized: true, // Add this
  },
  // ... rest of your existing config
};
```

**Note**: This will disable API routes. You'll need to handle API calls differently (see options above).

### 4. Copy Capacitor Config

Copy `capacitor.config.ts.template` to `capacitor.config.ts` and customize if needed.

### 5. Update package.json Scripts

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

### 6. Build and Sync

```bash
npm run build:mobile
```

### 7. Open Native Projects

```bash
npm run cap:ios      # Opens Xcode
npm run cap:android  # Opens Android Studio
```

## Handling API Routes for Mobile

Since static export doesn't support API routes, update your API service files:

### Update `lib/services/ai.service.ts`

```typescript
// Add at the top
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-deployed-api.com';

// Update formatText function
async formatText(rawText: string): Promise<FormattingResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deepseek/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    });
    // ... rest of the code
  }
}
```

Then deploy your API routes to a server and set `NEXT_PUBLIC_API_URL` in your environment.

## Native Permissions

After first sync, add permissions:

### iOS (`ios/App/App/Info.plist`)
```xml
<key>NSMicrophoneUsageDescription</key>
<string>OSCAR needs microphone access to record your voice notes.</string>
```

### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Testing

1. Build: `npm run build:mobile`
2. Open in Xcode/Android Studio
3. Run on a real device (microphone doesn't work in simulators)
4. Test microphone permissions

## Next Steps

1. Deploy API routes to a server
2. Update API URLs in your code
3. Test on real devices
4. Configure app signing
5. Submit to App Store / Play Store

For detailed instructions, see `CAPACITOR_SETUP.md`.

