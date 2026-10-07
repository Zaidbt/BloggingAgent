#!/usr/bin/env node
// Instagram carousel generator: for each article -> 3 PNG slides (1080x1350) + an Arabic caption.
//   node agent/social.mjs                -> every article
//   node agent/social.mjs <part-of-slug> -> articles whose file name contains it
// Needs Playwright with Chromium (set PLAYWRIGHT_MODULE to its path if it is not in node_modules).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('site.config.json', root), 'utf8'));
const postsDir = new URL('src/content/posts/', root);
const out = new URL('social-out/', root);
const fontsDir = fileURLToPath(new URL('public/fonts/', root));
const siteHost = new URL(cfg.url).host + (cfg.base || '');
const only = process.argv[2];

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const J = (raw, key) => { const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')); try { return m ? JSON.parse(m[1]) : undefined; } catch { return m?.[1]; } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parsePost(file) {
  const raw = readFileSync(new URL(file, postsDir), 'utf8');
  const body = raw.split(/^---\s*$/m)[2] || '';
  const bullets = [...(body.split(/\*\*أبرز النقاط\*\*/)[1] || '').split('## ')[0].matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()).slice(0, 4);
  const catSlug = J(raw, 'category');
  return {
    file, title: J(raw, 'title'), description: J(raw, 'description'), tags: J(raw, 'tags') || [],
    image: J(raw, 'image'), credit: J(raw, 'imageCredit'), bullets,
    category: cfg.categories.find((c) => c.slug === catSlug)?.label ?? catSlug,
    slug: file.replace(/\.md$/, ''),
  };
}

