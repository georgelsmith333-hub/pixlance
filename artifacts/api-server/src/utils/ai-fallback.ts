const POLLINATIONS_MODELS = ["flux", "turbo", "flux-realism", "flux-cablyai", "flux-schnell"];

export async function generateWithFallback(
  prompt: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const seed = Date.now();
  const encodedPrompt = encodeURIComponent(prompt);

  for (const model of POLLINATIONS_MODELS) {
    try {
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&enhance=true&seed=${seed}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(50000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 5000) return buf;
      }
    } catch {
      // try next
    }
  }

  // Final fallback: CF Workers AI
  const cfAccountId = process.env.CF_ACCOUNT_ID;
  const cfToken = process.env.CF_API_TOKEN;
  if (cfAccountId && cfToken) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, width: Math.min(width, 1024), height: Math.min(height, 1024), num_steps: 4 }),
          signal: AbortSignal.timeout(60000),
        },
      );
      if (res.ok) {
        const json = (await res.json()) as { result?: { image?: string } };
        if (json.result?.image) return Buffer.from(json.result.image, "base64");
      }
    } catch {
      // exhausted
    }
  }

  throw new Error("All AI endpoints exhausted. Please try again.");
}
