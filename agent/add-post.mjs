#!/usr/bin/env node
// Publish an article written outside the LLM pipeline (e.g. by a Claude session): node agent/add-post.mjs post.json
// post.json: {title, description, slug, category, tags[], imageAlt, imageQuery?, body, faq[{q,a}], sources[{title,url}]}
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { validate } from './quality.mjs';
import { generateCover, fetchPhoto } from './images.mjs';
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
const img = new URL(`${slug}.jpg`, assetsDir).pathname;
post.imageCredit = (await fetchPhoto(post.imageQuery, img)) || undefined;
if (!post.imageCredit) await generateCover(post.category, img);
post.imagePath = `../../assets/posts/${slug}.jpg`;
post.tags = (post.tags || []).slice(0, 5);
writeFileSync(new URL(`${slug}.md`, postsDir), toMarkdown(post, { base: cfg.base }));
console.log(`Saved src/content/posts/${slug}.md (${post.imageCredit ? 'photo' : 'generated cover'})`);
