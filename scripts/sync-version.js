/**
 * Sync version across all package.json files
 * 
 * Single source of truth: packages/desktop/package.json
 * This script syncs the version to root package.json
 * 
 * Usage: npm run sync-version
 * 
 * For releases:
 * 1. Update version in packages/desktop/package.json
 * 2. Run: npm run sync-version
 * 3. Commit and tag
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const desktopPackagePath = join(rootDir, 'packages/desktop/package.json');
const rootPackagePath = join(rootDir, 'package.json');

try {
  // Read desktop package.json (source of truth)
  const desktopPackage = JSON.parse(readFileSync(desktopPackagePath, 'utf8'));
  const version = desktopPackage.version;

  console.log(`📦 Source version (desktop): ${version}`);

  // Read and update root package.json
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  
  if (rootPackage.version === version) {
    console.log('✅ Versions are already in sync');
    process.exit(0);
  }

  rootPackage.version = version;
  
  // Write back to root package.json with proper formatting
  writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2) + '\n');
  
  console.log(`✅ Synced root package.json to version ${version}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Review changes: git diff');
  console.log('   2. Commit: git add -A && git commit -m "chore: bump version to ' + version + '"');
  console.log('   3. Tag: git tag -a v' + version + ' -m "Release v' + version + '"');
  console.log('   4. Push: git push && git push --tags');
} catch (error) {
  console.error('❌ Error syncing versions:', error.message);
  process.exit(1);
}
