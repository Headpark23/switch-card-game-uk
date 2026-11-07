// A small per-visitor rate limit. It lives in each function instance's memory, so it is best-effort protection
// against floods, not a guarantee. The address is only used as a short-lived key and is never stored anywhere.
export function makeLimiter({ max, windowMs }) {
  const hits = new Map();
  return function allow(request, now = Date.now()) {
    const key = (request.headers.get("x-forwarded-for") || "anonymous").split(",")[0].trim();
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) { hits.set(key, { start: now, count: 1 }); return true; }
    entry.count += 1;
    return entry.count <= max;
  };
}

export const tooMany = () => new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and try again." }), { status: 429, headers: { "content-type": "application/json", "retry-after": "60" } });
