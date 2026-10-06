# BloggingAgent

A fully automated, free, SEO-optimized blog: an Astro static site plus a daily AI writing agent, run by GitHub Actions and hosted on GitHub Pages.

## How it works
1. `.github/workflows/site.yml` runs daily (cron) → `agent/run.mjs`.
2. The agent picks a topic from `agent/topics.json` (auto-refills with fresh long-tail ideas, avoiding overlap with existing posts), does web-grounded research, writes the article, and runs quality checks (`agent/quality.mjs`) with up to 3 retries. If checks fail, nothing is published.
3. The post is committed to `src/content/posts/`, the site is rebuilt and deployed.

## SEO built in
Canonical URLs, sitemap, robots.txt, RSS, `llms.txt`, JSON-LD (BlogPosting, BreadcrumbList, FAQPage, WebSite), OG/Twitter tags, semantic HTML, TOC, related posts, author/about/privacy pages, AI disclosure, cited sources, zero JS, inlined CSS (excellent Core Web Vitals).

## Setup (5 minutes)
1. Edit `site.config.json`: name, niche, audience, `url` (`https://<user>.github.io`) and `base` (`/BloggingAgent`; use `""` with a custom domain).
2. Get a free key at https://aistudio.google.com/apikey and add it as repo secret `GEMINI_API_KEY`
   (or set variable `LLM_PROVIDER=anthropic` and secret `ANTHROPIC_API_KEY`).
3. Repo Settings → Pages → Source: **GitHub Actions**.
4. Run the workflow once via Actions → "Publish daily post and deploy" → Run workflow.
5. Add the site to Google Search Console and submit `sitemap-index.xml`.

Local: `npm install && npm run dev`; `GEMINI_API_KEY=... npm run agent:dry` previews a post without saving.
