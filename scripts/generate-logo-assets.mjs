import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deflateSync } from "node:zlib";

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

function sdSegment(px, py, ax, ay, bx, by, stroke) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - (ax + vx * c), py - (ay + vy * c)) - stroke / 2;
}

function drawRoundedRect(canvas, cx, cy, width, height, radius, color) {
  drawSdf(
    canvas,
    { x: cx - width / 2 - 2, y: cy - height / 2 - 2, width: width + 4, height: height + 4 },
    color,
    (px, py) => sdRoundedRect(px, py, cx, cy, width, height, radius)
  );
}

function drawLine(canvas, ax, ay, bx, by, stroke, color) {
  const pad = stroke + 3;
  drawSdf(
    canvas,
    {
      x: Math.min(ax, bx) - pad,
      y: Math.min(ay, by) - pad,
      width: Math.abs(bx - ax) + pad * 2,
      height: Math.abs(by - ay) + pad * 2,
    },
    color,
    (px, py) => sdSegment(px, py, ax, ay, bx, by, stroke)
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

function drawArcStroke(canvas, cx, cy, radius, stroke, start, end, color) {
  const pad = stroke + 3;
  const span = (end - start + Math.PI * 2) % (Math.PI * 2);
  const inArc = (angle) => ((angle - start + Math.PI * 2) % (Math.PI * 2)) <= span;

  drawSdf(
    canvas,
    {
      x: cx - radius - pad,
      y: cy - radius - pad,
      width: (radius + pad) * 2,
      height: (radius + pad) * 2,
    },
    color,
    (px, py) => {
      const angle = Math.atan2(py - cy, px - cx);
      if (inArc(angle)) return Math.abs(Math.hypot(px - cx, py - cy) - radius) - stroke / 2;

      const sx = cx + Math.cos(start) * radius;
      const sy = cy + Math.sin(start) * radius;
      const ex = cx + Math.cos(end) * radius;
      const ey = cy + Math.sin(end) * radius;
      return Math.min(Math.hypot(px - sx, py - sy), Math.hypot(px - ex, py - ey)) - stroke / 2;
    }
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

function drawWordmark(width, height) {
  const canvas = createCanvas(width, height);
  const markSize = Math.min(width, height) * 0.34;
  const markCx = width * 0.2;
  const cy = height * 0.5;

  drawOscarMark(canvas, markCx, cy, markSize, colors.accent, colors.ink);

  const stroke = height * 0.055;
  const letterHeight = height * 0.22;
  const r = letterHeight * 0.39;
  let x = width * 0.37;
  const gap = height * 0.065;

  drawCircleStroke(canvas, x, cy, r, stroke, colors.ink);
  x += r * 2 + gap;

  drawLine(canvas, x + r * 0.9, cy - r, x, cy - r, stroke, colors.ink);
  drawLine(canvas, x, cy - r, x, cy, stroke, colors.ink);
  drawLine(canvas, x, cy, x + r * 0.9, cy, stroke, colors.ink);
  drawLine(canvas, x + r * 0.9, cy, x + r * 0.9, cy + r, stroke, colors.ink);
  drawLine(canvas, x + r * 0.9, cy + r, x, cy + r, stroke, colors.ink);
  x += r * 1.25 + gap;

  drawArcStroke(canvas, x, cy, r, stroke, 0.62, Math.PI * 2 - 0.62, colors.ink);
  x += r * 2 + gap * 0.8;

  drawLine(canvas, x - r * 0.8, cy + r, x, cy - r, stroke, colors.ink);
  drawLine(canvas, x + r * 0.8, cy + r, x, cy - r, stroke, colors.ink);
  drawLine(canvas, x - r * 0.42, cy + r * 0.18, x + r * 0.42, cy + r * 0.18, stroke * 0.78, colors.ink);
  x += r * 1.7 + gap;

  drawLine(canvas, x - r * 0.78, cy + r, x - r * 0.78, cy - r, stroke, colors.ink);
  drawLine(canvas, x - r * 0.78, cy - r, x + r * 0.38, cy - r, stroke, colors.ink);
  drawLine(canvas, x + r * 0.42, cy - r, x + r * 0.42, cy, stroke, colors.ink);
  drawLine(canvas, x - r * 0.78, cy, x + r * 0.42, cy, stroke, colors.ink);
  drawLine(canvas, x - r * 0.1, cy + r * 0.05, x + r * 0.58, cy + r, stroke, colors.ink);

  return canvas;
}

function writePng(relativePath, canvas) {
  const output = resolve(root, relativePath);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, encodePng(canvas.width, canvas.height, canvas.data));
  console.log(`wrote ${relativePath}`);
}

writePng("packages/web/public/OSCAR_AVATAR.png", drawIcon(1024, 1024));
writePng("packages/web/public/OSCAR_ICON_192.png", drawIcon(192, 192));
writePng("packages/web/public/OSCAR_ICON_512.png", drawIcon(512, 512));
writePng("packages/web/public/OSCAR_LIGHT_LOGO.png", drawTransparentMark(1656, 1675, "light"));
writePng("packages/web/public/OSCAR_DARK_LOGO.png", drawTransparentMark(1664, 1683, "dark"));
writePng("packages/web/public/OSCARLOGO.png", drawWordmark(1366, 768));

for (const file of ["OSCAR_AVATAR.png", "OSCAR_LIGHT_LOGO.png", "OSCAR_DARK_LOGO.png"]) {
  copyFileSync(
    resolve(root, "packages/web/public", file),
    resolve(root, "packages/desktop/public", file)
  );
  console.log(`copied packages/desktop/public/${file}`);
}
