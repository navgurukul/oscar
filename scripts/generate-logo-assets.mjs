import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";
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

function hex(hexValue, alpha = 255) {
  const clean = hexValue.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    alpha,
  ];
}

const colors = Object.fromEntries(
  Object.entries(palette).map(([key, value]) => [key, hex(value)])
);

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }

  return Buffer.concat([
    header,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createCanvas(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function over(canvas, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height || alpha <= 0) return;

  const idx = (y * canvas.width + x) * 4;
  const srcA = (color[3] / 255) * alpha;
  const dstA = canvas.data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);

  if (outA <= 0) return;

  canvas.data[idx] = (color[0] * srcA + canvas.data[idx] * dstA * (1 - srcA)) / outA;
  canvas.data[idx + 1] = (color[1] * srcA + canvas.data[idx + 1] * dstA * (1 - srcA)) / outA;
  canvas.data[idx + 2] = (color[2] * srcA + canvas.data[idx + 2] * dstA * (1 - srcA)) / outA;
  canvas.data[idx + 3] = outA * 255;
}

function drawSdf(canvas, bounds, color, sdf) {
  const minX = clamp(Math.floor(bounds.x), 0, canvas.width - 1);
  const maxX = clamp(Math.ceil(bounds.x + bounds.width), 0, canvas.width - 1);
  const minY = clamp(Math.floor(bounds.y), 0, canvas.height - 1);
  const maxY = clamp(Math.ceil(bounds.y + bounds.height), 0, canvas.height - 1);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = sdf(x + 0.5, y + 0.5);
      const alpha = clamp(0.5 - distance, 0, 1);
      over(canvas, x, y, color, alpha);
    }
  }
}

function sdRoundedRect(px, py, cx, cy, width, height, radius) {
  const qx = Math.abs(px - cx) - width / 2 + radius;
  const qy = Math.abs(py - cy) - height / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function drawRoundedRect(canvas, cx, cy, width, height, radius, color) {
  drawSdf(
    canvas,
    { x: cx - width / 2 - 2, y: cy - height / 2 - 2, width: width + 4, height: height + 4 },
    color,
    (px, py) => sdRoundedRect(px, py, cx, cy, width, height, radius)
  );
}

function drawCircleStroke(canvas, cx, cy, radius, stroke, color) {
  const pad = stroke + 3;
  drawSdf(
    canvas,
    {
      x: cx - radius - pad,
      y: cy - radius - pad,
      width: (radius + pad) * 2,
      height: (radius + pad) * 2,
    },
    color,
    (px, py) => Math.abs(Math.hypot(px - cx, py - cy) - radius) - stroke / 2
  );
}

function drawOscarMark(canvas, cx, cy, size, ringColor, barColor) {
  const radius = size * 0.36;
  const ringStroke = Math.max(1.3, size * 0.045);
  drawCircleStroke(canvas, cx, cy, radius, ringStroke, ringColor);

  const barWidth = Math.max(1.4, size * 0.055);
  const bars = [
    [-0.22, 0.22],
    [-0.11, 0.34],
    [0, 0.18],
    [0.12, 0.31],
    [0.23, 0.24],
  ];

  for (const [offset, height] of bars) {
    drawRoundedRect(
      canvas,
      cx + offset * size,
      cy,
      barWidth,
      height * size,
      barWidth / 2,
      barColor
    );
  }
}

function drawIcon(width, height) {
  const canvas = createCanvas(width, height);
  const size = Math.min(width, height);

  drawRoundedRect(canvas, width / 2, height / 2, width, height, size * 0.22, colors.cream);
  drawRoundedRect(
    canvas,
    width / 2,
    height / 2,
    width - size * 0.035,
    height - size * 0.035,
    size * 0.2,
    hex("#faf8f3")
  );
  drawCircleStroke(canvas, width / 2, height / 2, size * 0.395, size * 0.018, colors.rule);
  drawOscarMark(canvas, width / 2, height / 2, size * 0.76, colors.ink, colors.accent);
  return canvas;
}

function drawTransparentMark(width, height, mode) {
  const canvas = createCanvas(width, height);
  const size = Math.min(width, height) * 0.82;
  const ring = mode === "dark" ? colors.cream : colors.accent;
  const bars = mode === "dark" ? colors.accent : colors.ink;

  drawOscarMark(canvas, width / 2, height / 2, size, ring, bars);
  return canvas;
}

function writePng(relativePath, canvas) {
  const output = resolve(root, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, encodePng(canvas.width, canvas.height, canvas.data));
  console.log(`wrote ${relativePath}`);
}

async function writeWordmark(relativePath) {
  const output = resolve(root, relativePath);
  mkdirSync(dirname(output), { recursive: true });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1366" height="768" viewBox="0 0 1366 768">
      <g transform="translate(190 274) scale(9.1667)" fill="none">
        <circle cx="12" cy="12" r="9" stroke="${palette.accent}" stroke-width="1.35"/>
        <path d="M7.8 9.9v4.2M9.9 8.5v7M12 10.4v3.2M14.1 8.9v6.2M16.2 9.7v4.6"
          stroke="${palette.ink}" stroke-width="1.35" stroke-linecap="round"/>
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

writePng("packages/web/public/OSCAR_AVATAR.png", drawIcon(1024, 1024));
writePng("packages/web/public/OSCAR_ICON_192.png", drawIcon(192, 192));
writePng("packages/web/public/OSCAR_ICON_512.png", drawIcon(512, 512));
writePng("packages/web/public/OSCAR_LIGHT_LOGO.png", drawTransparentMark(1656, 1675, "light"));
writePng("packages/web/public/OSCAR_DARK_LOGO.png", drawTransparentMark(1664, 1683, "dark"));
await writeWordmark("packages/web/public/OSCARLOGO.png");

for (const file of ["OSCAR_AVATAR.png", "OSCAR_LIGHT_LOGO.png", "OSCAR_DARK_LOGO.png"]) {
  copyFileSync(
    resolve(root, "packages/web/public", file),
    resolve(root, "packages/desktop/public", file)
  );
  console.log(`copied packages/desktop/public/${file}`);
}
