#!/usr/bin/env node
// Instagram carousels for «الخبر 212»: 5 slides (1080x1350) + caption + alt text per story.
//   node agent/instagram.mjs            -> every file in social/content/*.json
//   node agent/instagram.mjs budget     -> only matching files
// Output: social-out/<name>/slide-1..5.png, caption.txt  (social-out is git-ignored)
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('site.config.json', root), 'utf8'));
const fontsDir = fileURLToPath(new URL('public/fonts/', root));
const only = process.argv[2];
const HANDLE = '@alkhabar212';

const loadPw = async () => { for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright/index.mjs']) { if (m) try { return await import(m); } catch {} } throw new Error('Playwright not found'); };
const { chromium } = await loadPw();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hl = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, '<em>$1</em>');
const J = (raw, key) => { const m = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')); try { return m ? JSON.parse(m[1]) : undefined; } catch { return m?.[1]; } };
const fontCss = readdirSync(fontsDir).filter((f) => /cairo|plex-sans-arabic-(400|500|600)/.test(f)).map((f) => {
  const cairo = f.startsWith('cairo');
  const w = cairo ? '500 800' : (f.match(/-(\d{3})-/) || [])[1];
  const range = /arabic/.test(f) ? 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E' : 'U+0000-00FF,U+2000-206F';
  return `@font-face{font-family:'${cairo ? 'Cairo' : 'IBM Plex Sans Arabic'}';font-weight:${w};src:url(file://${fontsDir}${f}) format('woff2');unicode-range:${range}}`;
}).join('');

// ---- design system: ink / paper / signal red, one accent green ----
const INK = '#0b0b0f', PAPER = '#f3eee4', RED = '#e1252d', GREEN = '#0a8f4e';
const base = `${fontCss}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:1080px;height:1350px}
body{direction:rtl;font-family:'Cairo','IBM Plex Sans Arabic',sans-serif;position:relative;overflow:hidden;background:${INK};color:#fff}
em{font-style:normal;color:${RED}}
.top{position:absolute;top:56px;right:64px;left:64px;display:flex;justify-content:space-between;align-items:center;z-index:9}
.brand{display:flex;align-items:center;gap:16px;font-weight:800;font-size:36px}
.mark{width:60px;height:60px;border-radius:15px;background:${RED};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:27px;letter-spacing:-1px;color:#fff;direction:ltr;position:relative}
.mark::after{content:"";position:absolute;bottom:9px;left:14px;right:14px;height:4px;border-radius:2px;background:#7dd3a0}
.count{font-family:'Cairo';font-weight:700;font-size:30px;direction:ltr;opacity:.75;letter-spacing:2px}
.bot{position:absolute;bottom:50px;right:64px;left:64px;z-index:9;display:flex;flex-direction:column;gap:22px}
.prog{display:flex;gap:8px;direction:rtl}.prog i{flex:1;height:6px;border-radius:3px;background:currentColor;opacity:.22}.prog i.on{background:${RED};opacity:1}
.meta{display:flex;justify-content:space-between;font-size:28px;font-weight:600;opacity:.8}
.meta .h{direction:ltr;font-family:'Cairo';font-weight:700;letter-spacing:.5px}
.paper{background:${PAPER}}.t-paper{color:${INK}}.t-paper .mark{color:#fff}
.label{display:inline-flex;align-items:center;gap:14px;font-weight:800;font-size:34px;color:${RED};letter-spacing:.5px}
.label::before{content:"";width:46px;height:6px;background:${RED};border-radius:3px}`;

const chrome = (n, theme, hint = true) => `<div class="top ${theme === 'paper' ? 't-paper' : ''}"><div class="brand"><div class="mark">212</div><span>الخبر <span style="color:${RED}">212</span></span></div><div class="count">0${n} / 05</div></div>
<div class="bot" style="color:${theme === 'paper' ? INK : '#fff'}"><div class="prog">${[1, 2, 3, 4, 5].map((i) => `<i class="${i === n ? 'on' : ''}"></i>`).join('')}</div><div class="meta"><span>${hint ? 'اسحب لتكمل ‹' : 'شكراً لوقتك'}</span><span class="h">${hint ? HANDLE : ''}</span></div></div>`;

const fmtDate = (iso) => new Date(iso).toLocaleDateString('ar-MA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' });

