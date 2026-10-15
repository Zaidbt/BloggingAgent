# Deploying on Cloudflare Pages (free)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose this repo, branch `main`.
2. Build settings: framework **Astro**, build command `npm run build`, output directory `dist`.
3. Environment variables (Production):
   - `NODE_VERSION` = `22`
   - `SITE_URL` = `https://<project>.pages.dev` for the first test, then the real domain (e.g. `https://alkhabar212.com`)
   - `SITE_BASE` = `/`
4. Every push to `main` (including the daily publisher's push) rebuilds and deploys automatically.
5. Custom domain: Pages project → **Custom domains → Set up a domain**. If the domain is bought at Cloudflare Registrar the DNS is automatic; otherwise point the registrar's nameservers to Cloudflare. Then change `SITE_URL` to the domain and redeploy.
6. When the domain is live: set `"url"` and `"base": ""` in `site.config.json` (so new posts bake correct internal links), disable the GitHub Pages deploy (delete `.github/workflows/site.yml` or its deploy job), and re-submit the sitemap in Search Console.

The IndexNow key file (`public/<key>.txt`) and `_headers` (security + immutable caching for assets) are already in `public/`.
