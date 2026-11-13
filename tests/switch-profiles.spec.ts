import { expect, test } from "@playwright/test";

test("profiles reuse normalised names and keep stable identities", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const profiles = await import("/src/switch/profiles.ts");
    let nextId = 0;
    const first = profiles.ensureProfiles({ keepMe: true }, ["  Alex ", "Blair"], {
      now: "2026-11-06T10:00:00.000Z",
      createId: () => `profile-${++nextId}`,
    });
    const second = profiles.ensureProfiles(first.extensions, ["alex", "Casey"], {
      now: "2026-11-07T10:00:00.000Z",
      createId: () => `profile-${++nextId}`,
    });
    return { first, second };
  });

  expect(result.first.players).toEqual([
    { id: "profile-1", name: "Alex" },
    { id: "profile-2", name: "Blair" },
  ]);
  expect(result.second.players[0]).toEqual({ id: "profile-1", name: "Alex" });
  expect(result.second.players[1]).toEqual({ id: "profile-3", name: "Casey" });
  expect(result.second.profiles).toHaveLength(3);
  expect(result.second.extensions.keepMe).toBe(true);
});

test("a hidden same-name twin never blocks starting a match, and converge folds it away", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const profiles = await import("/src/switch/profiles.ts");
    const sync = await import("/src/switch/clubSync.ts");
    const source = {
      switchProfiles: [
        { version: 1, id: "martin-old", name: "Martin", colour: "forest", createdAt: "2026-11-01T10:00:00.000Z", archived: true },
        { version: 1, id: "martin-new", name: "martin ", colour: "gold", createdAt: "2026-11-05T10:00:00.000Z", archived: false },
      ],
    };
    const direct = profiles.ensureProfiles(source, ["Martin", "Sam"], { createId: () => "sam" });
    const folded = sync.converge(source);
    const after = profiles.ensureProfiles(folded, ["MARTIN"]);
    return { direct: direct.players, activeProfiles: profiles.getProfiles(folded).filter((p: { archived: boolean }) => !p.archived).map((p: { id: string }) => p.id), after: after.players };
  });
  // Active twin wins when nothing was merged; after converge the oldest is kept, and only one is active.
  expect(result.direct[0].id).toBe("martin-new");
  expect(result.direct[1].id).toBe("sam");
  expect(result.activeProfiles).toEqual(["martin-old"]);
  expect(result.after).toHaveLength(1);
  expect(result.after[0].id).toBe("martin-old");
});

test("profiles validate duplicates, archive safely and resolve only unambiguous history", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const profiles = await import("/src/switch/profiles.ts");
    const source = {
      future: { retain: true },
      switchProfiles: [
        { version: 1, id: "alex", name: "Alex", colour: "forest", createdAt: "2026-11-01T10:00:00.000Z", archived: false },
        { broken: true },
        { version: 1, id: "blair", name: "Blair", colour: "gold", createdAt: "2026-11-01T10:00:00.000Z", archived: false },
      ],
    };
    const valid = profiles.getProfiles(source);
    const renamed = profiles.renameProfile(source, "blair", "Blair James");
    const archived = profiles.archiveProfile(renamed, "alex");
    const duplicateError = (() => {
      try { profiles.renameProfile(source, "blair", " alex "); return "missing"; }
      catch (error) { return error instanceof Error ? error.message : "wrong"; }
    })();
    const uniqueResolution = profiles.resolveHistoryPlayerId({ id: "old-1", name: " ALEX " }, valid);
    const ambiguousResolution = profiles.resolveHistoryPlayerId(
      { id: "old-2", name: "Alex" },
      [...valid, { ...valid[0], id: "other-alex" }],
    );
    return { valid, renamed, archived, duplicateError, uniqueResolution, ambiguousResolution };
  });

  expect(result.valid).toHaveLength(2);
  expect(result.renamed.future).toEqual({ retain: true });
  expect(result.renamed.switchProfiles.find((profile: { id: string }) => profile.id === "blair").name).toBe("Blair James");
  expect(result.archived.switchProfiles.find((profile: { id: string }) => profile.id === "alex").archived).toBe(true);
  expect(result.duplicateError).toContain("already exists");
  expect(result.uniqueResolution).toBe("alex");
  expect(result.ambiguousResolution).toBeNull();
});
