import { handleSync } from "../worker/sync.js";
import { blobStore, makeDb } from "./_db.js";

const db = makeDb(blobStore);

export default {
  async fetch(request) {
    const env = { GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID, SESSION_SECRET: process.env.SESSION_SECRET, DB: process.env.BLOB_READ_WRITE_TOKEN ? db : undefined };
    return (await handleSync(request, env)) ?? new Response("Not found", { status: 404 });
  },
};
