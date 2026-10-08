#!/usr/bin/env node
// Daily news agent: read Moroccan outlets' RSS -> find stories 2+ outlets cover -> write original Arabic article -> image -> validate -> save.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { generate, parseJson } from './llm.mjs';
import { validate, slugify } from './quality.mjs';
import { generateCover, findPhoto } from './images.mjs';
import { makeThumb } from './thumb.mjs';
import { toMarkdown } from './post.mjs';
import { gatherNews } from './feeds.mjs';

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
Principles: accuracy over speed; every factual claim comes from the supplied source articles and is attributed ("حسب ما نقلته ...", "وفق بلاغ ..."); never invent quotes, figures, names, dates or events; keep opinion out of the news text;
respect presumption of innocence and privacy (no accusations against private individuals, no graphic details, no identifying minors or victims);
political stories stay neutral and balanced; separate confirmed facts from claims and from what is still unknown.
Never copy sentences from sources: explain the story in original wording and add useful context. Do not claim to be an eyewitness.`;

/** Cluster the fetched headlines into stories that several outlets are covering ("trending"). */
async function pickStories(items, posts) {
  const recent = posts.slice(0, 40).map((p) => `- ${p.title}`).join('\n') || '(none yet)';
  const list = items.map((i) => `${i.id} | ${i.outlet} | ${i.title} | ${i.text.slice(0, 140)}`).join('\n');
  const { text } = await generate({
    system: SYSTEM, json: true, maxTokens: 4096,
    prompt: `Today is ${today}. Below are the latest items from Moroccan news outlets (id | outlet | headline | snippet).\n${list}\n\n` +
      `Group items that report the SAME story. A story is "trending" when at least 2 different outlets cover it. Pick up to 5 trending stories, best first, ` +
      `favouring those of broad public interest in Morocco. Skip rumours, crime reports naming private individuals, graphic tragedies, and anything we already covered:\n${recent}\n\n` +
      `Return ONLY JSON: {"stories":[{"headline":"working Arabic headline","category":"one of ${categories.join('|')}","itemIds":[ids of items about this story]}]}`,
  });
  return (parseJson(text).stories || [])
    .map((s) => ({ ...s, items: (s.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean) }))
    .filter((s) => new Set(s.items.map((i) => i.outlet)).size >= 2);
}

/** Notes = the actual text of the outlets' articles about the story; sources = their real URLs. */
function buildNotes(story) {
  const text = story.items.map((i) => `### ${i.outlet} (${i.date.toISOString?.().slice(0, 10) ?? ''})\nالعنوان: ${i.title}\n${i.text.slice(0, 2200)}`).join('\n\n');
  const sources = story.items.map((i) => ({ title: `${i.outlet} — ${i.title}`.slice(0, 140), url: i.link }));
  return { text, sources };
}

