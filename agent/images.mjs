// Cover images: real photo from Pexels (free API key, optional) or a generated Moroccan-pattern cover.
import sharp from 'sharp';

const W = 1600, H = 900;
const PALETTES = {
  politics: ['#7a1117', '#c1272d'], economy: ['#00462a', '#0a8a4f'], society: ['#5a2a0f', '#c8782a'],
  sport: ['#0b3d1c', '#1fa34a'], culture: ['#3b1550', '#8a3fb0'], tech: ['#0b2a52', '#1f6fd1'],
  health: ['#0a4a4a', '#1fa3a3'], world: ['#1c2330', '#49597a'],
};

function star(cx, cy, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i + rot;
    const rad = i % 2 ? r * 0.62 : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Zellige-style 8-point-star pattern over a category gradient. */
export async function generateCover(category, file) {
  const [c1, c2] = PALETTES[category] || PALETTES.world;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <radialGradient id="glow" cx=".75" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <pattern id="p" width="200" height="200" patternUnits="userSpaceOnUse">
      <polygon points="${star(100, 100, 78)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2.5"/>
      <polygon points="${star(100, 100, 40, Math.PI / 8)}" fill="#fff" fill-opacity=".07" stroke="#fff" stroke-opacity=".25" stroke-width="2"/>
      <polygon points="${star(0, 0, 48)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>
      <polygon points="${star(200, 0, 48)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>
      <polygon points="${star(0, 200, 48)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>
      <polygon points="${star(200, 200, 48)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#p)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toFile(file);
  return null;
}

const UA = 'NabdAlMaghribBot/1.0 (news site; contact via site)';
const OK_LICENSE = /^(CC BY(-SA)? [\d.]+|CC0|Public domain|PD)/i;
const stripHtml = (h = '') => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** GET with a few retries: Wikimedia rate-limits (429) bursts of requests. */
async function getWithRetry(url, tries = 4) {
  let res;
  for (let i = 0; i < tries; i++) {
    res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(40000) });
    if (res.ok || (res.status !== 429 && res.status < 500)) return res;
    await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
  }
  return res;
}

/** Free, key-less: real photo from Wikimedia Commons under a CC license; returns credit info or null. */
export async function fetchCommons(query, file) {
  if (!query) return null;
  try {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    Object.entries({ action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 20, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: 1600, format: 'json' }).forEach(([k, v]) => u.searchParams.set(k, v));
    const res = await getWithRetry(u);
    if (!res.ok) return null;
    const pages = Object.values((await res.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
    const pick = pages.map((p) => ({ p, ii: p.imageinfo?.[0] })).find(({ ii }) => {
      const m = ii?.extmetadata || {};
      return ii && ii.mime === 'image/jpeg' && ii.width >= 1600 && ii.width / ii.height >= 1.4 && ii.width / ii.height <= 2.1 && OK_LICENSE.test(m.LicenseShortName?.value || '') && !/NonCommercial|NoDerivs/i.test(m.LicenseShortName?.value || '');
    });
    if (!pick) return null;
    const { ii } = pick;
    const img = await getWithRetry(ii.thumburl || ii.url);
    if (!img.ok) return null;
    await sharp(Buffer.from(await img.arrayBuffer())).resize(W, H, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
    const m = ii.extmetadata;
    return { name: stripHtml(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', url: ii.descriptionurl, source: `Wikimedia Commons, ${m.LicenseShortName.value}` };
  } catch (e) {
    console.warn('Commons failed:', e.message);
    return null;
  }
}

/** Try Pexels; returns credit info or null (caller falls back to generated cover). */
export async function fetchPhoto(query, file) {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query) return null;
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&size=large&per_page=10`, { headers: { Authorization: key } });
    if (!res.ok) return null;
    const { photos = [] } = await res.json();
    const pick = photos.find((p) => p.width >= 2000 && p.width / p.height > 1.4) || photos[0];
    if (!pick) return null;
    const img = await fetch(pick.src.large2x || pick.src.large);
    if (!img.ok) return null;
    await sharp(Buffer.from(await img.arrayBuffer())).resize(W, H, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
    return { name: pick.photographer, url: pick.url, source: 'Pexels' };
  } catch (e) {
    console.warn('Pexels failed:', e.message);
    return null;
  }
}
