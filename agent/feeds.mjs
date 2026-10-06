// Reads RSS feeds of Moroccan news outlets (free, no API key) and returns recent items with their text.
const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strip = (html) => decode(decode(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1].trim() : '';
};

export function parseFeed(xml) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([block]) => ({
    title: strip(tag(block, 'title')),
    link: decode(tag(block, 'link')).trim(),
    date: new Date(decode(tag(block, 'pubDate')) || decode(tag(block, 'dc:date'))),
    text: strip(tag(block, 'content:encoded') || tag(block, 'description')),
  })).filter((i) => i.title && /^https?:\/\//.test(i.link));
}

/** Fetch all feeds in parallel; returns [{id,outlet,title,link,date,text}] from the last `hours` hours. */
export async function gatherNews(feeds, { hours = 48, perFeed = 12 } = {}) {
  const since = Date.now() - hours * 3600e3;
  const results = await Promise.all(feeds.map(async (url) => {
    const outlet = new URL(url).hostname.replace(/^(www|ar)\./, '');
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; NabdAlMaghribBot/1.0)', accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text())
        .filter((i) => isNaN(i.date) || +i.date >= since)
        .slice(0, perFeed)
        .map((i) => ({ ...i, outlet }));
      console.log(`  feed ${outlet}: ${items.length} items`);
      return items;
    } catch (e) {
      console.warn(`  feed ${outlet}: failed (${e.message})`);
      return [];
    }
  }));
  const seen = new Set();
  return results.flat().filter((i) => !seen.has(i.link) && seen.add(i.link)).map((i, n) => ({ ...i, id: n + 1 }));
}
