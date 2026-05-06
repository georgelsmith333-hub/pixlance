const RENDER_API = "https://pixlance-api.onrender.com";
const POLLINATIONS_OPENAI = "https://text.pollinations.ai/openai";
const POLLINATIONS_TEXT   = "https://text.pollinations.ai";

export async function onRequest(context) {
  const { request, params } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const pathParts = params.path
    ? Array.isArray(params.path)
      ? params.path.join("/")
      : params.path
    : "";

  // ── AI Proxy ────────────────────────────────────────────────────────────────
  // Render's IP is rate-limited by Pollinations. Route AI calls through this
  // Cloudflare Worker (different IP pool, not rate-limited).
  if (pathParts === "ai-proxy") {
    try {
      const body = await request.text();
      const parsed = JSON.parse(body);
      const useOpenAI = parsed._endpoint !== "text";
      delete parsed._endpoint;

      const endpoint = useOpenAI ? POLLINATIONS_OPENAI : POLLINATIONS_TEXT;

      const polRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Referer": "https://pixlance.pages.dev",
          "Origin": "https://pixlance.pages.dev",
          "User-Agent": "Mozilla/5.0 (compatible; Pixlance/1.0)",
        },
        body: JSON.stringify(parsed),
      });

      const text = await polRes.text();
      return new Response(text, {
        status: polRes.status,
        headers: {
          "Content-Type": polRes.headers.get("Content-Type") || "text/plain",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "AI proxy error", message: String(err) }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
  }

  // ── Generic Render API proxy ─────────────────────────────────────────────────
  const url = new URL(request.url);
  const targetUrl = `${RENDER_API}/api/${pathParts}${url.search}`;

  try {
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: ["GET", "HEAD"].includes(request.method) ? null : request.body,
      redirect: "follow",
    });

    const response = await fetch(proxyRequest);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy error", message: String(err) }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
