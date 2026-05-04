const CF_BASE = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;

function cfHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function cfRemoveBackground(imageBuffer: Buffer): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) throw new Error("Cloudflare credentials not configured");

  const imageArray = Array.from(new Uint8Array(imageBuffer));

  const res = await fetch(`${CF_BASE(accountId)}/@cf/bria-ai/rmbg-1.4`, {
    method: "POST",
    headers: cfHeaders(token),
    body: JSON.stringify({ image: imageArray }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`CF Workers AI rmbg error ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as { result?: { image?: string } };
    if (json.result?.image) return Buffer.from(json.result.image, "base64");
    throw new Error("Unexpected CF AI response format");
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function cfGenerateImage(
  prompt: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) throw new Error("Cloudflare credentials not configured");

  const res = await fetch(
    `${CF_BASE(accountId)}/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: cfHeaders(token),
      body: JSON.stringify({ prompt, width: Math.min(width, 1024), height: Math.min(height, 1024), num_steps: 4 }),
      signal: AbortSignal.timeout(60000),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`CF Workers AI flux error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { result?: { image?: string } };
  if (json.result?.image) return Buffer.from(json.result.image, "base64");
  throw new Error("Unexpected CF AI response");
}
