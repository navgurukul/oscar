# Testing Links Guide - Android APK & iOS TestFlight

## 📱 Android APK (Testing Link)

### Step 1: APK Build Karein

```bash
npm run cap:android
```

Android Studio open hoga. Phir:

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Release APK select karein
3. APK file mil jayega: `android/app/build/outputs/apk/release/app-release.apk`

### Step 2: APK Ko Upload Karein

**Option A: Google Drive (Recommended)**
1. APK file ko Google Drive par upload karein
2. Right-click → "Get link" → "Anyone with the link"
3. Link copy karein

**Option B: Firebase App Distribution (Free)**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not done)
firebase init apphosting

# Upload APK
firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app YOUR_APP_ID \
  --groups "testers"
```

**Option C: Direct File Sharing**
- WeTransfer, Dropbox, or any file sharing service use karein

### Step 3: Link Share Karein

**Google Drive Link Example:**
```
https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing
```

**Firebase App Distribution Link:**
```
https://appdistribution.firebase.dev/i/YOUR_INSTALL_TOKEN
```

## 🍎 iOS TestFlight (Testing Link)

### Step 1: Archive Banayein

```bash
npm run cap:ios
```

Xcode mein:
1. **Product → Archive**
2. Archive complete hone ke baad, **"Distribute App"** click karein
3. **App Store Connect** select karein
4. Upload complete hone tak wait karein

### Step 2: TestFlight Setup

1. **https://appstoreconnect.apple.com** par jayein
2. **My Apps** → **OSCAR** select karein
3. **TestFlight** tab par jayein
4. Build process complete hone tak wait karein (10-30 minutes)

### Step 3: Testers Add Karein

**Internal Testing (Up to 100 testers):**
1. **Internal Testing** section mein jayein
2. **+** button click karein
3. Build select karein
4. Testers add karein (email se)

**External Testing (Up to 10,000 testers):**
1. **External Testing** section mein jayein
2. Group create karein
3. Build select karein
4. Submit for Beta App Review (first time only)
5. Testers add karein

### Step 4: TestFlight Link Mil Jayega

**Internal Testing:**
- Testers ko email aayega automatically
- Ya manually invite kar sakte hain

**External Testing:**
- Public link mil jayega:
```
https://testflight.apple.com/join/XXXXXX
```

## 🚀 Quick Commands

### Android APK Build
```bash
npm run cap:android
# Android Studio: Build → Build APK(s)
```

### iOS Archive
```bash
npm run cap:ios
# Xcode: Product → Archive → Distribute
```

## ⚠️ Important Notes

### Android APK:
- Recipients ko "Unknown sources" enable karna hoga
- Settings → Security → Unknown sources (Android 8+)
- Ya Settings → Apps → Special access → Install unknown apps

### iOS TestFlight:
- Apple ID chahiye
- TestFlight app install karna hoga
- First time: Beta App Review (24-48 hours)
- After that: Instant updates

## 📋 Pre-requisites

### Android:
- ✅ Android Studio installed
- ✅ Signing key configured (release build ke liye)

### iOS:
- ✅ Apple Developer Account ($99/year)
- ✅ Xcode installed
- ✅ App signing configured

## 💡 Quick Setup

**Sabse Aasan:**
1. **Android**: APK banayein → Google Drive upload → Link share
2. **iOS**: Archive → TestFlight → Testers add → Link share

Kya aap abhi APK build karna chahte hain?