const cover = (c, p, img) => `<style>${base}
.bg{position:absolute;inset:0;background:url(${img}) center/cover;filter:grayscale(1) contrast(1.15) brightness(1.05)}
.tint{position:absolute;inset:0;background:linear-gradient(to top,${INK} 0%,rgba(11,11,15,.9) 34%,rgba(11,11,15,.15) 66%,rgba(11,11,15,.55) 100%)}
.red{position:absolute;inset:0;background:${RED};mix-blend-mode:multiply;opacity:.65;-webkit-mask-image:linear-gradient(to bottom,#000 0%,transparent 60%);mask-image:linear-gradient(to bottom,#000 0%,transparent 60%)}
.stamp{position:absolute;left:30px;top:50%;transform:translateY(-50%) rotate(-90deg);transform-origin:center;font-weight:700;font-size:28px;letter-spacing:6px;opacity:.75;white-space:nowrap;direction:ltr;z-index:9}
.txt{position:absolute;right:64px;left:90px;bottom:200px;z-index:5}
.kick{display:inline-block;background:${RED};font-weight:800;font-size:30px;padding:8px 26px;border-radius:8px}
h1{font-size:${c.hook.replace(/[\[\]]/g, '').length > 46 ? 96 : 108}px;line-height:1.28;font-weight:800;margin-top:30px;text-wrap:balance}
.rule{width:140px;height:8px;background:${RED};border-radius:4px;margin-top:34px}</style>
<div class="bg"></div><div class="tint"></div><div class="red"></div>${chrome(1, 'ink')}
<div class="stamp">${esc(p.dateLatin)}</div>
<div class="txt"><span class="kick">${esc(c.kicker)}</span><h1>${hl(c.hook)}</h1><div class="rule"></div></div>`;

const summary = (c) => `<style>${base}
.w{position:absolute;right:64px;left:64px;top:210px;bottom:190px;display:flex;flex-direction:column;justify-content:center;gap:44px;color:${INK}}
p{font-size:70px;font-weight:800;line-height:1.5;text-wrap:balance}
.big{position:absolute;left:-30px;top:120px;font-size:520px;font-weight:800;line-height:1;color:${RED};opacity:.12;font-family:'Cairo'}</style>
<div class="paper" style="position:absolute;inset:0"></div><div class="big" style="direction:ltr">“</div>${chrome(2, 'paper')}
<div class="w"><span class="label">الخلاصة</span><p>${esc(c.summary)}</p></div>`;

