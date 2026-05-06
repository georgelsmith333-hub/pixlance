/**
 * Multi-Model AI Router with Auto-Rotation v2
 * Uses Pollinations.ai — free, no keys, 7+ models
 * Auto-selects best model per task, rotates on failure with smart backoff
 */

const POLLINATIONS_OPENAI = "https://text.pollinations.ai/openai";
const POLLINATIONS_TEXT   = "https://text.pollinations.ai";
// CF Pages edge proxy — zero rate limits (primary for ALL environments)
const CF_PROXY = "https://pixlance.pages.dev/api/ai-proxy";
const AI_PROXY_URL = process.env.AI_PROXY_URL ?? CF_PROXY;

export const MODELS = {
  gpt4mini:  { id: "openai",              name: "GPT-4o Mini",       best: ["listing","title","seo","description"] },
  deepseek:  { id: "deepseek-r1",         name: "DeepSeek R1",       best: ["analysis","research","keywords"] },
  llama:     { id: "llama",               name: "Llama 3.3 70B",     best: ["bulk","rewrite","general"] },
  gemini:    { id: "gemini",              name: "Gemini 2.0 Flash",  best: ["image","visual","categorize"] },
  mistral:   { id: "mistral",             name: "Mistral 7B",        best: ["fast","short","tags"] },
  qwen:      { id: "qwen-coder",          name: "Qwen 2.5 Coder",    best: ["structured","json","data"] },
  claude:    { id: "claude-hybridspace",  name: "Claude",            best: ["writing","tone","polish"] },
  phi:       { id: "phi",                 name: "Phi-4",             best: ["fast","fallback"] },
};

// Task → model priority list (first = best, auto-rotates on failure)
const TASK_MODELS: Record<string, string[]> = {
  listing:     ["openai", "claude-hybridspace", "gemini", "llama", "deepseek-r1"],
  title:       ["openai", "mistral", "gemini", "llama"],
  description: ["openai", "claude-hybridspace", "llama", "deepseek-r1"],
  keywords:    ["deepseek-r1", "openai", "llama", "gemini"],
  research:    ["deepseek-r1", "openai", "gemini", "llama"],
  categorize:  ["openai", "gemini", "llama", "mistral"],
  bulk:        ["llama", "openai", "mistral", "gemini"],
  json:        ["openai", "qwen-coder", "gemini", "llama"],
  seo:         ["openai", "gemini", "llama", "deepseek-r1"],
  analysis:    ["deepseek-r1", "openai", "gemini", "llama"],
  general:     ["openai", "llama", "gemini", "mistral"],
};

let modelCallCount:   Record<string, number> = {};
let modelFailCount:   Record<string, number> = {};
let modelRateLimited: Record<string, number> = {};
let modelLastFail:    Record<string, number> = {};

const MAX_FAIL_COUNT = 4;
const FAIL_RECOVERY_MS = 8 * 60 * 1000; // 8 min

