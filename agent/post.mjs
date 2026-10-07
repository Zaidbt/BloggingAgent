// Serialises a generated post to a markdown file with YAML frontmatter.
const q = (s) => JSON.stringify(s); // JSON strings are valid YAML scalars

export function toMarkdown(p, { base = '' } = {}) {
  const body = p.body.trim().replace(/\]\(\/أخبار\//g, `](${base.replace(/\/$/, '')}/أخبار/`);
  return [
    '---',
    `title: ${q(p.title)}`,
    `description: ${q(p.description)}`,
    `date: ${p.date}`,
    `category: ${q(p.category)}`,
    `tags: ${q(p.tags)}`,
    `image: ${q(p.imagePath)}`,
    `imageAlt: ${q(p.imageAlt)}`,
    ...(p.imageCredit ? [`imageCredit: ${q(p.imageCredit)}`] : []),
    `faq:${p.faq.length ? '' : ' []'}`,
    ...p.faq.flatMap((f) => [`  - q: ${q(f.q)}`, `    a: ${q(f.a)}`]),
    `sources:${p.sources.length ? '' : ' []'}`,
    ...p.sources.flatMap((s) => [`  - title: ${q(s.title)}`, `    url: ${q(s.url)}`]),
    '---',
    '',
    body,
    '',
  ].join('\n');
}