function slide3(c) {
  const s = c.s3;
  if (s.type === 'stat') return `<style>${base}
.w{position:absolute;right:64px;left:64px;top:200px;bottom:190px;display:flex;flex-direction:column;justify-content:center}
.num{font-size:480px;font-weight:800;line-height:.95;color:#fff;direction:ltr;text-align:right;letter-spacing:-12px}
.num span{color:${RED}}
.lab{font-size:54px;font-weight:700;line-height:1.45;margin:10px 0 56px;max-width:900px}
.chips{display:flex;gap:18px}.chip{flex:1;border:3px solid rgba(255,255,255,.22);border-radius:26px;padding:26px 14px;text-align:center}
.chip b{display:block;font-size:68px;font-weight:800;color:#fff;direction:ltr;line-height:1.1}.chip small{font-size:27px;opacity:.78;font-weight:600;line-height:1.35;display:block;margin-top:6px}</style>
${chrome(3, 'ink')}<div class="w"><span class="label">بالأرقام</span><div class="num"><span>${esc(s.value)}</span></div><div class="lab">${esc(s.label)}</div><div class="chips">${s.chips.map(([v, l]) => `<div class="chip"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div></div>`;
  if (s.type === 'list') return `<style>${base}
.w{position:absolute;right:64px;left:64px;top:200px;bottom:190px;display:flex;flex-direction:column;justify-content:center}
h2{font-size:84px;font-weight:800;line-height:1.3;margin:16px 0 44px}
.it{display:flex;align-items:center;gap:28px;border-top:3px solid rgba(255,255,255,.18);padding:30px 0;font-size:56px;font-weight:700}
.it:last-child{border-bottom:3px solid rgba(255,255,255,.18)}.it b{font-size:92px;font-weight:800;color:${RED};width:100px;direction:ltr;text-align:center;line-height:1}</style>
${chrome(3, 'ink')}<div class="w"><span class="label">الخطر</span><h2>${esc(s.title)}</h2>${s.items.map((t, i) => `<div class="it"><b>${i + 1}</b><span>${esc(t)}</span></div>`).join('')}</div>`;
  const mx = Math.max(s.a[1], s.b[1]);
  return `<style>${base}
.w{position:absolute;right:64px;left:64px;top:200px;bottom:190px;display:flex;flex-direction:column;justify-content:center;gap:30px}
h2{font-size:58px;font-weight:800;line-height:1.35}
.row{display:flex;flex-direction:column;gap:12px}.row .t{display:flex;justify-content:space-between;align-items:baseline;font-size:44px;font-weight:700}
.row .t b{font-size:110px;font-weight:800;direction:ltr;line-height:1}
.bar{height:54px;border-radius:12px}
.badge{align-self:flex-start;margin-top:10px;display:flex;align-items:center;gap:22px}.badge b{background:${GREEN};font-size:96px;font-weight:800;padding:2px 40px;border-radius:20px;direction:ltr;line-height:1.25}.badge span{font-size:32px;opacity:.75;font-weight:600;max-width:320px;line-height:1.4}</style>
${chrome(3, 'ink')}<div class="w"><span class="label">بالأرقام</span><h2>${esc(s.title)}</h2>
<div class="row"><div class="t"><span>${esc(s.a[0])}</span><b style="opacity:.55">${s.a[1]}</b></div><div class="bar" style="width:100%;background:rgba(255,255,255,.28)"></div></div>
<div class="row"><div class="t"><span>${esc(s.b[0])}</span><b style="color:${RED}">${s.b[1]}</b></div><div class="bar" style="width:${(s.b[1] / mx * 100).toFixed(1)}%;background:${RED}"></div></div>
<div class="badge"><b>${esc(s.badge)}</b><span>${esc(s.note)}</span></div></div>`;
}

const why = (c) => `<style>${base}
.w{position:absolute;right:64px;left:64px;top:200px;bottom:190px;display:flex;flex-direction:column;justify-content:center;color:${INK}}
h2{font-size:92px;font-weight:800;line-height:1.25;margin:16px 0 40px}
.it{display:flex;gap:28px;align-items:flex-start;padding:30px 0;border-top:3px solid ${INK};font-size:48px;font-weight:600;line-height:1.5;font-family:'IBM Plex Sans Arabic','Cairo',sans-serif}
.it:last-child{border-bottom:3px solid ${INK}}.it i{flex:none;width:30px;height:30px;background:${RED};transform:rotate(45deg);border-radius:6px;margin-top:20px}</style>
<div class="paper" style="position:absolute;inset:0"></div>${chrome(4, 'paper')}
<div class="w"><span class="label">التفاصيل</span><h2>${esc(c.s4.title)}</h2>${c.s4.items.map((t) => `<div class="it"><i></i><span>${esc(t)}</span></div>`).join('')}</div>`;

const cta = (c) => `<style>${base}
body{background:linear-gradient(200deg,${RED} 0%,#8a0f16 100%)}
.pat{position:absolute;inset:0;opacity:.08;background-image:repeating-linear-gradient(45deg,#fff 0 2px,transparent 2px 46px),repeating-linear-gradient(-45deg,#fff 0 2px,transparent 2px 46px)}
.w{position:absolute;right:64px;left:64px;top:200px;bottom:190px;display:flex;flex-direction:column;justify-content:center;gap:40px}
h2{font-size:100px;font-weight:800;line-height:1.3}
.btn{align-self:flex-start;background:#fff;color:${RED};font-weight:800;font-size:54px;padding:26px 62px;border-radius:999px;box-shadow:0 18px 50px rgba(0,0,0,.3)}
.ask{font-size:46px;font-weight:600;line-height:1.5;max-width:900px;border-right:8px solid #fff;padding-right:28px}
.row{display:flex;gap:18px;font-size:36px;font-weight:700}.row span{border:3px solid rgba(255,255,255,.7);border-radius:999px;padding:10px 30px}
.h{direction:ltr;font-family:'Cairo';font-size:76px;font-weight:800;letter-spacing:1px;text-align:right}</style>
<div class="pat"></div>${chrome(5, 'ink', false)}
<div class="w"><h2>الخبر كاملاً<br>مع التفاصيل</h2><div class="btn">الرابط في البايو</div><div class="ask">${esc(c.cta)}</div><div class="row"><span>احفظ المنشور</span><span>شاركه</span><span>تابعنا</span></div><div class="h">${HANDLE}</div></div>`;

const files = readdirSync(new URL('social/content/', root)).filter((f) => f.endsWith('.json') && (!only || f.includes(only)));
const outRoot = new URL('social-out/', root);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
const tmp = fileURLToPath(new URL('social-out/_tmp.html', root));
mkdirSync(outRoot, { recursive: true });
for (const f of files) {
  const c = JSON.parse(readFileSync(new URL(`social/content/${f}`, root), 'utf8'));
  const raw = readFileSync(new URL(`src/content/posts/${c.post}.md`, root), 'utf8');
  const p = { dateLatin: new Date(J(raw, 'date')).toLocaleDateString('en-GB', { timeZone: 'Africa/Casablanca' }).replace(/\//g, ' · '), image: J(raw, 'image') };
  const img = pathToFileURL(fileURLToPath(new URL(p.image.replace('../../', 'src/'), root))).href;
  const dir = new URL(`${f.replace('.json', '')}/`, outRoot);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const [i, html] of [cover(c, p, img), summary(c), slide3(c), why(c), cta(c)].entries()) {
    writeFileSync(tmp, `<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8">${html}</html>`);
    await page.goto(pathToFileURL(tmp).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
    await page.screenshot({ path: fileURLToPath(new URL(`slide-${i + 1}.png`, dir)) });
  }
  await page.close();
  writeFileSync(new URL('caption.txt', dir), `${c.caption}\n\n${c.hashtags.map((t) => '#' + t).join(' ')}\n\n--- نص بديل للصورة الأولى (Alt text) ---\n${c.alt}\n`);
  console.log(`${f}: 5 slides + caption`);
}
await browser.close(); rmSync(tmp, { force: true });
