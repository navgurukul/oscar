# OSCAR Mobile App Setup Guide (iOS & Android)

## ✅ Setup Complete

Both iOS and Android platforms have been added to your Capacitor project.

## 📱 Quick Start

### Prerequisites

**For iOS:**
- macOS with Xcode installed
- Xcode Command Line Tools
- CocoaPods (usually auto-installed with Xcode)

**For Android:**
- Android Studio installed
- Java Development Kit (JDK)
- Android SDK

### Development Setup

1. **Start Development Server:**
   ```bash
   npm run dev
   ```
   This starts Next.js on `http://localhost:3000`

2. **Open iOS Project:**
   ```bash
   npm run cap:ios
   ```
   This opens Xcode where you can:
   - Select a simulator or device
   - Build and run the app
   - Test on iOS

3. **Open Android Project:**
   ```bash
   npm run cap:android
   ```
   This opens Android Studio where you can:
   - Select an emulator or device
   - Build and run the app
   - Test on Android

## 🔧 Platform-Specific Configuration

### iOS Permissions

Add microphone permissions in Xcode:

1. Open `ios/App/App/Info.plist` in Xcode
2. Add these keys:
   ```xml
   <key>NSMicrophoneUsageDescription</key>
   <string>OSCAR needs microphone access to record your voice notes.</string>
   <key>NSSpeechRecognitionUsageDescription</key>
   <string>OSCAR needs speech recognition to convert your voice to text.</string>
   ```

### Android Permissions

Add microphone permissions in Android Studio:

1. Open `android/app/src/main/AndroidManifest.xml`
2. Add these permissions (if not already present):
   ```xml
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-permission android:name="android.permission.INTERNET" />
   ```

## 🚀 Building for Production

### iOS

1. **In Xcode:**
   - Select "Any iOS Device" or your connected device
   - Product → Archive
   - Follow the App Store submission process

2. **Or via command line:**
   ```bash
   cd ios/App
   xcodebuild -workspace App.xcworkspace -scheme App -configuration Release
   ```

### Android

1. **In Android Studio:**
   - Build → Generate Signed Bundle / APK
   - Follow the Play Store submission process

2. **Or via command line:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

## 🔄 Syncing Changes

After making changes to your web app:

```bash
# Sync changes to both platforms
npx cap sync

# Or sync individually
npx cap sync ios
npx cap sync android
```

## 🌐 Production Deployment

When ready for production:

1. **Deploy Next.js app to Vercel/Netlify:**
   ```bash
   vercel deploy
   ```

2. **Update `capacitor.config.ts`:**
   ```typescript
   server: {
     url: 'https://your-app.vercel.app',
     // Remove cleartext: true for production
   }
   ```

3. **Sync and rebuild:**
   ```bash
   npx cap sync
   npm run cap:ios    # Rebuild in Xcode
   npm run cap:android # Rebuild in Android Studio
   ```

## 📝 Important Notes

- **Development**: App loads from `http://localhost:3000` (dev server must be running)
- **Production**: App loads from your deployed URL
- **Build Error**: The local build error doesn't affect mobile app - we use server URL approach
- **API Routes**: Work normally since we're not using static export

## 🐛 Troubleshooting

### iOS Issues

- **"No such module"**: Run `pod install` in `ios/App` directory
- **Signing errors**: Configure signing in Xcode project settings
- **Microphone not working**: Check Info.plist permissions

### Android Issues

- **Gradle sync failed**: Open Android Studio and let it sync
- **Build errors**: Check Android SDK version compatibility
- **Microphone not working**: Check AndroidManifest.xml permissions

### General Issues

- **App not loading**: Ensure dev server is running on port 3000
- **CORS errors**: Check that `cleartext: true` is set for localhost
- **Sync errors**: Try `npx cap sync --force`

## 📚 Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run cap:ios               # Open iOS in Xcode
npm run cap:android           # Open Android in Android Studio
npx cap sync                  # Sync changes to native projects

# Production
npm run build                 # Build Next.js (if needed)
npx cap sync                  # Sync before building native apps
```

## 🎯 Next Steps

1. ✅ iOS platform added
2. ✅ Android platform added
3. ⏳ Add microphone permissions (see above)
4. ⏳ Test on real devices
5. ⏳ Configure app signing
6. ⏳ Submit to App Store / Play Store

Happy coding! 🚀

