import { site, path } from '../lib/site';
export const GET = () =>
  new Response(JSON.stringify({
    name: site.name, short_name: site.name, description: site.tagline, lang: 'ar', dir: 'rtl',
    start_url: path(), scope: path(), display: 'standalone', background_color: '#faf7f2', theme_color: '#c1272d',
    icons: [
      { src: path('icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: path('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
