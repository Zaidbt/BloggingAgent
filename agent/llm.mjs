// Minimal LLM client (no dependencies). Providers: gemini (free tier, default) | anthropic.
const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

async function post(url, headers, body) {
  const waits = [0, 5, 15, 30, 60, 90]; // seconds; Google's 503 "high demand" spikes usually clear within minutes
  for (let attempt = 1; attempt <= waits.length; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < waits.length) {
      console.warn(`LLM HTTP ${res.status}, retrying in ${waits[attempt]}s (attempt ${attempt}/${waits.length - 1})`);
      await new Promise((r) => setTimeout(r, waits[attempt] * 1000));
      continue;
    }
    throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
}

let geminiModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

/** Newest non-lite "flash" model this key can use, found via the ListModels API. */
async function flashModels() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
  const { models = [] } = await res.json();
  const ver = (n) => (n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1] * 1;
  return models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /^models\/gemini-[\d.]+-flash(-lite)?$/.test(m.name))
    .map((m) => m.name.replace('models/', ''))
    .sort((a, b) => ver(b) - ver(a) || a.length - b.length);
}

/** Returns { text, sources:[{title,url}] }. `search` enables web grounding (Gemini only). */
export async function generate({ system, prompt, json = false, search = false, maxTokens = 8192 }) {
  if (provider === 'anthropic') {
    const data = await post('https://api.anthropic.com/v1/messages',
      { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        ...(search ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] } : {}),
      });
    const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const sources = [];
    for (const b of data.content) for (const c of b.citations || []) if (c.url) sources.push({ title: c.title || c.url, url: c.url });
    return { text, sources };
  }
  const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7, ...(json && !search ? { responseMimeType: 'application/json' } : {}) },
      ...(search ? { tools: [{ google_search: {} }] } : {}),
  };
  const call = (m) => post(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { 'x-goog-api-key': process.env.GEMINI_API_KEY }, body);
  // Try the configured model first; on retired (404) or persistently overloaded (429/5xx) models, walk down the list of flash models.
  let data, lastErr;
  const queue = [geminiModel];
  let loaded = false;
  while (queue.length) {
    const m = queue.shift();
    try {
      data = await call(m);
      if (m !== geminiModel) { geminiModel = m; console.warn(`Switched to model ${m}`); }
      break;
    } catch (e) {
      lastErr = e;
      if (process.env.GEMINI_MODEL || !/HTTP (404|429|5\d\d)/.test(e.message)) throw e;
      if (!loaded) { loaded = true; queue.push(...(await flashModels()).filter((x) => x !== m).slice(0, 4)); }
      console.warn(`Model ${m} failed (${e.message.slice(0, 70).replace(/\s+/g, ' ')}); ${queue.length ? 'trying next model' : 'no more models'}`);
    }
  }
  if (!data) throw lastErr;
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  const sources = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    if (!c.web?.uri) continue;
    let url = c.web.uri;
    try { url = (await fetch(url, { method: 'GET', redirect: 'follow' })).url; } catch {}
    sources.push({ title: c.web.title || new URL(url).hostname, url });
  }
  return { text, sources };
}

export function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}
