#!/usr/bin/env node
// Daily blog agent: pick topic -> research (web-grounded) -> write -> validate -> save markdown.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { generate, parseJson } from './llm.mjs';
import { validate, slugify } from './quality.mjs';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('site.config.json', root), 'utf8'));
const topicsFile = new URL('agent/topics.json', root);
const postsDir = new URL('src/content/posts/', root);
const dry = process.argv.includes('--dry-run');
const today = new Date().toISOString().slice(0, 10);

const topics = existsSync(topicsFile) ? JSON.parse(readFileSync(topicsFile, 'utf8')) : { queue: [], done: [] };

function existingPosts() {
  return readdirSync(postsDir).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = readFileSync(new URL(f, postsDir), 'utf8');
    const title = raw.match(/^title:\s*(.+)$/m)?.[1].replace(/^"|"$/g, '') ?? f;
    return { slug: f.replace(/\.md$/, ''), title };
  });
}

const SYSTEM = `You are a senior editor and subject-matter writer for "${cfg.name}", a blog about ${cfg.niche} for ${cfg.audience}.
Tone: ${cfg.tone}. You follow Google's people-first content guidelines and E-E-A-T: original insight, concrete examples and numbers,
honest limits and caveats, no fluff, no keyword stuffing, no fabricated statistics, quotes, studies or personal anecdotes.
Never claim first-hand experience you do not have.`;

async function refillTopics(posts) {
  const { text } = await generate({
    system: SYSTEM, json: true,
    prompt: `Existing articles:\n${posts.map((p) => `- ${p.title}`).join('\n')}\nAlready queued:\n${topics.queue.map((t) => `- ${t.topic}`).join('\n') || '(none)'}\n\n` +
      `Propose 15 NEW article topics in this niche that real people search for. Prefer specific long-tail queries with clear search intent, ` +
      `build topical clusters around existing articles, avoid overlap/cannibalization with existing titles, and avoid time-sensitive claims.\n` +
      `Return JSON: {"topics":[{"topic":"...","keyword":"primary search phrase","intent":"informational|comparison|how-to"}]}`,
  });
  const fresh = parseJson(text).topics || [];
  const seen = new Set([...topics.queue, ...topics.done].map((t) => t.keyword.toLowerCase()));
  for (const t of fresh) if (t.keyword && !seen.has(t.keyword.toLowerCase())) topics.queue.push(t);
}

async function writePost(topic, posts, feedback = '') {
  const research = await generate({
    system: SYSTEM, search: true, maxTokens: 4096,
    prompt: `Research "${topic.topic}" (primary keyword: ${topic.keyword}). Use current, authoritative sources (official bodies, primary data, reputable publications). ` +
      `Return concise bullet notes of verified facts with the source name for each, plus what searchers most want answered and what competing articles usually miss.`,
  });
  const { text } = await generate({
    system: SYSTEM, json: true, maxTokens: 12000,
    prompt: `Write a complete article.\nTopic: ${topic.topic}\nPrimary keyword: ${topic.keyword}\nIntent: ${topic.intent || 'informational'}\n\n` +
      `RESEARCH NOTES (only state facts supported here or that are timeless common knowledge):\n${research.text}\n\n` +
      `EXISTING ARTICLES you may link to internally (use 2-4 where genuinely relevant, as markdown links to /blog/<slug>/):\n${posts.map((p) => `- ${p.slug}: ${p.title}`).join('\n') || '(none yet)'}\n\n` +
      `Requirements:\n- 1200-1800 words of markdown body, NO H1 (the title is rendered separately), 4-7 H2 sections, H3 where useful.\n` +
      `- Open with a direct answer/summary in the first 2 sentences, then go deeper. Include at least one list or table and a concrete worked example.\n` +
      `- Title <= 60 chars containing the keyword naturally; meta description 130-160 chars, compelling and accurate.\n` +
      `- Add a short "Key takeaways" list near the top and a brief honest note on limitations/who this does not apply to.\n` +
      `- 3-5 FAQ items answering real follow-up questions (answers 1-3 sentences).\n` +
      `- Do not include a Sources section in the body.\n${feedback ? `\nFix these problems from the previous attempt:\n${feedback}\n` : ''}\n` +
      `Return JSON: {"title":"","description":"","category":"","tags":["max 5 lowercase"],"body":"markdown","faq":[{"q":"","a":""}]}`,
  });
  const post = parseJson(text);
  post.sources = [...new Map(research.sources.map((s) => [s.url, s])).values()].slice(0, 6);
  return post;
}

const base = (cfg.base || '').replace(/\/$/, '');
const withBase = (md) => md.replace(/\]\(\/blog\//g, `](${base}/blog/`);

const q = (s) => JSON.stringify(s); // JSON strings are valid YAML scalars
function toMarkdown(p) {
  return `---\ntitle: ${q(p.title)}\ndescription: ${q(p.description)}\ndate: ${today}\ncategory: ${q(p.category)}\ntags: ${q(p.tags)}\n` +
    `faq:\n${p.faq.map((f) => `  - q: ${q(f.q)}\n    a: ${q(f.a)}`).join('\n')}\n` +
    `sources:\n${p.sources.length ? p.sources.map((s) => `  - title: ${q(s.title)}\n    url: ${q(s.url)}`).join('\n') : '  []'}\n---\n\n${withBase(p.body.trim())}\n`;
}

async function main() {
  const posts = existingPosts();
  if (topics.queue.length < 3) await refillTopics(posts);
  const topic = topics.queue[0];
  if (!topic) throw new Error('No topics available');
  console.log(`Topic: ${topic.topic} [${topic.keyword}]`);

  let post, problems = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    post = await writePost(topic, posts, problems.join('\n'));
    post.tags = (post.tags || []).slice(0, 5).map((t) => String(t).toLowerCase());
    post.faq ||= [];
    problems = validate(post, posts, topic);
    if (!problems.length) break;
    console.warn(`Attempt ${attempt} failed checks:\n - ${problems.join('\n - ')}`);
  }
  if (problems.length) throw new Error('Quality checks failed after 3 attempts; nothing published.');

  let slug = slugify(post.title);
  if (posts.some((p) => p.slug === slug)) slug += `-${today}`;
  if (dry) { console.log(toMarkdown(post)); return; }
  writeFileSync(new URL(`${slug}.md`, postsDir), toMarkdown(post));
  topics.queue.shift();
  topics.done.push({ ...topic, slug, date: today });
  writeFileSync(topicsFile, JSON.stringify(topics, null, 2) + '\n');
  console.log(`Published draft: src/content/posts/${slug}.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
