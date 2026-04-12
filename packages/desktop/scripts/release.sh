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

echo "🚀 Releasing OSCAR Desktop v$VERSION"
echo ""

# 1. Update version metadata across the workspace
echo "📦 Updating package and desktop versions..."
sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$DESKTOP_DIR/package.json"
rm "$DESKTOP_DIR/package.json.bak"
sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$WEB_DIR/package.json"
rm "$WEB_DIR/package.json.bak"
sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$DESKTOP_DIR/../shared/package.json"
rm "$DESKTOP_DIR/../shared/package.json.bak"
sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$DESKTOP_DIR/../../package.json"
rm "$DESKTOP_DIR/../../package.json.bak"
sed -i.bak "s/\"version\": \"[0-9.]*\"/\"version\": \"$VERSION\"/" "$TAURI_DIR/tauri.conf.json"
rm "$TAURI_DIR/tauri.conf.json.bak"
sed -i.bak "0,/^version = \".*\"/s//version = \"$VERSION\"/" "$TAURI_DIR/Cargo.toml"
rm "$TAURI_DIR/Cargo.toml.bak"
sed -i.bak "0,/^version = \".*\"/s//version = \"$VERSION\"/" "$TAURI_DIR/Cargo.lock"
rm "$TAURI_DIR/Cargo.lock.bak"

# 2. Build the app
echo "🔨 Building desktop app..."
cd "$DESKTOP_DIR"
pnpm build

echo ""
echo "✅ Build complete!"
echo ""
echo "Next steps:"
echo "1. Build Tauri bundles: cd packages/desktop && pnpm tauri build"
echo "2. Update packages/web/public/tauri/updates.json:"
echo "   - Change version to \"$VERSION\""
echo "   - Update pub_date to current date"
echo "   - Update notes"
echo "   - Update GitHub release URLs and signatures for each platform"
echo "3. Set NEXT_PUBLIC_APP_VERSION=$VERSION for the download page if needed"
echo "4. Commit, tag, push, and publish the GitHub release assets"
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
      "url": "https://github.com/navgurukul/oscar/releases/download/vVERSION/OSCAR_x86_64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "",
      "url": "https://github.com/navgurukul/oscar/releases/download/vVERSION/OSCAR_aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "",
      "url": "https://github.com/navgurukul/oscar/releases/download/vVERSION/OSCAR_VERSION_x64-setup.nsis.zip"
    },
    "linux-x86_64": {
      "signature": "",
      "url": "https://github.com/navgurukul/oscar/releases/download/vVERSION/OSCAR_VERSION_amd64.AppImage.tar.gz"
    }
  }
}
EOF
