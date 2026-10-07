#!/usr/bin/env node
// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver...) about fresh URLs right after a deploy.
// Google does not use IndexNow: submit the sitemap in Search Console instead.
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const KEY = '27d813afd0476bf20fa736935b59ee3c';
const base = (cfg.url + (cfg.base || '')).replace(/\/$/, '');

try {
  // submit what the news sitemap lists (articles of the last 2 days) plus the home page
  const xml = await (await fetch(`${base}/news-sitemap.xml`, { headers: { 'user-agent': 'NabdAlMaghribBot/1.0' } })).text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const urlList = [...new Set([base + '/', ...urls])];
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(cfg.url).host, key: KEY, keyLocation: `${base}/${KEY}.txt`, urlList }),
  });
  console.log(`IndexNow: submitted ${urlList.length} URLs -> HTTP ${res.status}`);
} catch (e) {
  console.warn('IndexNow failed (non-fatal):', e.message);
}
