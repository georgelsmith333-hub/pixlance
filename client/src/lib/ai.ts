/**
 * Client-side AI caller
 * Primary: Cloudflare Pages AI proxy (pixlance.pages.dev/api/ai-proxy)
 *   — runs on CF edge, rotating IPs, zero rate limits
 * Fallback: Direct Pollinations.ai (user's browser IP)
 */

const CF_PROXY = "https://pixlance.pages.dev/api/ai-proxy";
const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

const MODELS_BY_TASK: Record<string, string> = {
  listing:     "openai",
  title:       "openai",
  description: "openai",
  keywords:    "deepseek-r1",
  research:    "deepseek-r1",
  bulk:        "llama",
  json:        "openai",
  seo:         "openai",
  analysis:    "deepseek-r1",
};

function extractContent(text: string): string {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
    if (choices?.[0]?.message?.content) return choices[0].message!.content!.trim();
    if (json.role === "assistant") {
      const c = (json.content ?? json.reasoning_content) as string | undefined;
      if (typeof c === "string" && c.trim()) return c.trim();
    }
    if (typeof json.content === "string" && json.content.trim()) return json.content.trim();
  } catch { /* raw text */ }
  return text.trim();
}

export async function callAIClient(
  prompt: string,
  task: string = "listing",
  systemPrompt?: string,
  timeoutMs = 65000
): Promise<string> {
  const model = MODELS_BY_TASK[task] ?? "openai";
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  const payload = { messages, model, private: true, seed: Math.floor(Math.random() * 999999) };

  // ── 1. Try CF Pages proxy (edge IP — no rate limits) ──────────────────────
  try {
    const res = await fetch(CF_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const txt = await res.text();
      const content = extractContent(txt);
      if (content.length > 4) return content;
    }
  } catch { /* fall through to direct */ }

  // ── 2. Try CF proxy with fallback model ───────────────────────────────────
  try {
    const res = await fetch(CF_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, model: "llama" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const txt = await res.text();
      const content = extractContent(txt);
      if (content.length > 4) return content;
    }
  } catch { /* fall through */ }

  // ── 3. Direct Pollinations (browser IP — last resort) ────────────────────
  await new Promise(r => setTimeout(r, 1000));
  const res = await fetch(POLLINATIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    // One more retry with llama
    const retry = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, model: "llama" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!retry.ok) throw new Error(`AI request failed (HTTP ${retry.status})`);
    return extractContent(await retry.text());
  }

  return extractContent(await res.text());
}

export async function callAIClientJSON<T = Record<string, unknown>>(
  prompt: string,
  task: string = "json",
  systemPrompt?: string
): Promise<T> {
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, no code blocks. Pure JSON only.`;
  const raw = await callAIClient(jsonPrompt, task, systemPrompt);

  // Extract JSON from response
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON in AI response");

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Fix common AI JSON issues: trailing commas, tab chars
    const fixed = match[0]
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/\t/g, "  ")
      .replace(/[\x00-\x1f\x7f]/g, " ");
    return JSON.parse(fixed) as T;
  }
}
