import { abs } from '../lib/site';
export const GET = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap-index.xml')}\n`, { headers: { 'Content-Type': 'text/plain' } });
