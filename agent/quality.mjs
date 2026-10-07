export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const arabicRatio = (s) => {
  const letters = s.match(/\p{L}/gu) || [];
  return letters.length ? (s.match(/\p{Script=Arabic}/gu) || []).length / letters.length : 0;
};

/** Returns human-readable problems; an empty list means the post is publishable. */
export function validate(post, existing, { categories }) {
  const p = [];
  const body = post.body || '';
  if (!post.title || post.title.length > 85) p.push(`title must be <= 85 chars (got ${post.title?.length})`);
  if (!post.description || post.description.length < 90 || post.description.length > 200) p.push(`description must be 90-200 chars (got ${post.description?.length})`);
  if (words(body) < 450) p.push(`body too short: ${words(body)} words, need >= 450`);
  if (words(body) > 1500) p.push(`body too long: ${words(body)} words, keep it under 1500`);
  if (arabicRatio(body) < 0.8) p.push('body must be written in Arabic');
  if (arabicRatio(post.title || '') < 0.8) p.push('title must be in Arabic');
  if (/^#\s/m.test(body)) p.push('body must not contain an H1');
  if ((body.match(/^##\s/gm) || []).length < 3) p.push('need at least 3 H2 sections');
  if (!categories.includes(post.category)) p.push(`category must be one of: ${categories.join(', ')}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+){1,}$/.test(post.slug || '') || post.slug.length > 80) p.push('slug must be 2+ lowercase english words joined by hyphens');
  if (/\b(team|teams|player|players|squad|national|women|womens|men|mens|fans|crowd|match|celebration|president|minister|king)\b/i.test(post.imageQuery || '')) {
    p.push('imageQuery must name a PLACE or OBJECT (e.g. a stadium, a building, a landmark), never a team, people or an event; otherwise omit it to get a generated cover');
  }
  if (!post.imageAlt) p.push('missing imageAlt (Arabic description of an illustrative image)');
  // imageAlt must describe the photo literally; it must not suggest the photo shows the event or people in the story.
  if ((post.faq || []).length < 2) p.push('need at least 2 FAQ items');
  if ((post.sources || []).length < 2) p.push('not enough grounded sources (need >= 2)');
  if (/as an ai|i cannot|\[insert|lorem ipsum|TODO|كنموذج لغوي/i.test(body)) p.push('contains placeholder or AI-meta text');
  const slugs = new Set(existing.map((e) => e.slug));
  for (const m of body.matchAll(/\]\((?:\/[^)\s]*?)?\/blog\/([^/)\s]+)\/?\)/g)) if (!slugs.has(m[1])) p.push(`broken internal link to unknown post "${m[1]}"; remove it`);
  const norm = (s) => s.replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (existing.some((e) => norm(e.title) === norm(post.title))) p.push('title duplicates an existing post');
  return p;
}
