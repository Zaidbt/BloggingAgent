// Brand assets for the site: favicon, app icons and the default social image. `node agent/brand.mjs`
import { writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const MARK = `<g transform="translate(64 0) scale(-1 1)" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 25h6l20-11v36L19 39h-6z" fill="#fff"/><path d="M21 40l3 12h7l-3-11"/><path d="M46 24a11 11 0 0 1 0 16M52 17a21 21 0 0 1 0 30"/></g>`;
const svg = (size = 64) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><rect width="64" height="64" rx="14" fill="#c1272d"/>${MARK}</svg>`;
const pub = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url));
const name = JSON.parse((await import('node:fs')).readFileSync(fileURLToPath(new URL('../site.config.json', import.meta.url)), 'utf8'));

writeFileSync(pub('favicon.svg'), svg());
for (const [f, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) await sharp(Buffer.from(svg(s))).png().toFile(pub(f));

const fontsDir = pub('fonts/');
const fontCss = `@font-face{font-family:'Cairo';font-weight:500 800;src:url(file://${fontsDir}cairo-500-800-arabic.woff2) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E}`;
const html = `<!doctype html><meta charset="utf-8"><style>${fontCss}*{margin:0}body{width:1200px;height:630px;font-family:'Cairo',sans-serif;color:#fff;background:linear-gradient(135deg,#7d1016,#c1272d);display:flex;align-items:center;justify-content:center;gap:48px;position:relative;overflow:hidden}
.g{position:absolute;width:900px;height:900px;right:-250px;top:-420px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.22),transparent 65%)}
.logo{width:230px;height:230px;border-radius:52px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 20px 60px rgba(0,0,0,.3);position:relative}
.logo svg{width:170px;height:170px}.logo svg *{stroke:#c1272d}.logo svg path[fill="#fff"]{fill:#c1272d}
h1{font-size:150px;font-weight:800;line-height:1.1;position:relative}p{font-size:42px;font-weight:600;opacity:.92;position:relative;margin-top:6px}
.bar{position:absolute;bottom:0;left:0;right:0;height:14px;background:#006233}</style>
<div class="g"></div><div class="logo"><svg viewBox="0 0 64 64">${MARK}</svg></div><div style="direction:rtl;position:relative"><h1>${name.name}</h1><p>${name.tagline}</p></div><div class="bar"></div>`;
const { chromium } = await (async () => { for (const m of ['playwright', '/opt/node-tools/node_modules/playwright/index.mjs']) { try { return await import(m); } catch {} } throw new Error('Playwright not found'); })();
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
writeFileSync('.cache-og.html', html);
await p.goto(pathToFileURL('.cache-og.html').href);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: pub('og-default.jpg'), type: 'jpeg', quality: 90 });
await b.close(); rmSync('.cache-og.html');
console.log('brand assets written');
