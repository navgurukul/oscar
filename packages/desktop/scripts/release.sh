#!/bin/bash
# Release script for OSCAR desktop app
# Usage: ./release.sh <version> [notes]

set -e

VERSION="${1:-}"
NOTES="${2:-Release version $VERSION}"

if [ -z "$VERSION" ]; then
    echo "Error: Version is required"
    echo "Usage: ./release.sh 0.2.0 'Release notes here'"
    exit 1
fi

# Paths
DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$DESKTOP_DIR/../web"
TAURI_DIR="$DESKTOP_DIR/src-tauri"
PUBLIC_TAURI_DIR="$WEB_DIR/public/tauri"

echo "🚀 Releasing OSCAR Desktop v$VERSION"
echo ""

# 1. Update version in tauri.conf.json
echo "📦 Updating version in tauri.conf.json..."
sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$TAURI_DIR/tauri.conf.json"
rm "$TAURI_DIR/tauri.conf.json.bak"

# 2. Build the app
echo "🔨 Building desktop app..."
cd "$DESKTOP_DIR"
pnpm build

echo ""
echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Build Tauri bundles: cd packages/desktop && pnpm tauri build"
echo "2. Copy bundles to packages/web/public/tauri/:"
echo "   - oscar_${VERSION}_x64.dmg (Intel Mac)"
echo "   - oscar_${VERSION}_aarch64.dmg (Apple Silicon)"
echo "   - oscar_${VERSION}_x64-setup.exe (Windows)"
echo "   - oscar_${VERSION}_amd64.AppImage (Linux)"
echo "3. Update packages/web/public/tauri/updates.json:"
echo "   - Change version to \"$VERSION\""
echo "   - Update pub_date to current date"
echo "   - Update notes"
echo "   - Update URLs to point to new bundle files"
echo "4. (Optional) Generate signatures and add to updates.json"
echo "5. Commit and push to deploy via Amplify"
echo ""
echo "📋 Example updates.json entry:"
cat << 'EOF'
{
  "version": "VERSION",
  "notes": "NOTES",
  "pub_date": "2026-03-16T00:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "",
      "url": "https://oscar.samyarth.org/tauri/oscar_VERSION_x64.dmg"
    },
    "darwin-aarch64": {
      "signature": "",
      "url": "https://oscar.samyarth.org/tauri/oscar_VERSION_aarch64.dmg"
    },
    "linux-x86_64": {
      "signature": "",
      "url": "https://oscar.samyarth.org/tauri/oscar_VERSION_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "https://oscar.samyarth.org/tauri/oscar_VERSION_x64-setup.exe"
    }
  }
}
EOF
