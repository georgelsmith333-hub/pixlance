/**
 * Client-side Pollinations.ai caller
 * AI calls go directly from the user's browser (unique IP per user).
 * This bypasses shared server IP rate limits entirely.
 */

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

const MODELS_BY_TASK: Record<string, string> = {
  listing:     "openai",
  title:       "openai",
  description: "openai",
  keywords:    "deepseek-r1",
  research:    "deepseek-r1",
  bulk:        "llama",
  json:        "openai",
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
  timeoutMs = 60000
): Promise<string> {
  const model = MODELS_BY_TASK[task] ?? "openai";
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];

  const res = await fetch(POLLINATIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, model, private: true, seed: Math.floor(Math.random() * 999999) }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    // 429 = rate limited. Try fallback model.
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      const fallbackRes = await fetch(POLLINATIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model: "llama", private: true, seed: Math.floor(Math.random() * 999999) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (fallbackRes.ok) {
        const txt = await fallbackRes.text();
        return extractContent(txt);
      }
    }
    throw new Error(`AI request failed (HTTP ${res.status})`);
  }

  const txt = await res.text();
  return extractContent(txt);
}

export async function callAIClientJSON<T = Record<string, unknown>>(
  prompt: string,
  task: string = "json",
  systemPrompt?: string
): Promise<T> {
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, no code blocks. Pure JSON only.`;
  const raw = await callAIClient(jsonPrompt, task, systemPrompt);
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON in AI response");
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Common AI JSON fixes: trailing commas, unescaped chars
    const fixed = match[0]
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/\t/g, "  ");
    return JSON.parse(fixed) as T;
  }
}
