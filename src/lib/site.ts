import cfg from '../../site.config.json';

export const site = cfg;
const base = (cfg.base || '').replace(/\/$/, '');

/** Site-relative path; folders get a trailing slash, files (with extension) don't. */
export const path = (p = '') => {
  const clean = p.replace(/^\/+|\/+$/g, '');
  if (!clean) return `${base}/`;
  const isFile = /\.[a-z0-9]+$/i.test(clean.split('/').pop()!);
  return `${base}/${clean}${isFile ? '' : '/'}`;
};
export const abs = (p = '') => new URL(path(p), cfg.url).href;

export const catLabel = (slug: string) => cfg.categories.find((c) => c.slug === slug)?.label ?? slug;

const dateFmt = new Intl.DateTimeFormat('ar-MA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' });
export const fmtDate = (d: Date) => dateFmt.format(d);
export const readingTime = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 200));
