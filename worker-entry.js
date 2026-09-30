import {
  onRequestOptions,
  onRequestPost
} from "./functions/api/chat.ts";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path === "/api/chat" || path === "/api/chat/") {
      const context = { request, env };

      if (request.method === "OPTIONS") {
        return onRequestOptions(context);
      }

      if (request.method === "POST") {
        return onRequestPost(context);
      }

      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST, OPTIONS" }
      });
    }

    if (path.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