async function writePost(story, notes, posts, feedback = '') {
  const links = posts.slice(0, 30).map((p) => `- ${p.slug}: ${p.title}`).join('\n') || '(none yet)';
  const { text } = await generate({
    system: SYSTEM, json: true, maxTokens: 12000,
    prompt: `Write the news article in Arabic.\nStory: ${story.headline}\nSuggested category: ${story.category}\n\nSOURCE ARTICLES from Moroccan outlets (the ONLY source of facts; rewrite in your own words, never copy sentences):\n${notes}\n\n` +
      `Existing articles you may link to (0-2 links, only if clearly relevant, as markdown links to /أخبار/<slug>/):\n${links}\n\n` +
      `Requirements:\n- 550-950 words of markdown body in Arabic. NO H1. 3-5 H2 sections (e.g. "ما الذي حدث؟", "الخلفية", "لماذا يهم القراء؟", "ماذا بعد؟" - adapt to the story).\n` +
      `- Inverted pyramid: the first paragraph answers who/what/when/where in 2-3 sentences. Then a short bullet list "أبرز النقاط" (3-4 bullets).\n` +
      `- Attribute every claim to its source by name. Say clearly what is unconfirmed. End with a one-line note of the date of the latest information.\n` +
      `- Title: specific, informative, 45-62 chars (Google truncates longer titles), key terms FIRST, no clickbait, no all-caps tricks. Description: 110-170 chars, accurate summary.\n` +
      `- slug: 3-8 ARABIC words joined by hyphens, taken from the title's key terms (no diacritics, no punctuation, no stop-word padding), e.g. "حوادث-السير-بالمدن-33-قتيلا-أسبوع". imageName: 3-6 lowercase English words joined by hyphens (the image file name). tags: up to 5 short Arabic tags.\n` +
      `- imageQueries: 3 English search phrases, from specific to general, each naming a PLACE, building, landscape or object (never people, teams or events), e.g. ["Parliament of Morocco Rabat","Rabat Morocco","government building"]; the first photo that exists is used. imageAlt: Arabic literal description of what such a photo shows.\n` +
      `- thumb: for the designed fallback cover when no photo is found: {"icon": one of scale|landmark|football|fuel|car|globe|climate|chart|flask|bolt|shield|heart|mic|chip|book, "stat": the single most striking figure of the story (e.g. "33", "16,20", "98%"), "statLabel": 3-8 Arabic words saying what it counts}.`
      `- 2-4 FAQ items with 1-3 sentence answers drawn only from the notes.\n${feedback ? `\nFix these problems from the previous attempt:\n${feedback}\n` : ''}\n` +
      `Return JSON: {"title":"","description":"","slug":"","imageName":"","category":"","tags":[""],"imageQueries":[""],"imageAlt":"","thumb":{"icon":"","stat":"","statLabel":""},"body":"markdown","faq":[{"q":"","a":""}]}`,
  });
  return parseJson(text);
}

async function main() {
  const posts = existingPosts();
  console.log('Fetching news feeds...');
  const items = await gatherNews(cfg.feeds || []);
  console.log(`Fetched ${items.length} recent items from ${new Set(items.map((i) => i.outlet)).size} outlets`);
  if (items.length < 8) throw new Error('Too few news items fetched; feeds may be blocked or down.');
  const stories = await pickStories(items, posts);
  if (!stories.length) throw new Error('No trending stories (covered by 2+ outlets) found');
  console.log('Candidates:\n' + stories.map((s) => ` - ${s.headline} (${new Set(s.items.map((i) => i.outlet)).size} outlets)`).join('\n'));

  for (const story of stories.slice(0, 3)) {
    console.log(`\nStory: ${story.headline}`);
    const notes = buildNotes(story);
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
    const imgFile = new URL(`${post.imageName || 'post-' + Date.now().toString(36)}.jpg`, assetsDir);
    post.imageCredit = await findPhoto(post.imageQueries || [post.imageQuery], imgFile.pathname);
    if (!post.imageCredit) {
      const th = post.thumb || {};
      try { await makeThumb({ category: post.category, icon: th.icon, stat: th.stat, statLabel: th.statLabel }, imgFile.pathname); post.imageAlt = th.stat ? `غلاف تحريري: ${th.stat} ${th.statLabel || ''}`.trim() : `غلاف تحريري لقسم ${cfg.categories.find((c) => c.slug === post.category)?.label ?? ''}`; }
      catch (e) { console.warn('Chromium unavailable, pattern cover:', e.message); await generateCover(post.category, imgFile.pathname); post.imageAlt = 'غلاف تجريدي بنقوش مغربية'; }
    }
    post.imagePath = `../../assets/posts/${imgFile.pathname.split('/').pop()}`;
    post.imageCredit ||= undefined;

    writeFileSync(new URL(`${slug}.md`, postsDir), toMarkdown(post, { base: cfg.base }));
    console.log(`Saved src/content/posts/${slug}.md (${post.imageCredit ? 'photo' : 'editorial thumbnail'})`);
    return;
  }
  throw new Error('No story passed the quality checks; nothing published today.');
}

main().catch((e) => { console.error(e); process.exit(1); });
