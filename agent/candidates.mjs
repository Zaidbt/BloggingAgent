// Browse real-photo candidates for a topic, then pick one by eye.
//   node agent/candidates.mjs search "Rabat parliament" "Morocco parliament"  -> .cache/cand.png + .cache/cand.json
//   node agent/candidates.mjs pick 3 src/assets/posts/name.jpg                -> saves candidate 3, prints credit JSON
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const UA = 'AlBarrah/1.0 (https://github.com/Zaidbt/BloggingAgent; bot) node-fetch';
// Wikimedia throttles direct upload.wikimedia.org hits; Special:FilePath with a width is served from a friendlier bucket.
const wm = (u, w) => { const m = /upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/.exec(u); return m ? `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=${w}` : u; };
async function dl(u, w, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(wm(u, w), { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    if (r.status !== 429) break;
    await new Promise((ok) => setTimeout(ok, 6000 * (i + 1)));
  }
  throw new Error('download failed');
}
const LIC = { by: 'CC BY', 'by-sa': 'CC BY-SA', cc0: 'CC0', pdm: 'Domaine public' };
const BAD = /(press conference|speaks?|speech|meeting|meets|summit|secretary|minister|president|prime|portrait|interview|ceremony|rally|protest|mural|painting|azulejo|statue|poster|logo|flag of|coat of arms|diagram|conquest|battle|soldier|candidate|election|\bcat\b|\bdog\b)/i;
mkdirSync('.cache', { recursive: true });
const [cmd, ...args] = process.argv.slice(2);

async function ov(q) {
  const u = new URL('https://api.openverse.org/v1/images/');
  Object.entries({ q, license: 'cc0,pdm,by,by-sa', extension: 'jpg', size: 'large', page_size: 15, ...(process.env.SRC ? { source: process.env.SRC } : {}) }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) return [];
  return (await r.json()).results.filter((x) => !BAD.test(x.title || '') && x.width >= 1400 && x.width / x.height >= 1.25)
    .map((x) => ({ title: x.title, url: x.url, thumb: x.thumbnail, land: x.foreign_landing_url || x.url, by: x.creator || x.source, lic: `${LIC[x.license] || x.license}${x.license_version && x.license !== 'cc0' && x.license !== 'pdm' ? ' ' + x.license_version : ''}`, src: x.source }));
}

async function pexels(q) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.pexels.com/v1/search?per_page=15&orientation=landscape&query=${encodeURIComponent(q)}`, { headers: { Authorization: key }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) return [];
  return (await r.json()).photos.map((x) => ({ title: x.alt || `Pexels ${x.id}`, url: x.src.large2x, thumb: x.src.medium, land: x.url, by: x.photographer, lic: 'Pexels License', src: 'pexels', pexels: true }));
}

async function pixabay(q) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const r = await fetch(`https://pixabay.com/api/?key=${key}&image_type=photo&orientation=horizontal&min_width=1200&safesearch=true&per_page=15&q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) return [];
  return (await r.json()).hits.map((x) => ({ title: x.tags, url: x.largeImageURL, thumb: x.webformatURL, land: x.pageURL, by: x.user, lic: 'Pixabay License', src: 'pixabay', stock: 'Pixabay' }));
}
async function unsplash(q) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.unsplash.com/search/photos?per_page=15&orientation=landscape&query=${encodeURIComponent(q)}`, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) return [];
  return (await r.json()).results.map((x) => ({ title: x.alt_description || x.description || `Unsplash ${x.id}`, url: `${x.urls.raw}&w=1800&q=80&fm=jpg`, thumb: x.urls.small, land: x.links.html, by: x.user.name, lic: 'Unsplash License', src: 'unsplash', stock: 'Unsplash' }));
}

if (cmd === 'search') {
  const seen = new Set(); let all = [];
  for (const q of args) for (const c of [...await pexels(q), ...await unsplash(q), ...await pixabay(q), ...await ov(q)]) if (!seen.has(c.url)) { seen.add(c.url); all.push(c); }
  // Pexels first, then Flickr/others; Wikimedia last (it throttles this machine)
  all.sort((a, b) => ((b.pexels || b.stock) ? 2 : b.src !== 'wikimedia' ? 1 : 0) - ((a.pexels || a.stock) ? 2 : a.src !== 'wikimedia' ? 1 : 0));
  all = all.slice(0, 20);
  const tiles = [];
  for (const [i, c] of all.entries()) {
    try {
      const b = await dl(c.url, 500);
      const img = await sharp(b).resize(400, 250, { fit: 'cover' }).toBuffer();
      const lab = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="22"><rect width="400" height="22" fill="#000"/><text x="6" y="16" font-size="14" fill="#fff" font-family="sans-serif">${i} ${c.title.replace(/[<&]/g, '').slice(0, 48)}</text></svg>`);
      tiles.push({ i, buf: await sharp(img).composite([{ input: lab, top: 228, left: 0 }]).toBuffer() });
    } catch { all[i] = null; }
  }
  const ok = tiles; const cols = 4, rows = Math.ceil(ok.length / cols) || 1;
  await sharp({ create: { width: cols * 404, height: rows * 254, channels: 3, background: '#222' } })
    .composite(ok.map((t, k) => ({ input: t.buf, left: (k % cols) * 404, top: Math.floor(k / cols) * 254 }))).png().toFile('.cache/cand.png');
  writeFileSync('.cache/cand.json', JSON.stringify(all));
  console.log(`${ok.length} candidates -> .cache/cand.png`);
} else if (cmd === 'pick') {
  const c = JSON.parse(readFileSync('.cache/cand.json', 'utf8'))[+args[0]];
  const b = await dl(c.url, 1800);
  await sharp(b).resize(1600, 900, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toFile(args[1]);
  console.log(JSON.stringify({ name: String(c.by).slice(0, 80), url: c.land, source: c.pexels ? 'Pexels' : c.stock ? c.stock : `Openverse، ${c.lic}` }));
}
