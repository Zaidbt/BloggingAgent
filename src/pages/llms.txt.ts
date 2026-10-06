import { getCollection } from 'astro:content';
import { site, abs } from '../lib/site';
export async function GET() {
  const posts = (await getCollection('posts')).sort((a, b) => +b.data.date - +a.data.date);
  const lines = [`# ${site.name}`, '', `> ${site.tagline}`, '', '## Articles', ...posts.map((p) => `- [${p.data.title}](${abs(`blog/${p.id}`)}): ${p.data.description}`)];
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
