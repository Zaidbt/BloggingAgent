export const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 80).replace(/-+$/, '');

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/** Returns a list of human-readable problems; empty list = publishable. */
export function validate(post, existing, topic) {
  const p = [];
  const body = post.body || '';
  if (!post.title || post.title.length > 65) p.push(`title must be <= 65 chars (got ${post.title?.length})`);
  if (!post.description || post.description.length < 100 || post.description.length > 165) p.push(`description must be 100-165 chars (got ${post.description?.length})`);
  if (words(body) < 1000) p.push(`body too short: ${words(body)} words, need >= 1000`);
  if (/^#\s/m.test(body)) p.push('body must not contain an H1');
  if ((body.match(/^##\s/gm) || []).length < 4) p.push('need at least 4 H2 sections');
  if (!post.category) p.push('missing category');
  if ((post.faq || []).length < 3) p.push('need at least 3 FAQ items');
  if (topic?.keyword && !body.toLowerCase().includes(topic.keyword.toLowerCase().split(' ')[0])) p.push('primary keyword missing from body');
  if (/as an ai|i cannot browse|\[insert|lorem ipsum|TODO/i.test(body)) p.push('contains placeholder or AI-meta text');
  if (/in my (own )?experience|when i (tried|tested)|i personally/i.test(body)) p.push('contains fabricated first-person experience');
  // internal links must resolve to existing posts
  const slugs = new Set(existing.map((e) => e.slug));
  for (const m of body.matchAll(/\]\((?:\/[^)\s]*?)?\/blog\/([^/)\s]+)\/?\)/g)) if (!slugs.has(m[1])) p.push(`broken internal link to unknown post "${m[1]}"; remove it`);
  // near-duplicate title guard
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (existing.some((e) => norm(e.title) === norm(post.title))) p.push('title duplicates an existing post');
  return p;
}
