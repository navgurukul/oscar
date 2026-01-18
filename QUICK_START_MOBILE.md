# Quick Start - iOS & Android

## ✅ Setup Complete!

Dono platforms (iOS aur Android) add ho gaye hain.

## 🚀 Kaise Use Karein

### Step 1: Dev Server Start Karein
```bash
npm run dev
```
Ye `http://localhost:3000` par server start karega.

### Step 2: iOS App Open Karein
```bash
npm run cap:ios
```
Ye Xcode open karega. Wahan se:
- Simulator ya device select karein
- Play button click karein
- App test karein

### Step 3: Android App Open Karein
```bash
npm run cap:android
```
Ye Android Studio open karega. Wahan se:
- Emulator ya device select karein
- Run button click karein
- App test karein

## ⚙️ Permissions Add Karein

### iOS (Xcode mein)
1. `ios/App/App/Info.plist` open karein
2. Ye add karein:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>OSCAR needs microphone access to record your voice notes.</string>
```

### Android (Android Studio mein)
1. `android/app/src/main/AndroidManifest.xml` open karein
2. Ye add karein (agar nahi hai):
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 📱 Important Commands

```bash
# Dev server start
npm run dev

# iOS open
npm run cap:ios

# Android open
npm run cap:android

# Changes sync karein
npx cap sync
```

## 🌐 Production ke liye

1. App ko Vercel par deploy karein
2. `capacitor.config.ts` mein production URL update karein
3. Phir sync karein

Detailed guide: `MOBILE_SETUP_GUIDE.md` mein dekhein.

