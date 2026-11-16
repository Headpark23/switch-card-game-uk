/** The cheeky red banner shown when someone forgets to say "Last Card". It never blocks taps and fades by itself. */
export type Haha = { id: number; text: string } | null;

/** "you" gets the second person; anyone else is named. */
export function hahaText(name: string): string {
  return name === 'You' || name === 'you' ? 'HAHA - you never said Last Card!' : `HAHA - ${name} never said Last Card!`;
}

export function HahaBanner({ haha }: { haha: Haha }) {
  if (!haha) return null;
  return <div key={haha.id} className="haha-banner" role="status" aria-live="polite" data-testid="haha-banner">{haha.text}</div>;
}
