/**
 * Multi-Model AI Router with Auto-Rotation
 * Uses Pollinations.ai — free, no keys, 6+ models
 * Auto-selects best model per task, rotates on failure
 */

const POLLINATIONS_TEXT   = "https://text.pollinations.ai";
const POLLINATIONS_OPENAI = "https://text.pollinations.ai/openai";
// In production, AI calls are routed through the CF Pages Worker (Cloudflare IP)
// to avoid Render's IP being rate-limited by Pollinations.
const AI_PROXY_URL = process.env.AI_PROXY_URL ?? null;

export const MODELS = {
  gpt4mini:   { id: "openai",            name: "GPT-4o Mini",       best: ["listing","title","seo","description"] },
  deepseek:   { id: "deepseek-r1",       name: "DeepSeek R1",       best: ["analysis","research","keywords"] },
  llama:      { id: "llama",             name: "Llama 3.3 70B",     best: ["bulk","rewrite","general"] },
  gemini:     { id: "gemini",            name: "Gemini 2.0 Flash",  best: ["image","visual","categorize"] },
  mistral:    { id: "mistral",           name: "Mistral 7B",        best: ["fast","short","tags"] },
  qwen:       { id: "qwen-coder",        name: "Qwen 2.5",          best: ["structured","json","data"] },
  claude:     { id: "claude-hybridspace",name: "Claude",            best: ["writing","tone","polish"] },
};

// Task → best model order (auto-rotation on failure)
const TASK_MODELS: Record<string, string[]> = {
  listing:     ["openai", "claude-hybridspace", "llama", "gemini"],
  title:       ["openai", "mistral", "llama", "gemini"],
  description: ["openai", "claude-hybridspace", "llama", "deepseek-r1"],
  keywords:    ["deepseek-r1", "openai", "llama", "mistral"],
  research:    ["deepseek-r1", "llama", "openai", "gemini"],
  categorize:  ["openai", "gemini", "llama", "mistral"],
  bulk:        ["llama", "openai", "mistral", "gemini"],
  json:        ["openai", "qwen-coder", "deepseek-r1", "llama"],
};

let modelCallCount: Record<string, number> = {};
let modelFailCount: Record<string, number> = {};
// Tracks 429 rate-limit hits — use longer backoff, but keep retrying
let modelRateLimited: Record<string, number> = {};

function getBestModel(task: string): string[] {
  return TASK_MODELS[task] ?? TASK_MODELS.listing;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function extractContent(text: string): string {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
    if (choices?.[0]?.message?.content) return choices[0].message!.content!.trim();
    if (json.role === "assistant") {
      const content = json.content ?? json.reasoning_content;
      if (typeof content === "string" && content.trim()) return content.trim();
    }
    if (typeof json.content === "string" && json.content.trim()) return json.content.trim();
  } catch { /* raw text */ }
  return text.trim();
}

export async function callAI(
  prompt: string,
  task: string = "listing",
  systemPrompt?: string,
): Promise<string> {
  const models = getBestModel(task);
  let lastError: Error | null = null;

  for (const modelId of models) {
    // Skip models that have crashed too many times (not rate-limited ones)
    if ((modelFailCount[modelId] ?? 0) >= 5) continue;

    // If recently rate-limited, add a backoff delay but still try
    const rateLimitHits = modelRateLimited[modelId] ?? 0;
    if (rateLimitHits > 0) {
      await delay(Math.min(rateLimitHits * 3000, 12000));
    }

    try {
      const result = await callModel(prompt, modelId, systemPrompt);
      modelCallCount[modelId] = (modelCallCount[modelId] ?? 0) + 1;
      modelFailCount[modelId] = 0;
      modelRateLimited[modelId] = 0;
      return result;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("429")) {
        // Rate limit: don't count as hard failure, but back off
        modelRateLimited[modelId] = (modelRateLimited[modelId] ?? 0) + 1;
        console.warn(`[AI] Model ${modelId} rate-limited (429), backing off...`);
      } else {
        modelFailCount[modelId] = (modelFailCount[modelId] ?? 0) + 1;
        console.warn(`[AI] Model ${modelId} failed: ${msg}, trying next...`);
      }
      lastError = err as Error;
      await delay(1500);
    }
  }

  // Last resort: try every model (including lower-priority ones), skipping only hard-failed ones
  for (const [, model] of Object.entries(MODELS)) {
    if ((modelFailCount[model.id] ?? 0) >= 5) continue;
    if (models.includes(model.id)) continue; // already tried above
    try {
      return await callModel(prompt, model.id, systemPrompt);
    } catch { continue; }
  }

  throw lastError ?? new Error("All AI models failed");
}

async function callModel(prompt: string, modelId: string, systemPrompt?: string): Promise<string> {
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  const seed = Math.floor(Math.random() * 999999);

  const commonHeaders = {
    "Content-Type": "application/json",
    "Referer": "https://pixlance.pages.dev",
    "Origin": "https://pixlance.pages.dev",
    "User-Agent": "Mozilla/5.0 (compatible; Pixlance/1.0)",
  };

  const payload = { messages, model: modelId, seed, private: true };

  // If an AI proxy URL is configured (CF Pages Worker), use it to avoid Render IP rate-limits
  if (AI_PROXY_URL) {
    let res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, _endpoint: "openai" }),
      signal: AbortSignal.timeout(50000),
    });

    if (res.status === 429 || !res.ok) {
      await delay(1500);
      res = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, seed: seed + 1, _endpoint: "text" }),
        signal: AbortSignal.timeout(50000),
      });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} from model ${modelId}`);
    const text = await res.text();
    if (!text?.trim()) throw new Error(`Empty response from ${modelId}`);
    return extractContent(text);
  }

  // Direct Pollinations call (local dev or non-Render environments)
  let res = await fetch(POLLINATIONS_OPENAI, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  });

  if (res.status === 429 || !res.ok) {
    await delay(1500);
    res = await fetch(POLLINATIONS_TEXT, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({ ...payload, seed: seed + 1 }),
      signal: AbortSignal.timeout(45000),
    });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} from model ${modelId}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error(`Empty response from ${modelId}`);
  return extractContent(text);
}

export async function callAIJSON<T = Record<string, unknown>>(
  prompt: string,
  task: string = "json",
  systemPrompt?: string
): Promise<T> {
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, no code blocks. Pure JSON only.`;
  const raw = await callAI(jsonPrompt, task, systemPrompt);

  // Extract JSON from response
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("No valid JSON in response");

  return JSON.parse(match[0]) as T;
}

export async function callAIParallel(
  prompts: { prompt: string; task: string; system?: string }[]
): Promise<string[]> {
  const results = await Promise.allSettled(
    prompts.map(p => callAI(p.prompt, p.task, p.system))
  );
  return results.map(r =>
    r.status === "fulfilled" ? r.value : `Error: ${r.reason as string}`
  );
}

// Periodic model health reset (every 10 min)
setInterval(() => {
  modelFailCount = {};
  modelRateLimited = {};
  console.log("[AI] Model health counters reset");
}, 10 * 60 * 1000);

export function getModelStats() {
  return { calls: modelCallCount, failures: modelFailCount, rateLimits: modelRateLimited };
}
