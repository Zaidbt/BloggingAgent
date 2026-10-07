import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site, path, postPath } from '../lib/site';

export async function GET(context) {
  const posts = (await getCollection('posts')).sort((a, b) => +b.data.date - +a.data.date).slice(0, 50);
  return rss({
    title: site.name,
    description: site.tagline,
    site: context.site,
    customData: '<language>ar-ma</language>',
    items: posts.map((p) => ({ title: p.data.title, description: p.data.description, pubDate: p.data.date, link: path(postPath(p.id)), categories: [p.data.category, ...p.data.tags] })),
  });
}
