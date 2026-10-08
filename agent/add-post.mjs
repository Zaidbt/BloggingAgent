#!/usr/bin/env node
// Publish an article written outside the LLM pipeline (e.g. by a Claude session): node agent/add-post.mjs post.json
// post.json: {title, description, slug (Arabic, hyphenated), imageName (english, for the file), category, tags[], imageAlt, imageQuery?, body, faq[{q,a}], sources[{title,url}]}
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { validate } from './quality.mjs';
import { generateCover, findPhoto } from './images.mjs';
import { makeThumb } from './thumb.mjs';
import { toMarkdown } from './post.mjs';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('site.config.json', root), 'utf8'));
const postsDir = new URL('src/content/posts/', root);
const assetsDir = new URL('src/assets/posts/', root);
const categories = cfg.categories.map((c) => c.slug);

const file = process.argv[2];
if (!file) { console.error('usage: node agent/add-post.mjs post.json'); process.exit(1); }
const post = JSON.parse(readFileSync(file, 'utf8'));

mkdirSync(postsDir, { recursive: true });
const existing = readdirSync(postsDir).filter((f) => f.endsWith('.md')).map((f) => {
  const t = readFileSync(new URL(f, postsDir), 'utf8').match(/^title:\s*(.+)$/m)?.[1];
  return { slug: f.replace(/\.md$/, ''), title: t ? JSON.parse(t) : f };
});

const problems = validate(post, existing, { categories });
if (problems.length) { console.error('Quality checks failed:\n - ' + problems.join('\n - ')); process.exit(1); }

let slug = post.slug;
if (existing.some((e) => e.slug === slug)) slug += `-${new Date().toISOString().slice(0, 10)}`;
post.date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
mkdirSync(assetsDir, { recursive: true });
const imgName = post.imageName || `post-${slug.length}-${Date.now().toString(36)}`; // ASCII file name keeps image URLs clean
const img = new URL(`${imgName}.jpg`, assetsDir).pathname;
const found = await findPhoto(post.imageQueries || [post.imageQuery], img);
if (found) { const { _i, ...credit } = found; post.imageCredit = credit; if (post.imageAlts?.[_i]) post.imageAlt = post.imageAlts[_i]; }
if (!post.imageCredit) {
  // guaranteed last step: a designed editorial thumbnail (topic icon + headline figure)
  const th = post.thumb || {};
  try { await makeThumb({ category: post.category, icon: th.icon, stat: th.stat, statLabel: th.statLabel }, img); post.imageAlt = th.stat ? `غلاف تحريري: ${th.stat} ${th.statLabel || ''}`.trim() : `غلاف تحريري لقسم ${cfg.categories.find((c) => c.slug === post.category)?.label ?? ''}`; }
  catch (e) { console.warn('Chromium thumbnail unavailable, using pattern cover:', e.message); await generateCover(post.category, img); }
}
post.imagePath = `../../assets/posts/${imgName}.jpg`;
post.tags = (post.tags || []).slice(0, 5);
writeFileSync(new URL(`${slug}.md`, postsDir), toMarkdown(post, { base: cfg.base }));
console.log(`Saved src/content/posts/${slug}.md (${post.imageCredit ? 'photo' : 'generated cover'})`);
