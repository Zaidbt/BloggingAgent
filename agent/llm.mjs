// Minimal LLM client (no dependencies). Providers: gemini (free tier, default) | anthropic.
const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

async function post(url, headers, body) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7, ...(json && !search ? { responseMimeType: 'application/json' } : {}) },
      ...(search ? { tools: [{ google_search: {} }] } : {}),
    });
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
