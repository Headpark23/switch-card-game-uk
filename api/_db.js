// A tiny stand-in for the D1 "club_sync" table, stored one private file per Google account.
// worker/sync.js only ever runs two statements (read one row, upsert one row), so that is all this supports.
import { get, put } from "@vercel/blob";

const pathFor = (userId) => `club-sync/${String(userId).replace(/[^0-9A-Za-z_-]/g, "_")}.json`;

export const blobStore = {
  async read(userId) {
    const result = await get(pathFor(userId), { access: "private" });
    if (!result || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  },
  async write(userId, row) {
    await put(pathFor(userId), JSON.stringify(row), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
  },
};

export function makeDb(store) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (!/^\s*SELECT/i.test(sql)) throw new Error("Unsupported statement");
              return (await store.read(args[0])) ?? null;
            },
            async run() {
              if (!/^\s*INSERT/i.test(sql)) throw new Error("Unsupported statement");
              await store.write(args[0], { document: args[1], updated_at: args[2] });
              return { success: true };
            },
          };
        },
      };
    },
  };
}
