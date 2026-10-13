#!/usr/bin/env node
// One contact sheet of the newest article images, so a single look verifies every photo. Prints the order and file names.
//   node agent/contact.mjs [N=3]   -> .cache/contact.png
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const dir = new URL('../src/assets/posts/', import.meta.url);
const n = Number(process.argv[2] || 3);
const files = readdirSync(dir).filter((f) => f.endsWith('.jpg')).map((f) => ({ f, t: statSync(new URL(f, dir)).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, n);
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
const w = 640, h = 360, gap = 12;
const tiles = await Promise.all(files.map(async ({ f }, i) => ({ input: await sharp(new URL(f, dir).pathname).resize(w, h, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer(), left: (i % 2) * (w + gap), top: Math.floor(i / 2) * (h + gap) })));
const rows = Math.ceil(files.length / 2);
const out = new URL('../.cache/contact.png', import.meta.url).pathname;
await sharp({ create: { width: w * 2 + gap, height: rows * (h + gap), channels: 3, background: '#222' } }).composite(tiles).png().toFile(out);
files.forEach(({ f }, i) => console.log(`${i + 1} (row ${Math.floor(i / 2) + 1}, col ${(i % 2) + 1}): ${f}`));
console.log('contact sheet:', out);
