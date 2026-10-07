# نبض المغرب — automated Arabic news blog

An Arabic (RTL) Moroccan news site built with Astro, plus a daily AI agent. Free to run: GitHub Actions + GitHub Pages + Gemini free tier.

## How it works
1. `.github/workflows/site.yml` runs daily (06:17 UTC) and calls `agent/run.mjs`.
2. The agent uses Google Search grounding to find what is trending in Morocco, picks a story it hasn't covered, researches it across several outlets, and writes an original Arabic article that attributes every claim.
3. `agent/quality.mjs` checks the result: Arabic, length, headings, FAQ, at least 2 grounded sources, valid category and slug, no broken links, no duplicate title. It allows up to 3 rewrites per story, then moves to the next candidate. If nothing passes, nothing is published.
4. A cover image is added: a free Pexels photo (if `PEXELS_API_KEY` is set) or a generated Moroccan zellige-pattern cover. Astro optimizes it to responsive WebP and builds the social-share image.
5. The post is committed, and the site is rebuilt and deployed.

## SEO
NewsArticle, Breadcrumb, FAQ and Organization JSON-LD; canonical URLs; `lang="ar"`; sitemap; RSS; robots; `llms.txt`; Open Graph/Twitter images; category pages; related posts; sources section; About, Privacy and AI-disclosure pages.

## Setup
- Secrets (Settings → Secrets → Actions): `GEMINI_API_KEY` (required, https://aistudio.google.com/apikey) and `PEXELS_API_KEY` (optional, free, https://www.pexels.com/api/).
- Optional: variable `LLM_PROVIDER=anthropic` plus secret `ANTHROPIC_API_KEY` to write with Claude (paid).
- Edit `site.config.json` for name, tagline, categories, contact email and URL.
- Local: `npm install && npm run dev`; `GEMINI_API_KEY=... npm run agent:dry` previews an article.

## Image policy
Photos must show a place or object (stadium, building, landmark, a generic object), never a team, people or an event, so a photo can't imply it shows the story. `agent/quality.mjs` rejects an `imageQuery` naming teams/people; with no suitable photo the site uses a generated cover. `imageAlt` must describe the photo literally.

## SEO checklist (what is built in)
Arabic URLs (`/أخبار/<arabic-slug>/`, `/قسم/…`, `/وسم/…`), NewsArticle + Breadcrumb + FAQ + NewsMediaOrganization JSON-LD, canonical + hreflang, Open Graph/Twitter images (1200×630), sitemap with `<lastmod>`, Google News sitemap (`/news-sitemap.xml`), IndexNow ping after each deploy (Bing/Yandex), RSS, `llms.txt`, self-hosted fonts (no third-party request), responsive WebP images, trust pages (about, editorial policy & corrections, contact, privacy), thin tag pages are `noindex` until they hold 3 articles.

To get discovered faster: verify the site in Google Search Console and submit `sitemap-index.xml` + `news-sitemap.xml`, add it to Bing Webmaster Tools, and use a custom domain (robots.txt and root-level files only work on a domain root).
