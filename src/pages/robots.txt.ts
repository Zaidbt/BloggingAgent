import { abs } from '../lib/site';
// Search and AI crawlers are explicitly welcome. (robots.txt is only read at a domain root, i.e. on a custom domain.)
export const GET = () =>
  new Response(
`User-agent: *
Allow: /

User-agent: Googlebot-News
Allow: /

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: ${abs('sitemap-index.xml')}
Sitemap: ${abs('news-sitemap.xml')}
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
