// Editorial thumbnail: the guaranteed last step of the image chain. Category colours + a topic icon + an optional
// headline figure ("33 قتيلاً", "16,20 درهماً"). Rendered with Chromium so Arabic text is shaped correctly.
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const PALETTES = {
  politics: ['#5c0d12', '#c1272d'], economy: ['#003d24', '#0a8a4f'], society: ['#4d2209', '#c8782a'],
  sport: ['#07351a', '#1fa34a'], culture: ['#2f1042', '#8a3fb0'], tech: ['#0a2548', '#1f6fd1'],
  health: ['#08403f', '#1fa3a3'], world: ['#141b2b', '#4a63a0'],
};
const DEFAULT_ICON = { politics: 'landmark', economy: 'chart', society: 'shield', sport: 'football', culture: 'mic', tech: 'chip', health: 'heart', world: 'globe' };

const S = 'fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  scale: `<path d="M32 10v40M20 54h24M14 14h36"/><path d="M14 14L6 32h16zM50 14l-8 18h16z"/><path d="M6 32a8 5 0 0 0 16 0M42 32a8 5 0 0 0 16 0"/>`,
  landmark: `<path d="M6 24L32 10l26 14zM12 28v20M24 28v20M40 28v20M52 28v20M6 52h52M4 58h56"/>`,
  football: `<circle cx="32" cy="32" r="24"/><path d="M32 20l10 7-4 12H26l-4-12zM32 20V8M42 27l12-4M38 39l8 10M26 39l-8 10M22 27L10 23"/>`,
  fuel: `<rect x="10" y="10" width="26" height="44" rx="3"/><rect x="16" y="16" width="14" height="12" rx="1"/><path d="M36 24h6a4 4 0 0 1 4 4v16a4 4 0 0 0 8 0V24l-6-6M6 54h34"/>`,
  car: `<path d="M8 40l5-14c1-3 3-5 7-5h24c4 0 6 2 7 5l5 14v10H8z"/><circle cx="20" cy="50" r="5"/><circle cx="44" cy="50" r="5"/><path d="M14 38h36"/><rect x="26" y="12" width="12" height="6" rx="1"/>`,
  globe: `<circle cx="32" cy="32" r="24"/><ellipse cx="32" cy="32" rx="10" ry="24"/><path d="M8 32h48M12 20h40M12 44h40"/>`,
  climate: `<path d="M26 36V12a6 6 0 0 1 12 0v24a12 12 0 1 1-12 0z"/><circle cx="32" cy="46" r="4"/><path d="M4 58c6-4 10-4 15 0s10 4 15 0 10-4 15 0 8 3 11 1"/>`,
  chart: `<path d="M8 56V8M8 56h48"/><rect x="16" y="36" width="8" height="14"/><rect x="30" y="26" width="8" height="24"/><rect x="44" y="14" width="8" height="36"/>`,
  flask: `<path d="M24 8h16M28 8v18L12 52a4 4 0 0 0 4 6h32a4 4 0 0 0 4-6L36 26V8M18 44h28"/>`,
  bolt: `<path d="M36 6L14 36h16l-4 22 24-32H34z"/>`,
  shield: `<path d="M32 6l20 8v16c0 14-9 24-20 28C21 54 12 44 12 30V14z"/><path d="M23 32l7 7 12-14"/>`,
  heart: `<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z"/><path d="M14 32h10l4-8 6 14 4-6h12"/>`,
  mic: `<rect x="24" y="6" width="16" height="30" rx="8"/><path d="M14 30a18 18 0 0 0 36 0M32 48v10M22 58h20"/>`,
  chip: `<rect x="18" y="18" width="28" height="28" rx="3"/><path d="M26 6v12M38 6v12M26 46v12M38 46v12M6 26h12M6 38h12M46 26h12M46 38h12"/>`,
  book: `<path d="M8 12h20a4 4 0 0 1 4 4v38a4 4 0 0 0-4-4H8zM56 12H36a4 4 0 0 0-4 4v38a4 4 0 0 1 4-4h20z"/>`,
};