const star = (cx, cy, r, rot = 0) => Array.from({ length: 16 }, (_, i) => { const a = Math.PI / 8 * i + rot, rad = i % 2 ? r * 0.62 : r; return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`; }).join(' ');
const patternSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><polygon points="${star(100, 100, 78)}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="2"/><polygon points="${star(100, 100, 40, Math.PI / 8)}" fill="#fff" fill-opacity=".04" stroke="#fff" stroke-opacity=".12" stroke-width="2"/></svg>`);

const fontCss = readdirSync(fontsDir).filter((f) => /cairo.*arabic|plex.*(400|600).*arabic|latin/.test(f)).map((f) => {
  const fam = f.startsWith('cairo') ? 'Cairo' : 'IBM Plex Sans Arabic';
  const w = f.startsWith('cairo') ? '500 800' : (f.match(/-(\d{3})-/) || [])[1];
  const range = /arabic/.test(f) ? 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E' : 'U+0000-00FF,U+2000-206F';
  return `@font-face{font-family:'${fam}';font-weight:${w};src:url(file://${fontsDir}${f}) format('woff2');unicode-range:${range}}`;
}).join('');

const base = `${fontCss}
*{box-sizing:border-box;margin:0}html,body{width:1080px;height:1350px}
body{direction:rtl;font-family:'Cairo','IBM Plex Sans Arabic',Tahoma,sans-serif;color:#fff;position:relative;overflow:hidden;background:#14110e}
.brand{position:absolute;top:56px;right:64px;display:flex;align-items:center;gap:18px;font-weight:800;font-size:40px;z-index:5}
.logo{width:64px;height:64px}
.pill{display:inline-block;background:#c1272d;color:#fff;font-weight:700;font-size:30px;padding:6px 26px;border-radius:999px}
.foot{position:absolute;bottom:52px;right:64px;left:64px;display:flex;justify-content:space-between;align-items:center;font-size:30px;font-weight:700;z-index:5}
.foot .url{opacity:.85;direction:ltr;font-family:'IBM Plex Sans Arabic',sans-serif;font-weight:500;font-size:28px}
.dots{display:flex;gap:10px}.dots i{width:14px;height:14px;border-radius:50%;background:#fff;opacity:.35}.dots i.on{opacity:1;background:#c1272d}`;

const logo = `<svg class="logo" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#c1272d"/><path d="M32 8l6.5 14.6L53 18l-4.6 14.5L56 32l-7.6 3.5L53 50l-14.5-4.6L32 56l-6.5-10.6L11 50l4.6-14.5L8 32l7.6-.5L11 18l14.5 4.6z" fill="#fff"/><circle cx="32" cy="32" r="7" fill="#006233"/></svg>`;
const header = `<div class="brand">${logo}<span>${esc(cfg.name)}</span></div>`;
const dots = (n) => `<div class="dots">${[0, 1, 2].map((i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div>`;

const slide1 = (p, img) => `<style>${base}
.bg{position:absolute;inset:0;background:url(${img}) center/cover}
.shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,8,6,.97) 0%,rgba(10,8,6,.9) 38%,rgba(10,8,6,.35) 66%,rgba(10,8,6,.55) 100%)}
.txt{position:absolute;right:64px;left:64px;bottom:190px}
h1{font-size:${p.title.length > 56 ? 70 : 78}px;line-height:1.38;font-weight:800;margin-top:26px;text-wrap:balance}
.sub{font-size:34px;line-height:1.7;opacity:.88;margin-top:26px;font-family:'IBM Plex Sans Arabic','Cairo',sans-serif;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.swipe{font-weight:700}</style>
<div class="bg"></div><div class="shade"></div>${header}
<div class="txt"><span class="pill">${esc(p.category)}</span><h1>${esc(p.title)}</h1><p class="sub">${esc(p.description)}</p></div>
<div class="foot"><span class="swipe">اسحب لقراءة أبرز النقاط ‹</span>${dots(0)}</div>`;

const slide2 = (p) => `<style>${base}
body{background:linear-gradient(160deg,#0b3d24 0%,#14110e 70%);}
.pat{position:absolute;inset:0;background:url("data:image/svg+xml,${patternSvg}");opacity:1}
.wrap{position:absolute;right:64px;left:64px;top:190px;bottom:150px;display:flex;flex-direction:column}
h2{font-size:76px;font-weight:800;margin-bottom:12px}h2 span{color:#ee5258}
.sm{font-size:30px;opacity:.75;margin-bottom:40px;line-height:1.5}
ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:22px}
li{background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.14);border-radius:28px;padding:26px 34px 26px 30px;font-size:${p.bullets.length > 3 ? 36 : 40}px;line-height:1.6;font-family:'IBM Plex Sans Arabic','Cairo',sans-serif;font-weight:500;position:relative;padding-right:84px}
li::before{content:"";position:absolute;right:32px;top:38px;width:26px;height:26px;background:#c1272d;transform:rotate(45deg);border-radius:6px}
</style><div class="pat"></div>${header}
<div class="wrap"><h2>أبرز <span>النقاط</span></h2><p class="sm">${esc(p.title)}</p>
<ul>${p.bullets.map((b) => `<li>${esc(b.replace(/\*\*/g, ''))}</li>`).join('')}</ul></div>
<div class="foot"><span>${esc(cfg.name)}</span>${dots(1)}</div>`;

const slide3 = (p) => `<style>${base}
body{background:linear-gradient(200deg,#c1272d 0%,#7a1117 100%)}
.pat{position:absolute;inset:0;background:url("data:image/svg+xml,${patternSvg}")}
.mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px;gap:34px}
.big{font-size:84px;font-weight:800;line-height:1.35}
.btn{background:#fff;color:#c1272d;font-weight:800;font-size:44px;padding:22px 58px;border-radius:999px}
.u{direction:ltr;font-family:'IBM Plex Sans Arabic',sans-serif;font-size:36px;font-weight:500;opacity:.92}
.tags{font-size:32px;opacity:.9;line-height:1.8}
.src{font-size:26px;opacity:.75}
</style><div class="pat"></div>${header}
<div class="mid"><div class="big">الخبر كاملاً<br>مع المصادر والتفاصيل</div><div class="btn">الرابط في البايو</div><div class="u">${esc(siteHost)}</div>
<div class="tags">${p.tags.slice(0, 4).map((t) => '#' + esc(t.replace(/\s+/g, '_'))).join(' ')}</div></div>
<div class="foot"><span>تابعونا للمزيد</span>${dots(2)}</div>`;

function caption(p) {
  const tags = ['أخبار_المغرب', 'المغرب', ...p.tags.slice(0, 4).map((t) => t.replace(/\s+/g, '_')), p.category.replace(/\s+/g, '_')];
  const credit = p.credit ? `\n\nالصورة: ${p.credit.name} / ${p.credit.source}` : '';
  return `${p.title}\n\n${p.description}\n\n${p.bullets.map((b) => '▪️ ' + b.replace(/\*\*/g, '')).join('\n')}\n\nالخبر كاملاً مع المصادر على الرابط في البايو 🔗 ${siteHost}${credit}\n\n${[...new Set(tags)].map((t) => '#' + t).join(' ')}\n`;
}

mkdirSync(out, { recursive: true });
const files = readdirSync(postsDir).filter((f) => f.endsWith('.md') && (!only || f.includes(only)));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const tmp = fileURLToPath(new URL('social-out/_tmp.html', root));
for (const f of files) {
  const p = parsePost(f);
  const dir = new URL(`${p.slug}/`, out);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const img = pathToFileURL(fileURLToPath(new URL(p.image.replace('../../', 'src/'), root))).href;
  const slides = [slide1(p, img), p.bullets.length ? slide2(p) : null, slide3(p)].filter(Boolean);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const [i, html] of slides.entries()) {
    writeFileSync(tmp, `<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8">${html}</html>`);
    await page.goto(pathToFileURL(tmp).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
    await page.screenshot({ path: fileURLToPath(new URL(`slide-${i + 1}.png`, dir)) });
  }
  await page.close();
  writeFileSync(new URL('caption.txt', dir), caption(p));
  console.log(`${p.slug}: ${slides.length} slides + caption`);
}
await browser.close(); rmSync(tmp, { force: true });
