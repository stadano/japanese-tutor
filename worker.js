/**
 * 読 — backend.
 *
 * Two jobs, both small:
 *   POST /api    → forwards to the Anthropic API, adding the key server-side
 *   GET/PUT /sync → reads and writes your state in KV, so devices agree
 *
 * Deploy once and never think about it again. See README.md.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Yomi-Token",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // Shared secret. Not Fort Knox, but it keeps your API budget yours.
    if (request.headers.get("X-Yomi-Token") !== env.TOKEN) {
      return json({ error: "bad token" }, 401);
    }

    if (url.pathname === "/sync") {
      if (request.method === "GET") {
        const stored = await env.YOMI.get("state");
        return json(stored || "null");
      }
      if (request.method === "PUT") {
        await env.YOMI.put("state", await request.text());
        return json({ ok: true });
      }
    }

    if (url.pathname === "/api" && request.method === "POST") {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: await request.text(),
      });
      return json(await upstream.text(), upstream.status);
    }

    return json({ error: "not found" }, 404);
  },
};
