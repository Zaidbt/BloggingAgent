#!/usr/bin/env node
// Daily-routine helper: fetch the Moroccan outlets' feeds, group items into stories (same story in >= 2 outlets),
// flag stories we already published, and print a compact candidate list. Then read chosen stories in full.
//   node agent/prepare.mjs            -> candidate list (also caches the full items in .cache/)
//   node agent/prepare.mjs --show 3,7 -> full text + URLs of candidate stories #3 and #7
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { gatherNews } from './feeds.mjs';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('site.config.json', root), 'utf8'));
const cache = new URL('.cache/', root);
mkdirSync(cache, { recursive: true });
const showIdx = process.argv.indexOf('--show');

const STOP = new Set('اليوم الاحد السبت الاثنين الثلاثاء الاربعاء الخميس الجمعه اكتوبر شتنبر غشت يوليوز بعد قبل حول التي الذي هذه هذا خلال امام وفق بين عده اكثر المغرب المغربيه المغربي مغربي تفاصيل هذا الجاري المقبل الماضي'.split(' '));
const norm = (s) => s.replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const tokens = (s) => new Set(norm(s).split(/[^\p{L}\p{N}]+/u).map((w) => w.replace(/^(وال|بال|لل|ال|و)(?=.{3})/, '')).filter((w) => w.length >= 3 && !STOP.has(w)));
const inter = (a, b) => [...a].filter((x) => b.has(x)).length;

if (showIdx > -1) {
  const clusters = JSON.parse(readFileSync(new URL('clusters.json', cache), 'utf8'));
  const items = new Map(JSON.parse(readFileSync(new URL('items.json', cache), 'utf8')).map((i) => [i.id, i]));
  for (const n of process.argv[showIdx + 1].split(',').map(Number)) {
    const c = clusters[n - 1];
    console.log(`\n==================== STORY #${n} (${c.outlets} outlets) ====================`);
    for (const id of c.ids) { const i = items.get(id); console.log(`\n### [${id}] ${i.outlet} | ${i.date} | ${i.link}\n${i.title}\n${i.text.replace(/The post .* appeared first on .*$/s, '').replace(/التدوينة .* ظهرت أولاً على .*$/s, '').slice(0, 1900)}`); }
  }
  process.exit(0);
}

const items = await gatherNews(cfg.feeds || [], { hours: 40, perFeed: 14 });
console.log(`Fetched ${items.length} items from ${new Set(items.map((i) => i.outlet)).size} outlets`);
if (items.length < 20) { console.error('Too few items: feeds blocked? (use NODE_USE_ENV_PROXY=1)'); process.exit(1); }
writeFileSync(new URL('items.json', cache), JSON.stringify(items));

const tok = items.map((i) => tokens(i.title + ' ' + i.text.slice(0, 160)));
const tt = items.map((i) => tokens(i.title));
const parent = items.map((_, i) => i);
const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
  if (items[a].outlet === items[b].outlet) continue;
  const k = inter(tok[a], tok[b]);
  if (k >= 3 && (k / Math.min(tok[a].size, tok[b].size) >= 0.34 || inter(tt[a], tt[b]) >= 3)) parent[find(a)] = find(b);
}
const groups = new Map();
items.forEach((it, i) => groups.set(find(i), [...(groups.get(find(i)) || []), i]));

const posts = readdirSync(new URL('src/content/posts/', root)).filter((f) => f.endsWith('.md')).map((f) => {
  const raw = readFileSync(new URL(`src/content/posts/${f}`, root), 'utf8');
  const t = raw.match(/^title:\s*(.+)$/m)?.[1]; const tags = raw.match(/^tags:\s*(.+)$/m)?.[1];
  return { f, toks: tokens(`${t ? JSON.parse(t) : ''} ${tags ? JSON.parse(tags).join(' ') : ''}`) };
});

const clusters = [...groups.values()].map((idx) => ({ idx, outlets: new Set(idx.map((i) => items[i].outlet)).size }))
  .filter((c) => c.outlets >= 2)
  .map((c) => {
    const ct = new Set(c.idx.flatMap((i) => [...tt[i]]));
    const covered = posts.find((p) => inter(ct, p.toks) >= 3)?.f;
    const body = c.idx.reduce((s, i) => s + items[i].text.length, 0);
    return { ids: c.idx.map((i) => items[i].id), outlets: c.outlets, covered, body, heads: c.idx.slice(0, 3).map((i) => items[i].title.slice(0, 70)) };
  })
  .sort((a, b) => b.outlets - a.outlets || b.body - a.body).slice(0, 18);
writeFileSync(new URL('clusters.json', cache), JSON.stringify(clusters));

console.log(`\nCandidate stories (>= 2 outlets), best first. "COVERED" = we already published something similar.\n`);
clusters.forEach((c, n) => console.log(`#${n + 1} [${c.outlets} outlets, ${Math.round(c.body / 100) / 10}k chars]${c.covered ? ' COVERED:' + c.covered.slice(0, 30) : ''}\n   ${c.heads.join('\n   ')}`));
console.log(`\nNext: node agent/prepare.mjs --show <numbers>   (read 3 stories in full)`);
