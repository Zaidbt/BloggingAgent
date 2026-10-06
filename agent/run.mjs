#!/usr/bin/env node
// Daily news agent: find what's trending in Morocco -> research (web-grounded) -> write in Arabic -> image -> validate -> save.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { generate, parseJson } from './llm.mjs';
import { validate, slugify } from './quality.mjs';
import { generateCover, fetchPhoto } from './images.mjs';
import { toMarkdown } from './post.mjs';

const root = new URL('../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('site.config.json', root), 'utf8'));
const postsDir = new URL('src/content/posts/', root);
const assetsDir = new URL('src/assets/posts/', root);
const dry = process.argv.includes('--dry-run');
const now = new Date();
const today = now.toISOString().slice(0, 10);
const categories = cfg.categories.map((c) => c.slug);

function existingPosts() {
  mkdirSync(postsDir, { recursive: true });
  return readdirSync(postsDir).filter((f) => f.endsWith('.md')).map((f) => {
    const raw = readFileSync(new URL(f, postsDir), 'utf8');
    const title = raw.match(/^title:\s*(.+)$/m)?.[1];
    const date = raw.match(/^date:\s*(\S+)/m)?.[1] ?? '';
    return { slug: f.replace(/\.md$/, ''), title: title ? JSON.parse(title) : f, date };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

const SYSTEM = `You are the editor-in-chief of "${cfg.name}", an Arabic-language news site covering what is trending in Morocco.
You write in clear Modern Standard Arabic for Moroccan readers (you may use Moroccan place names and common local terms where natural).
Principles: accuracy over speed; every factual claim comes from the supplied research notes and is attributed ("حسب ما نقلته ...", "وفق بلاغ ..."); never invent quotes, figures, names, dates or events; keep opinion out of the news text;
respect presumption of innocence and privacy (no accusations against private individuals, no graphic details, no identifying minors or victims);
political stories stay neutral and balanced; separate confirmed facts from claims and from what is still unknown.
Never copy sentences from sources: explain the story in original wording and add useful context. Do not claim to be an eyewitness.`;

async function pickStory(posts) {
  const recent = posts.slice(0, 40).map((p) => `- ${p.title}`).join('\n') || '(none yet)';
  const { text } = await generate({
    system: SYSTEM, search: true, maxTokens: 4096,
    prompt: `Today is ${today}. Use Google Search to find the news stories that are trending in Morocco right now (last 24-48 hours): look at major Moroccan outlets (Hespress, Le360, MAP, Médias24, Hibapress, Alyaoum24...) and international coverage of Morocco (Reuters, AFP, Al Jazeera...).\n` +
      `Pick 5 distinct candidate stories that many outlets are covering and that readers are likely searching for. Prefer stories that are well documented by at least 2 independent outlets; avoid rumours, tragedies where coverage would be exploitative, and anything we already covered:\n${recent}\n\n` +
      `Return ONLY JSON: {"stories":[{"headline":"Arabic working headline","summary":"2 sentences in English on what happened","category":"one of ${categories.join('|')}","why_trending":"short","search_query":"best English/French/Arabic query to research it"}]} ordered best first.`,
  });
  return parseJson(text).stories || [];
}

async function research(story) {
  return generate({
    system: SYSTEM, search: true, maxTokens: 6000,
    prompt: `Research this Moroccan news story thoroughly using Google Search and report only what reputable sources confirm.\nStory: ${story.headline}\nContext: ${story.summary}\nSearch hint: ${story.search_query}\n\n` +
      `Return detailed notes in Arabic as bullets: what happened, when, where, who (officials/institutions only unless public figures), figures with the source name next to each, background/context readers need, reactions, what is still unconfirmed or disputed, and what happens next. ` +
      `Note which outlet reported each point. Use at least 3 different outlets if available. Do not speculate.`,
  });
}

async function writePost(story, notes, posts, feedback = '') {
  const links = posts.slice(0, 30).map((p) => `- ${p.slug}: ${p.title}`).join('\n') || '(none yet)';
  const { text } = await generate({
    system: SYSTEM, json: true, maxTokens: 12000,
    prompt: `Write the news article in Arabic.\nStory: ${story.headline}\nSuggested category: ${story.category}\n\nRESEARCH NOTES (the ONLY source of facts):\n${notes}\n\n` +
      `Existing articles you may link to (0-2 links, only if clearly relevant, as markdown links to /blog/<slug>/):\n${links}\n\n` +
      `Requirements:\n- 550-950 words of markdown body in Arabic. NO H1. 3-5 H2 sections (e.g. "ما الذي حدث؟", "الخلفية", "لماذا يهم القراء؟", "ماذا بعد؟" - adapt to the story).\n` +
      `- Inverted pyramid: the first paragraph answers who/what/when/where in 2-3 sentences. Then a short bullet list "أبرز النقاط" (3-4 bullets).\n` +
      `- Attribute every claim to its source by name. Say clearly what is unconfirmed. End with a one-line note of the date of the latest information.\n` +
      `- Title: specific, informative, max 75 chars, no clickbait, no all-caps tricks. Description: 110-170 chars, accurate summary.\n` +
      `- slug: 3-7 lowercase English words joined by hyphens describing the story. tags: up to 5 short Arabic tags.\n` +
      `- imageQuery: 2-4 English words for a generic stock photo that illustrates the theme (e.g. "Casablanca skyline", "football stadium crowd", "farmer olive field"); never people's names. imageAlt: Arabic one-sentence description of that illustrative image.\n` +
      `- 2-4 FAQ items with 1-3 sentence answers drawn only from the notes.\n${feedback ? `\nFix these problems from the previous attempt:\n${feedback}\n` : ''}\n` +
      `Return JSON: {"title":"","description":"","slug":"","category":"","tags":[""],"imageQuery":"","imageAlt":"","body":"markdown","faq":[{"q":"","a":""}]}`,
  });
  return parseJson(text);
}

async function main() {
  const posts = existingPosts();
  const stories = await pickStory(posts);
  if (!stories.length) throw new Error('No trending stories found');
  console.log('Candidates:\n' + stories.map((s) => ` - ${s.headline}`).join('\n'));

  for (const story of stories.slice(0, 3)) {
    console.log(`\nStory: ${story.headline}`);
    let notes;
    try { notes = await research(story); } catch (e) { console.warn('Research failed:', e.message); continue; }
    const sources = [...new Map(notes.sources.map((s) => [s.url, s])).values()].slice(0, 8);

    let post, problems = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      post = await writePost(story, notes.text, posts, problems.join('\n'));
      post.category ||= story.category;
      post.tags = (post.tags || []).slice(0, 5);
      post.faq ||= [];
      post.sources = sources;
      problems = validate(post, posts, { categories });
      if (!problems.length) break;
      console.warn(`Attempt ${attempt} failed checks:\n - ${problems.join('\n - ')}`);
    }
    if (problems.length) { console.warn('Giving up on this story, trying the next.'); continue; }

    let slug = post.slug;
    if (posts.some((p) => p.slug === slug)) slug = `${slug}-${today}`;
    post.date = now.toISOString().replace(/\.\d+Z$/, 'Z');
    if (dry) { console.log(toMarkdown({ ...post, imagePath: '../../assets/posts/x.jpg' }, { base: cfg.base })); return; }

    mkdirSync(assetsDir, { recursive: true });
    const imgFile = new URL(`${slug}.jpg`, assetsDir);
    post.imageCredit = await fetchPhoto(post.imageQuery, imgFile.pathname);
    if (!post.imageCredit) await generateCover(post.category, imgFile.pathname);
    post.imagePath = `../../assets/posts/${slug}.jpg`;
    post.imageCredit ||= undefined;

    writeFileSync(new URL(`${slug}.md`, postsDir), toMarkdown(post, { base: cfg.base }));
    console.log(`Saved src/content/posts/${slug}.md (${post.imageCredit ? 'photo' : 'generated cover'})`);
    return;
  }
  throw new Error('No story passed the quality checks; nothing published today.');
}

main().catch((e) => { console.error(e); process.exit(1); });
