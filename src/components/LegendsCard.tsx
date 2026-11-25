import { CheckCircle, Crown, Sparkle } from '@phosphor-icons/react';
import { PERSONALITIES } from '../switch/ai/computerTactics';
import type { ComputerGame } from '../switch/store/computerLog';

export interface LegendStatus {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly beaten: boolean;
  readonly beatenHard: boolean;
  readonly winsAgainst: number;
}

/** Derive which of the 12 computer legends the player has beaten (and whether they beat them on Hard). */
export function deriveLegends(games: readonly ComputerGame[]): LegendStatus[] {
  return PERSONALITIES.map((personality) => {
    const key = personality.name.toLowerCase();
    let winsAgainst = 0;
    let beatenHard = false;
    for (const game of games) {
      if (!game.rivals?.length) continue;
      const faced = game.rivals.find((rival) => !rival.human && rival.name.toLowerCase() === key);
      if (!faced) continue;
      if (game.won || game.place < faced.place) {
        winsAgainst += 1;
        if (game.level === 'sharp') beatenHard = true;
      }
    }
    return { id: personality.id, name: personality.name, title: personality.title, beaten: winsAgainst > 0, beatenHard, winsAgainst };
  });
}

/** Collector stamp card showing all 12 Switch computer legends and your progress beating them. */
export function LegendsCard({ games }: { games: readonly ComputerGame[] }) {
  const list = deriveLegends(games);
  const beatenCount = list.filter((item) => item.beaten).length;
  const hardCount = list.filter((item) => item.beatenHard).length;
  const next = list.find((item) => !item.beaten);

  return (
    <section className="legends-card" aria-labelledby="legends-title" data-testid="legends-card">
      <div className="legends-head">
        <div>
          <h3 id="legends-title">Beat the legends</h3>
          <p className="legends-sub">
            {beatenCount === list.length
              ? `All ${list.length} beaten${hardCount === list.length ? ' — every single one on Hard!' : ` · ${hardCount} on Hard`}`
              : `${beatenCount} of ${list.length} beaten${next ? ` · try ${next.name} next` : ''}`}
          </p>
        </div>
        <span className="legends-pill" aria-label={`${beatenCount} of ${list.length} legends beaten`}>
          {beatenCount}/{list.length}
        </span>
      </div>
      <ul className="legends-grid" aria-label="Computer legends stamp card">
        {list.map((legend) => (
          <li key={legend.id} className={legend.beatenHard ? 'hard' : legend.beaten ? 'beaten' : ''}>
            <span className="legend-mark" aria-hidden="true">
              {legend.beatenHard
                ? <Crown size={18} weight="fill" />
                : legend.beaten
                  ? <CheckCircle size={18} weight="fill" />
                  : <Sparkle size={16} weight="regular" />}
            </span>
            <strong>{legend.name}</strong>
            <small>{legend.beatenHard ? 'Beaten on Hard' : legend.beaten ? `${legend.winsAgainst} win${legend.winsAgainst === 1 ? '' : 's'}` : legend.title}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
