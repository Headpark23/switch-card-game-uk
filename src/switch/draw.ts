/** A fair shuffle (Fisher-Yates). Used for the random draws of leagues and cup fixtures. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.max(0, Math.min(0.999999, random())) * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
