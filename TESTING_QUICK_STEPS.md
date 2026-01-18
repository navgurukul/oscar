# Testing Links - Quick Steps

## 🤖 Android APK (Abhi Kar Rahe Hain)

Android Studio open ho gaya hai. Ab ye karein:

### Steps:
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. **Release** select karein
3. APK build hone tak wait karein
4. APK file location: `android/app/build/outputs/apk/release/app-release.apk`

### Link Banane Ke Liye:
1. APK file ko **Google Drive** par upload karein
2. Right-click → **"Get link"** → **"Anyone with the link"**
3. Link copy karein aur share karein

**Example Link:**
```
https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing
```

## 🍎 iOS TestFlight (Setup Karein)

### Step 1: Archive
```bash
npm run cap:ios
```
Xcode mein:
- **Product → Archive**
- **Distribute App** → **App Store Connect**
- Upload karein

### Step 2: TestFlight Setup
1. https://appstoreconnect.apple.com par jayein
2. **My Apps** → **OSCAR** → **TestFlight**
3. Build process complete hone tak wait (10-30 min)
4. **Internal Testing** mein testers add karein

### Step 3: Link Mil Jayega
- Testers ko email aayega
- Ya public link:
```
https://testflight.apple.com/join/XXXXXX
```

## ⚡ Summary

**Android APK:**
- ✅ Android Studio open hai
- ⏳ APK build karein
- ⏳ Google Drive upload
- ⏳ Link share

**iOS TestFlight:**
- ⏳ Archive banayein
- ⏳ App Store Connect upload
- ⏳ TestFlight setup
- ⏳ Link share

Detailed guide: `TESTING_LINKS_GUIDE.md`

