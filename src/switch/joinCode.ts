import { lookupTable, RoomApiError } from "./onlineRoom";
import { fetchShare } from "./shareNight";

/**
 * Switch hands out three kinds of code: a scored night (6 characters), a table of friends (6) and a shared club (8).
 * A person cannot tell a night code from a table code by looking, so any place that takes a code works out which
 * one it is, and sends them to the right place instead of saying "not found".
 */
export type CodeKind = "table" | "night" | "club";
export interface ResolvedCode { readonly kind: CodeKind; readonly code: string; readonly as?: string }

/**
 * Pulls a code out of whatever was typed or pasted: the bare code, a code with spaces or dashes ("abc-234"),
 * or a whole invitation link or message that contains one.
 */
export function readCode(raw: string): { code: string; kind?: CodeKind; as?: string } {
  const text = raw.trim();
  const link = text.match(/https?:\/\/[^\s]+/i)?.[0];
  if (link) {
    try {
      const url = new URL(link);
      for (const kind of ["table", "night", "club"] as const) {
        const value = url.searchParams.get(kind);
        if (value) return { code: value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, kind === "club" ? 8 : 6), kind, ...(url.searchParams.get("as") ? { as: url.searchParams.get("as") as string } : {}) };
      }
    } catch { /* not a link after all: treat it as typed text */ }
  }
  return { code: text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) };
}

/**
 * Finds out what a code is. Eight characters is a club. Six could be a table or a night, so both are asked at once.
 * Returns null when it is neither; throws only when the server could not be reached at all.
 */
export async function resolveCode(raw: string): Promise<ResolvedCode | null> {
  const read = readCode(raw);
  if (read.kind) return { kind: read.kind, code: read.code, ...(read.as ? { as: read.as } : {}) };
  const { code } = read;
  if (code.length === 8) return { kind: "club", code };
  if (code.length !== 6) return null;
  const [table, night] = await Promise.allSettled([lookupTable(code), fetchShare(code)]);
  // An answer that is not a real table or night (a proxy or an old server replying with a page) does not count.
  if (table.status === "fulfilled" && typeof table.value?.code === "string") return { kind: "table", code };
  if (night.status === "fulfilled" && night.value?.snapshot) return { kind: "night", code };
  const unreachable = (outcome: PromiseSettledResult<unknown>) => outcome.status === "rejected" && (outcome.reason instanceof RoomApiError ? outcome.reason.status === 0 : outcome.reason instanceof TypeError);
  if (unreachable(table) && unreachable(night)) throw new Error("Could not reach Switch. Check your connection and try again.");
  return null;
}

export const NOT_FOUND = "We could not find a table, night or club with that code. Check it with the person who sent it. Codes last a day for tables, two weeks for nights.";
