import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(new URL("..", import.meta.url).pathname);

const palette = {
  cream: "#f7f4ee",
  cream2: "#efeae0",
  ink: "#1a1816",
  inkFaint: "#8b8780",
  rule: "#d8d2c4",
  accent: "#b8623d",
  accentDark: "#823f24",
  night: "#0f0d0a",
};

const lightSvgPath = resolve(root, "packages/web/public/oscar-light-logo.svg");
const darkSvgPath = resolve(root, "packages/web/public/oscar-dark-logo.svg");

async function generatePngFromSvg(svgPath, relativeOutputPath, size) {
  const output = resolve(root, relativeOutputPath);
  mkdirSync(dirname(output), { recursive: true });
  await sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(output);
  console.log(`wrote ${relativeOutputPath}`);
}

async function writeWordmark(relativePath) {
  const output = resolve(root, relativePath);
  mkdirSync(dirname(output), { recursive: true });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1366" height="768" viewBox="0 0 1366 768">
      <g transform="translate(188 272) scale(9.25)" fill="none">
        <path d="M3.9 10.8C4.6 16.2 7.7 18.9 12 18.9S19.4 16.2 20.1 10.8"
          stroke="${palette.accent}" stroke-width="1.45" stroke-linecap="round"/>
        <path d="M5.8 10.9v2.7M7.4 9.8v4.7M9 8.7v6.8M10.6 7.8v8.8M12.2 9.5v5.6M13.8 10.7v3.7M15.4 9.1v6.3M17 8.4v7.7M18.6 10.1v4.4"
          stroke="${palette.accent}" stroke-width="1.35" stroke-linecap="round"/>
      </g>
      <text x="440" y="455"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="230"
        font-weight="500"
        letter-spacing="0"
        fill="${palette.ink}">Oscar</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(output);
  console.log(`wrote ${relativePath}`);
}

async function main() {
  try {
    // Generate web public PNG assets from SVGs
    await generatePngFromSvg(lightSvgPath, "packages/web/public/OSCAR_AVATAR.png", 1024);
    await generatePngFromSvg(lightSvgPath, "packages/web/public/OSCAR_ICON_192.png", 192);
    await generatePngFromSvg(lightSvgPath, "packages/web/public/OSCAR_ICON_512.png", 512);
    await generatePngFromSvg(lightSvgPath, "packages/web/public/OSCAR_LIGHT_LOGO.png", 1024);
    await generatePngFromSvg(darkSvgPath, "packages/web/public/OSCAR_DARK_LOGO.png", 1024);
    
    // Generate the wordmark
    await writeWordmark("packages/web/public/OSCARLOGO.png");

    // Copy to desktop public
    for (const file of ["OSCAR_AVATAR.png", "OSCAR_LIGHT_LOGO.png", "OSCAR_DARK_LOGO.png", "oscar-light-logo.svg", "oscar-dark-logo.svg"]) {
      copyFileSync(
        resolve(root, "packages/web/public", file),
        resolve(root, "packages/desktop/public", file)
      );
      console.log(`copied packages/desktop/public/${file}`);
    }
    
    console.log("All logo assets generated successfully!");
  } catch (error) {
    console.error("Error generating logo assets:", error);
    process.exit(1);
  }
}

main();
