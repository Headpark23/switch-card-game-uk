import { handleSync } from "./sync.js";

export default {
  async fetch(request, env) {
    // Signed-in club backup lives at /api/sync; everything else is the static app.
    const sync = await handleSync(request, env);
    if (sync) return sync;

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
