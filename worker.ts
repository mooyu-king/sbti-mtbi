type BigModelMessage = { role: "system" | "user" | "assistant"; content: string };
type BigModelRequest = {
  model?: string;
  messages: BigModelMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
};

type Env = {
  BIGMODEL_API_KEY?: string;
  ALLOWED_ORIGIN?: string;
  ASSETS: Fetcher;
};

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });

const buildCorsHeaders = (origin: string) => ({
  "access-control-allow-origin": origin,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "Origin",
});

const isAllowedOrigin = (env: Env, origin: string) => {
  if (!origin) return true;
  if (env.ALLOWED_ORIGIN) return origin === env.ALLOWED_ORIGIN;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]") return true;
    return u.hostname === "sbtimbti.com" || u.hostname.endsWith(".sbtimbti.com");
  } catch {
    return false;
  }
};

const handleChatOptions = (request: Request, env: Env) => {
  const origin = request.headers.get("Origin") ?? "";
  const allowOrigin = isAllowedOrigin(env, origin) ? origin || "*" : "";
  if (!allowOrigin) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: buildCorsHeaders(allowOrigin) });
};

const handleChatPost = async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin") ?? "";
  const allowOrigin = isAllowedOrigin(env, origin) ? origin || "*" : "";
  if (!allowOrigin) return json({ error: "forbidden" }, { status: 403, headers: buildCorsHeaders(origin || "*") });
  if (!env.BIGMODEL_API_KEY) return json({ error: "missing BIGMODEL_API_KEY" }, { status: 500, headers: buildCorsHeaders(allowOrigin) });

  let payload: BigModelRequest;
  try {
    payload = (await request.json()) as BigModelRequest;
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: buildCorsHeaders(allowOrigin) });
  }

  if (!payload || !Array.isArray(payload.messages)) {
    return json({ error: "missing_messages" }, { status: 400, headers: buildCorsHeaders(allowOrigin) });
  }

  const upstreamReq: BigModelRequest = {
    model: payload.model || "glm-4-plus",
    messages: payload.messages,
    max_tokens: payload.max_tokens ?? 2048,
    temperature: payload.temperature ?? 0.7,
    stream: Boolean(payload.stream),
  };

  const upstream = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.BIGMODEL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamReq),
  });

  const headers = new Headers(upstream.headers);
  headers.set("access-control-allow-origin", allowOrigin);
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("vary", "Origin");
  headers.delete("content-encoding");
  headers.delete("content-length");

  return new Response(upstream.body, { status: upstream.status, headers });
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return handleChatOptions(request, env);
      if (request.method === "POST") return handleChatPost(request, env);
      return json({ error: "method_not_allowed" }, { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
