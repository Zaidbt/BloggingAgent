import { getCollection } from 'astro:content';
import { site, abs, postPath } from '../lib/site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Google News sitemap: only articles from the last 2 days, as the format requires. */
export async function GET() {
  const since = Date.now() - 2 * 24 * 3600e3;
  const posts = (await getCollection('posts')).filter((p) => +p.data.date >= since).sort((a, b) => +b.data.date - +a.data.date).slice(0, 1000);
  const items = posts.map((p) => `  <url>
    <loc>${esc(abs(postPath(p.id)))}</loc>
    <news:news>
      <news:publication><news:name>${esc(site.name)}</news:name><news:language>ar</news:language></news:publication>
      <news:publication_date>${p.data.date.toISOString()}</news:publication_date>
      <news:title>${esc(p.data.title)}</news:title>
    </news:news>
  </url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>
`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
