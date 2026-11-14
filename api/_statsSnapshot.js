// A picture of what exists on the server right now, taken from the stored files themselves rather than from counters:
// cloud backups, shared clubs and live shared nights. Nothing personal leaves this file: only counts and sizes.
const DAY = 86_400_000;
const CLUB_SAMPLE = 150;

/** `io.list(prefix)` gives [{ pathname, size, uploadedAt }]; `io.read(pathname)` gives parsed JSON or null. */
export async function buildSnapshot(io, now = Date.now()) {
  const [accounts, clubs, nights] = await Promise.all([io.list("club-sync/"), io.list("club-share/"), io.list("night-share/")]);
  const age = (file) => now - new Date(file.uploadedAt).getTime();
  const within = (files, days) => files.filter((file) => age(file) <= days * DAY).length;

  // Look inside the most recently used clubs for sizes. Counts only: names and scores are never copied out.
  const newest = [...clubs].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, CLUB_SAMPLE);
  const nightsByFormat = {};
  const sizes = { solo: 0, small: 0, medium: 0, large: 0 };
  let players = 0, savedNights = 0, seasons = 0, named = 0, read = 0;
  for (let index = 0; index < newest.length; index += 15) {
    const rows = await Promise.all(newest.slice(index, index + 15).map((file) => io.read(file.pathname).catch(() => null)));
    for (const row of rows) {
      const doc = row?.doc;
      if (!doc) continue;
      read += 1;
      const p = Array.isArray(doc.profiles) ? doc.profiles.filter((profile) => !profile.archived).length : 0;
      players += p;
      sizes[p <= 1 ? "solo" : p <= 4 ? "small" : p <= 9 ? "medium" : "large"] += 1;
      if (doc.name) named += 1;
      if (Array.isArray(doc.seasons)) seasons += doc.seasons.length;
      for (const night of Array.isArray(doc.nights) ? doc.nights : []) {
        savedNights += 1;
        if (typeof night?.format === "string") nightsByFormat[night.format] = (nightsByFormat[night.format] ?? 0) + 1;
      }
    }
  }
  return {
    takenAt: new Date(now).toISOString(),
    accounts: { total: accounts.length, backedUp7d: within(accounts, 7), backedUp30d: within(accounts, 30), bytes: accounts.reduce((sum, f) => sum + (f.size ?? 0), 0) },
    clubs: { total: clubs.length, active7d: within(clubs, 7), active30d: within(clubs, 30), inspected: read, sampled: clubs.length > read, players, nights: savedNights, seasons, named, nightsByFormat, sizes },
    sharedNights: { filesKept: nights.length, liveNow: within(nights, 14), last24h: within(nights, 1) },
  };
}
