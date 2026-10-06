import cfg from '../../site.config.json';

export const site = cfg;
const base = (cfg.base || '').replace(/\/$/, '');

/** Path under the site base, always with a leading slash and trailing slash. */
export const path = (p = '') => `${base}/${p.replace(/^\/|\/$/g, '')}${p ? '/' : ''}`.replace(/\/\/$/, '/');
/** Absolute URL for a site path. */
export const abs = (p = '') => new URL(path(p), cfg.url).href;

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

export const readingTime = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 220));
