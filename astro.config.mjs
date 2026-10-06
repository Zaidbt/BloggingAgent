import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./site.config.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: cfg.url,
  base: cfg.base || '/',
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
  markdown: { shikiConfig: { theme: 'github-light' } },
});