const star = (cx, cy, r, rot = 0) => Array.from({ length: 16 }, (_, i) => { const a = Math.PI / 8 * i + rot, rad = i % 2 ? r * 0.62 : r; return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`; }).join(' ');
const pattern = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><polygon points="${star(100, 100, 78)}" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2.4"/><polygon points="${star(100, 100, 40, Math.PI / 8)}" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".15" stroke-width="2"/></svg>`);

const fontsDir = fileURLToPath(new URL('../public/fonts/', import.meta.url));
const fontCss = readdirSync(fontsDir).filter((f) => /cairo|plex-sans-arabic-(400|600)/.test(f)).map((f) => {
  const cairo = f.startsWith('cairo');
  const w = cairo ? '500 800' : (f.match(/-(\d{3})-/) || [])[1];
  const range = /arabic/.test(f) ? 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E' : 'U+0000-00FF,U+2000-206F';
  return `@font-face{font-family:'${cairo ? 'Cairo' : 'IBM Plex Sans Arabic'}';font-weight:${w};src:url(file://${fontsDir}${f}) format('woff2');unicode-range:${range}}`;
}).join('');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function thumbHtml({ category = 'world', icon, stat, statLabel }) {
  const [c1, c2] = PALETTES[category] || PALETTES.world;
  const svg = (ICONS[icon] ?? ICONS[DEFAULT_ICON[category]] ?? ICONS.globe);
  const iconSvg = `<svg viewBox="0 0 64 64" width="250" height="250" ${S}>${svg}</svg>`;
  return `<!doctype html><html lang="ar"><meta charset="utf-8"><style>${fontCss}
*{margin:0;box-sizing:border-box}html,body{width:1600px;height:900px;overflow:hidden}
body{font-family:'Cairo',Tahoma,sans-serif;color:#fff;background:linear-gradient(135deg,${c1} 0%,${c2} 100%);position:relative;overflow:hidden}
.pat{position:absolute;inset:0;background:url("data:image/svg+xml,${pattern}")}
.glow{position:absolute;width:1100px;height:1100px;left:900px;top:-420px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.30),rgba(255,255,255,0) 65%)}
.glow2{position:absolute;width:900px;height:900px;left:-300px;top:500px;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,.35),rgba(0,0,0,0) 70%)}
.row{position:absolute;left:260px;width:1080px;top:70px;height:340px;display:flex;align-items:center;justify-content:${stat ? 'space-between' : 'center'};gap:50px}
.badge{width:270px;height:270px;border-radius:50%;background:rgba(255,255,255,.12);border:4px solid rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;box-shadow:0 30px 80px rgba(0,0,0,.25);flex:none}
.badge svg{width:${stat ? 150 : 200}px;height:${stat ? 150 : 200}px}
.stat{flex:1;direction:rtl;text-align:right}
.num{direction:ltr;font-size:${String(stat || '').length > 6 ? 150 : 200}px;font-weight:800;line-height:1.05;letter-spacing:-2px;text-shadow:0 8px 40px rgba(0,0,0,.28)}
.lab{font-size:46px;font-weight:700;opacity:.92;line-height:1.35;margin-top:10px;max-width:620px}
.bar{position:absolute;left:1230px;top:48px;width:110px;height:10px;border-radius:6px;background:#fff;opacity:.85}
</style><div class="pat"></div><div class="glow"></div><div class="glow2"></div><div class="bar"></div>
<div class="row"><div class="badge">${iconSvg}</div>${stat ? `<div class="stat"><div class="num">${esc(stat)}</div>${statLabel ? `<div class="lab">${esc(statLabel)}</div>` : ''}</div>` : ''}</div></html>`;
}

/** Render a thumbnail JPG (1600x900). `browser` is optional: pass one to reuse it across calls. */
export async function makeThumb(opts, file, browser) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const own = !browser;
  browser ||= await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const tmp = file + '.html';
  writeFileSync(tmp, thumbHtml(opts));
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  await page.close();
  rmSync(tmp, { force: true });
  if (own) await browser.close();
}
