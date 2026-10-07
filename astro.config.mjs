import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, readdirSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));

// url -> last modification date, read from the posts' front matter, so the sitemap carries <lastmod>
const dir = new URL('./src/content/posts/', import.meta.url);
const lastmod = new Map();
const tagCount = new Map();
let newest = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const raw = readFileSync(new URL(f, dir), 'utf8');
  const date = raw.match(/^updated:\s*(\S+)/m)?.[1] ?? raw.match(/^date:\s*(\S+)/m)?.[1];
  if (date) { lastmod.set(f.replace(/\.md$/, ''), new Date(date).toISOString()); newest = Math.max(newest, +new Date(date)); }
  try { for (const t of JSON.parse(raw.match(/^tags:\s*(\[.*\])/m)?.[1] ?? '[]')) tagCount.set(t.trim().replace(/\s+/g, '-'), (tagCount.get(t.trim().replace(/\s+/g, '-')) ?? 0) + 1); } catch {}
}
const newestIso = new Date(newest || Date.now()).toISOString();

export default defineConfig({
  site: cfg.url,
  base: cfg.base || '/',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // thin tag pages (< 3 articles) are noindex, so they stay out of the sitemap
      filter: (page) => {
        const u = decodeURIComponent(page);
        if (u.includes('/404')) return false;
        if (u.includes(`/${cfg.routes.tag}/`)) return (tagCount.get(u.replace(/\/$/, '').split('/').pop()) ?? 0) >= 3;
        return true;
      },
      serialize(item) {
        const slug = decodeURIComponent(item.url).replace(/\/$/, '').split('/').pop();
        const isPost = decodeURIComponent(item.url).includes(`/${cfg.routes.news}/`) && lastmod.has(slug);
        if (isPost) return { ...item, lastmod: lastmod.get(slug), changefreq: 'monthly', priority: 0.8 };
        const isHome = item.url.replace(/\/$/, '') === (cfg.url + (cfg.base || '')).replace(/\/$/, '');
        return { ...item, lastmod: newestIso, changefreq: 'daily', priority: isHome ? 1.0 : 0.5 };
      },
    }),
  ],
  build: { inlineStylesheets: 'always' },
  markdown: { shikiConfig: { theme: 'github-light' } },
});
