# Daily routine — publish 3 news articles for «نبض المغرب»

You run as a fresh Claude Code session, once a day. Goal: publish **exactly 3 new Arabic news articles** (fewer only if fewer than 3 valid stories exist), each with a truthful image, then push to `main` (GitHub Actions rebuilds and deploys the site). Work in `/home/user/BloggingAgent` (if absent, clone/attach `zaidbt/bloggingagent`). **Be lean**: no screenshots, never print whole feeds, view images only through the contact sheet.

## Steps
1. `cd /home/user/BloggingAgent && git checkout main && git pull origin main && npm ci --silent`
2. `npm run news` → compact candidate list (stories reported by ≥2 outlets). Skip `COVERED` stories and stories already published (`ls src/content/posts`).
3. Pick **3 stories** with different topics, ideally different categories (politics, economy, society, sport, culture, tech, health, world). Prefer stories with concrete facts (numbers, dates, decisions) and several outlets. Skip: rumours, single-source stories, tragedies with too little verified detail, anything you can't write ≥450 words about without padding.
4. `node agent/prepare.mjs --show 3,7,9` (the numbers you chose) → read the full texts of those stories only.
5. For each story write a JSON file in `.cache/` (spec below) and run `npm run post -- .cache/<file>.json`. If the quality gate prints problems, fix the JSON and rerun.
6. `npm run contact -- 3` then **look once** at `.cache/contact.png` (Read tool). A photo must actually fit the article (place/object that is really what the alt says). If a photo is irrelevant (a person, a different city, artwork, a map of something else), delete that article's `.md` and its `src/assets/posts/<imageName>.jpg`, set `"imageQueries": []` in its JSON and rerun it: the designed editorial thumbnail (icon + key figure) is used instead. Articles with a thumbnail don't need viewing.
7. `npx astro build` must succeed.
8. `git add -A && git commit -m "Daily articles $(date -u +%F)" && git push origin HEAD:main` (if rejected: `git pull --rebase origin main`, push again). Never open a PR, never push another branch.
9. Reply with a 4-line summary: the 3 titles, category, image type (photo/thumbnail).

## Article JSON
```json
{
 "title": "45-62 chars, Arabic, key terms first, no clickbait",
 "description": "110-160 chars, accurate summary",
 "slug": "3-8 Arabic words joined by hyphens from the title (no diacritics/punctuation)",
 "imageName": "3-6 english words joined by hyphens (image file name)",
 "category": "politics|economy|society|sport|culture|tech|health|world",
 "tags": ["3-5 short Arabic tags"],
 "imageQueries": ["specific place/object", "broader place", "generic object"],
 "imageAlts": ["literal Arabic description for query 1", "… for 2", "… for 3"],
 "imageAlt": "same as imageAlts[0]",
 "thumb": {"icon": "scale|landmark|football|fuel|car|globe|climate|chart|flask|bolt|shield|heart|mic|chip|book", "stat": "the most striking figure of the story", "statLabel": "3-8 Arabic words saying what it counts"},
 "body": "markdown, see rules",
 "faq": [{"q": "", "a": ""}],
 "sources": [{"title": "<Arabic outlet> — <headline>", "url": "<the item's real URL from --show>"}]
}
```
- `body`: 480–900 words, MSA Arabic, **no H1**, 4–6 `##` sections, first paragraph answers who/what/when/where and names the outlets («هسبريس»، «لكم»، «اليوم 24»، «برلمان.كوم»، «الصحيفة»، «الأول»), then `**أبرز النقاط**` + 3–4 bullets, then sections (what happened / details or table / background / "قراءة بسيطة في الأرقام" if there are numbers / ماذا بعد؟), end with `*المعطيات مأخوذة من تقارير نُشرت يوم …*`.
- `faq`: 3 items (1–3 sentence answers drawn from the sources). `sources`: every article you used (≥2, real URLs).
- If the body comes out < 450 words, add a useful section (glossary of terms, a table, a timeline) — not filler — and label general knowledge as «تعريفات عامة… وليست من نص التقارير».

## Editorial rules (non-negotiable)
- Facts only from the supplied texts; **attribute every claim** to its outlet or the institution. Never invent quotes, numbers, names, dates. If sources disagree, show both. If information is missing, say so («لا تتضمن التقارير…»).
- Own wording; never copy sentences. Neutral tone; no opinion; no clickbait.
- Presumption of innocence (suspects: «يُشتبه»), no identifying minors/victims beyond what outlets publish respectfully, no graphic detail, no accusations against private individuals.
- Politics/Sahara/Ceuta: neutral wording (Ceuta/Melilla: «الخاضعتين للسيطرة الإسبانية»), report each side's position as theirs.
- Your own calculations (sums, durations, percentages) go in a section marked «هذه حسابات بسيطة من إعداد التحرير، وليست واردة في التقارير».
- Images: `imageQueries` name a **place, landscape or object** — never a team, people or an event (the gate rejects «team, players, national, women, men, match, president, minister, king…»). Alt text must describe literally what the picture shows.
