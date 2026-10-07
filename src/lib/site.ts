import cfg from '../../site.config.json';

export const site = cfg;
export const R = cfg.routes;
const base = (cfg.base || '').replace(/\/$/, '');

/** Site-relative path; folders get a trailing slash, files (with extension) don't. Arabic segments stay readable. */
export const path = (p = '') => {
  const clean = p.replace(/^\/+|\/+$/g, '');
  if (!clean) return `${base}/`;
  const isFile = /\.[a-z0-9]+$/i.test(clean.split('/').pop()!);
  return `${base}/${clean}${isFile ? '' : '/'}`;
};
/** Absolute (percent-encoded) URL, as used in canonical, sitemap and structured data. */
export const abs = (p = '') => new URL(path(p), cfg.url).href;

export const postPath = (id: string) => `${R.news}/${id}`;
export const catPath = (slug: string) => `${R.category}/${cfg.categories.find((c) => c.slug === slug)?.slugAr ?? slug}`;
export const tagSlug = (t: string) => t.trim().replace(/\s+/g, '-');
export const tagPath = (t: string) => `${R.tag}/${tagSlug(t)}`;

export const catLabel = (slug: string) => cfg.categories.find((c) => c.slug === slug)?.label ?? slug;

const dateFmt = new Intl.DateTimeFormat('ar-MA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' });
export const fmtDate = (d: Date) => dateFmt.format(d);
export const readingTime = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 200));
