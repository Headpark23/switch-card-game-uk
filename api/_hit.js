// A plain page-load counter. It stores one number and nothing else: no IP address, no cookie, no device id.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function handleHit(request, store) {
  if (request.method === "GET") return json({ hits: (await store.read())?.hits ?? 0 });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Wrong origin" }, 403);
  const current = (await store.read())?.hits ?? 0;
  const hits = Number.isFinite(current) ? current + 1 : 1;
  await store.write({ hits });
  return json({ hits });
}
