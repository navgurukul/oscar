# Build Error Notes

## Current Issue

**Error**: `TypeError: generate is not a function` in `generateBuildId`

This error occurs during Next.js build, even without static export enabled. It appears to be a Next.js internal issue.

## Attempted Solutions

1. ✅ Clean install (`rm -rf node_modules .next && npm install`)
2. ✅ Updated Next.js to latest version
3. ✅ Disabled static export
4. ✅ Removed middleware temporarily

Error persists, suggesting a deeper Next.js compatibility issue.

## Recommended Approach: Server URL Method

Instead of static export, use Capacitor with a server URL:

### Steps:

1. **Deploy Next.js app** to Vercel/Netlify (keeps API routes working)

2. **Update `capacitor.config.ts`**:
   ```typescript
   server: {
     url: 'https://your-deployed-app.vercel.app',
   }
   ```

3. **Benefits**:
   - ✅ API routes work normally
   - ✅ No build errors
   - ✅ Middleware works
   - ✅ Simpler setup
   - ✅ Easier to maintain

### Development Setup

For local development:
```typescript
server: {
  url: 'http://localhost:3000',
  cleartext: true,
}
```

Then run:
```bash
npm run dev        # Start Next.js server
npm run cap:ios    # Opens Xcode with app pointing to localhost
```

### Production Setup

1. Deploy to Vercel:
   ```bash
   vercel deploy
   ```

2. Update `capacitor.config.ts` with production URL

3. Build and sync:
   ```bash
   npm run build:mobile
   ```

## Alternative: Fix Build Error

If you want to use static export, you'll need to:

1. Investigate the Next.js build error further
2. Check for Next.js version compatibility issues
3. Consider downgrading Next.js if needed
4. Check for any custom build configurations causing conflicts

## Current Status

- ✅ Capacitor dependencies installed
- ✅ Capacitor config created
- ✅ Package.json scripts updated
- ❌ Build failing (Next.js internal error)
- ✅ Alternative approach documented

