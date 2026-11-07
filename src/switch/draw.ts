/** A fair shuffle (Fisher-Yates). Used for the random draws of leagues and cup fixtures. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.max(0, Math.min(0.999999, random())) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** Share players across leagues as evenly as possible, bigger leagues first: 11 across 3 gives 4, 4 and 3. */
export function evenSizes(players: number, leagues: number): number[] {
  const base = Math.floor(players / leagues);
  const extra = players % leagues;
  return Array.from({ length: leagues }, (_, index) => base + (index < extra ? 1 : 0));
}
