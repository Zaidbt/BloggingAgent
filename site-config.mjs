// Single source of truth for the site settings: site.config.json, with deploy-time overrides.
//   SITE_URL  e.g. https://alkhabar212.com   (or https://<project>.pages.dev while testing)
//   SITE_BASE "/" or "" for a domain root, "/BloggingAgent" for a GitHub Pages project site
import json from './site.config.json' with { type: 'json' };

const cfg = { ...json };
if (process.env.SITE_URL) cfg.url = process.env.SITE_URL.replace(/\/$/, '');
if (process.env.SITE_BASE !== undefined) cfg.base = process.env.SITE_BASE === '/' ? '' : process.env.SITE_BASE;
export default cfg;