function getBestModels(task: string): string[] {
  return TASK_MODELS[task] ?? TASK_MODELS.general;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function isModelAvailable(modelId: string): boolean {
  const fails = modelFailCount[modelId] ?? 0;
  if (fails < MAX_FAIL_COUNT) return true;
  // Allow recovery after cooldown period
  const lastFail = modelLastFail[modelId] ?? 0;
  if (Date.now() - lastFail > FAIL_RECOVERY_MS) {
    modelFailCount[modelId] = 0;
    return true;
  }
  return false;
}

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

async function callModel(
  prompt: string,
  modelId: string,
  systemPrompt?: string,
  timeoutMs = 50000,
): Promise<string> {
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  const seed = Math.floor(Math.random() * 999999);
  const payload = { messages, model: modelId, seed, private: true };

  const commonHeaders = {
    "Content-Type": "application/json",
    "Referer": "https://pixlance.pages.dev",
    "Origin": "https://pixlance.pages.dev",
    "User-Agent": "Mozilla/5.0 (compatible; Pixlance/2.0)",
  };

  // Use AI proxy if configured (for Render — routes through CF worker)
  if (AI_PROXY_URL) {
    for (const endpoint of ["openai", "text"] as const) {
      try {
        const res = await fetch(AI_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, _endpoint: endpoint }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.status === 429) {
          await delay(2000);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text?.trim()) throw new Error("Empty response");
        const content = extractContent(text);
        if (content.length < 5) throw new Error("Response too short");
        return content;
      } catch (e) {
        if (endpoint === "text") throw e;
        await delay(1000);
      }
    }
  }

  // Direct Pollinations call (Replit dev / any non-Render environment)
  for (const [url, bodyOverride] of [
    [POLLINATIONS_OPENAI, {}],
    [POLLINATIONS_TEXT, { seed: seed + 1 }],
  ] as const) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({ ...payload, ...bodyOverride }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429) {
        await delay(2500);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${modelId}`);
      const text = await res.text();
      if (!text?.trim()) throw new Error("Empty response");
      const content = extractContent(text);
      if (content.length < 5) throw new Error("Content too short");
      return content;
    } catch (e) {
      if (url === POLLINATIONS_TEXT) throw e;
      await delay(800);
    }
  }

  throw new Error(`All endpoints failed for ${modelId}`);
}

export async function callAI(
  prompt: string,
  task = "listing",
  systemPrompt?: string,
  timeoutMs = 50000,
): Promise<string> {
  const models = getBestModels(task);
  let lastError: Error | null = null;

  for (const modelId of models) {
    if (!isModelAvailable(modelId)) continue;

    const rateLimits = modelRateLimited[modelId] ?? 0;
    if (rateLimits > 0) {
      await delay(Math.min(rateLimits * 2500, 10000));
    }

    try {
      const result = await callModel(prompt, modelId, systemPrompt, timeoutMs);
      modelCallCount[modelId] = (modelCallCount[modelId] ?? 0) + 1;
      modelFailCount[modelId] = 0;
      modelRateLimited[modelId] = 0;
      return result;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("429")) {
        modelRateLimited[modelId] = (modelRateLimited[modelId] ?? 0) + 1;
        console.warn(`[AI] ${modelId} rate-limited, backing off`);
      } else {
        modelFailCount[modelId] = (modelFailCount[modelId] ?? 0) + 1;
        modelLastFail[modelId] = Date.now();
        console.warn(`[AI] ${modelId} failed (${msg}), trying next`);
      }
      lastError = err as Error;
      await delay(1200);
    }
  }

  // Last resort: try ALL models including non-primary ones
  for (const model of Object.values(MODELS)) {
    if (!isModelAvailable(model.id)) continue;
    if (models.includes(model.id)) continue;
    try {
      const result = await callModel(prompt, model.id, systemPrompt, timeoutMs);
      console.log(`[AI] Fallback success with ${model.id}`);
      return result;
    } catch { continue; }
  }

  throw lastError ?? new Error("All AI models failed — please retry");
}

export async function callAIJSON<T = Record<string, unknown>>(
  prompt: string,
  task = "json",
  systemPrompt?: string,
): Promise<T> {
  const jsonPrompt = `${prompt}\n\nCRITICAL: Respond with ONLY valid JSON. No markdown code blocks, no explanation text, no \`\`\`json. Start with { and end with }. Pure JSON only.`;
  const raw = await callAI(jsonPrompt, task, systemPrompt);

  // Extract JSON block from response (AI sometimes wraps in markdown despite instructions)
  let jsonStr = raw;
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
  const match = objMatch ?? arrMatch;
  if (!match) throw new Error("No valid JSON found in AI response");

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    // Common AI JSON mistakes: trailing commas, unescaped chars, truncated
    const fixed = match[0]
      .replace(/,\s*([}\]])/g, "$1")       // trailing commas
      .replace(/\t/g, "  ")                 // tabs
      .replace(/\n/g, "\\n")               // unescaped newlines inside strings
      .replace(/\\n/g, "\n");              // re-fix legitimate escaped newlines
    try {
      return JSON.parse(fixed) as T;
    } catch {
      // Last attempt: extract just the outermost object
      const lastMatch = raw.match(/\{[\s\S]+\}/);
      if (lastMatch) return JSON.parse(lastMatch[0]) as T;
      throw new Error("JSON parse failed after all repair attempts");
    }
  }
}

export async function callAIParallel(
  prompts: { prompt: string; task: string; system?: string }[],
): Promise<string[]> {
  const results = await Promise.allSettled(
    prompts.map(p => callAI(p.prompt, p.task, p.system))
  );
  return results.map(r =>
    r.status === "fulfilled" ? r.value : `{"error":"${r.reason as string}"}`
  );
}

// Periodic health reset every 8 min
setInterval(() => {
  // Only reset rate limits, not hard failures (those recover via cooldown)
  modelRateLimited = {};
  console.log("[AI] Rate-limit counters reset");
}, 8 * 60 * 1000);

export function getModelStats() {
  return {
    calls: modelCallCount,
    failures: modelFailCount,
    rateLimits: modelRateLimited,
    available: Object.fromEntries(Object.values(MODELS).map(m => [m.id, isModelAvailable(m.id)])),
  };
}
