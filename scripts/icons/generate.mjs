#!/usr/bin/env node
/**
 * Generate the PWA icons from the same mark as `favicon.svg`.
 *
 * A tiny rasteriser plus Node's own zlib, so the repository needs no image
 * toolchain to reproduce the icons:
 *
 *   node scripts/icons/generate.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDir = join(fileURLToPath(new URL('../..', import.meta.url)), 'apps', 'web', 'public');

const INK = [0x1b, 0x1a, 0x18];
const CANVAS = [0xf7, 0xf5, 0xf2];
const ACCENT = [0xd9, 0x70, 0x2f];

/** 4x supersampling, which is enough for a mark made of circles and strokes. */
const SAMPLES = 4;

function mix(base, colour, alpha) {
  return [
    Math.round(base[0] * (1 - alpha) + colour[0] * alpha),
    Math.round(base[1] * (1 - alpha) + colour[1] * alpha),
    Math.round(base[2] * (1 - alpha) + colour[2] * alpha),
  ];
}

function insideRoundedRect(x, y, size, radius, inset) {
  const min = inset;
  const max = size - inset;
  if (x < min || y < min || x > max || y > max) return false;
  const corners = [
    [min + radius, min + radius],
    [max - radius, min + radius],
    [min + radius, max - radius],
    [max - radius, max - radius],
  ];
  for (const [cx, cy] of corners) {
    const outX = (cx < (min + max) / 2 && x < cx) || (cx > (min + max) / 2 && x > cx);
    const outY = (cy < (min + max) / 2 && y < cy) || (cy > (min + max) / 2 && y > cy);
    if (outX && outY) return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  }
  return true;
}

function nearSegment(x, y, x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return (x - px) ** 2 + (y - py) ** 2 <= (width / 2) ** 2;
}

function insideRing(x, y, cx, cy, radius, width) {
  const distance = Math.hypot(x - cx, y - cy);
  return Math.abs(distance - radius) <= width / 2;
}

function insideDisc(x, y, cx, cy, radius) {
  return Math.hypot(x - cx, y - cy) <= radius;
}

/** Draw the mark at unit scale: a stick figure with the tracked joint highlighted. */
function sample(u, v, maskable) {
  const inset = maskable ? 0.1 : 0;
  const scale = maskable ? 0.8 : 1;
  if (!insideRoundedRect(u, v, 1, maskable ? 0.5 : 0.22, inset)) return null;

  const x = (u - inset) / scale;
  const y = (v - inset) / scale;
  const stroke = 0.055;

  if (insideDisc(x, y, 0.625, 0.47, 0.062)) return ACCENT;
  if (insideRing(x, y, 0.5, 0.25, 0.078, stroke)) return CANVAS;
  if (nearSegment(x, y, 0.5, 0.33, 0.5, 0.56, stroke)) return CANVAS;
  if (nearSegment(x, y, 0.5, 0.375, 0.36, 0.47, stroke)) return CANVAS;
  if (nearSegment(x, y, 0.5, 0.375, 0.64, 0.47, stroke)) return CANVAS;
  if (nearSegment(x, y, 0.5, 0.56, 0.375, 0.75, stroke)) return CANVAS;
  if (nearSegment(x, y, 0.5, 0.56, 0.625, 0.75, stroke)) return CANVAS;
  return INK;
}

function render(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let colour = null;
      let hits = 0;
      let alphaHits = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const u = (px + (sx + 0.5) / SAMPLES) / size;
          const v = (py + (sy + 0.5) / SAMPLES) / size;
          const value = sample(u, v, maskable);
          if (!value) continue;
          alphaHits += 1;
          if (value !== INK) {
            colour = colour ? mix(colour, value, 1 / (hits + 1)) : value;
            hits += 1;
          }
        }
      }
      const total = SAMPLES * SAMPLES;
      const alpha = alphaHits / total;
      const coverage = hits / total;
      const base = colour ? mix(INK, colour, Math.min(1, coverage * 1.6)) : INK;
      const offset = (py * size + px) * 4;
      pixels[offset] = base[0];
      pixels[offset + 1] = base[1];
      pixels[offset + 2] = base[2];
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }
  return pixels;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row += 1) {
    raw[row * (size * 4 + 1)] = 0; // no filter
    pixels.copy(raw, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const target of targets) {
  const png = encodePng(target.size, render(target.size, target.maskable));
  writeFileSync(join(outputDir, target.file), png);
  console.log(`✓ ${target.file} ${(png.length / 1024).toFixed(1)} kB`);
}
