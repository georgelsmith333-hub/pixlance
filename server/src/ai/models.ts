/**
 * Multi-Model AI Router with Auto-Rotation
 * Uses Pollinations.ai — free, no keys, 6+ models
 * Auto-selects best model per task, rotates on failure
 */

const POLLINATIONS_BASE = "https://text.pollinations.ai";

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

function getBestModel(task: string): string[] {
  return TASK_MODELS[task] ?? TASK_MODELS.listing;
}

export async function callAI(
  prompt: string,
  task: string = "listing",
  systemPrompt?: string,
  retries: number = 3
): Promise<string> {
  const models = getBestModel(task);
  let lastError: Error | null = null;

  for (const modelId of models) {
    // Skip models that have failed too many times recently
    if ((modelFailCount[modelId] ?? 0) >= 3) continue;

    try {
      const result = await callModel(prompt, modelId, systemPrompt);
      modelCallCount[modelId] = (modelCallCount[modelId] ?? 0) + 1;
      // Reset fail count on success
      modelFailCount[modelId] = 0;
      return result;
    } catch (err) {
      modelFailCount[modelId] = (modelFailCount[modelId] ?? 0) + 1;
      lastError = err as Error;
      console.warn(`[AI] Model ${modelId} failed: ${(err as Error).message}, trying next...`);
    }
  }

  // Last resort: try any available model
  for (const [, model] of Object.entries(MODELS)) {
    try {
      return await callModel(prompt, model.id, systemPrompt);
    } catch { continue; }
  }

  throw lastError ?? new Error("All AI models failed");
}

async function callModel(prompt: string, modelId: string, systemPrompt?: string): Promise<string> {
  const body = {
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
    model: modelId,
    seed: Math.floor(Math.random() * 999999),
  };

  const res = await fetch(POLLINATIONS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(40000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from model ${modelId}`);
  const text = await res.text();
  if (!text?.trim()) throw new Error(`Empty response from ${modelId}`);
  return text.trim();
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
  console.log("[AI] Model health counters reset");
}, 10 * 60 * 1000);

export function getModelStats() {
  return { calls: modelCallCount, failures: modelFailCount };
}
