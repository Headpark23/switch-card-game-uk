import { useEffect, useState } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { FeltHeader } from '../components/ui';
import { useKeyboard } from '../mobile';
import { getClubName } from '../switch/store/club';
import { CLUB_WRITTEN, readClub, updateClub } from '../switch/store/clubStore';
import { CLUB_REFRESH } from '../switch/sync/clubSync';
import { SCOREKEEPER_STORAGE_KEY } from '../switch/store/storage';
import ClubhouseStats from './ClubhouseStats';
import ClubhouseLeagues from './ClubhouseLeagues';
import TrophyRoom from './TrophyRoom';
import NightHistory from './NightHistory';

export type ClubTabView = 'stats' | 'leagues' | 'trophies' | 'history';

const CLUB_TABS: readonly (readonly [ClubTabView, string])[] = [
  ['stats', 'Stats'],
  ['leagues', 'Seasons'],
  ['trophies', 'Trophies'],
  ['history', 'History'],
];

type Props = {
  onBack: () => void;
  backLabel?: string;
  initialView?: ClubTabView;
  onView?: (view: ClubTabView) => void;
  startMode?: 'share' | 'join';
};

/** CLUB: your club's stats, seasons, trophies, and saved game-night history. */
export default function ClubScreen({ onBack, backLabel = 'Home', initialView = 'stats', onView, startMode }: Props) {
  const keyboard = useKeyboard();
  const [extensions, setExtensions] = useState<Record<string, unknown>>(() => readClub());
  const [view, setView] = useState<ClubTabView>(initialView);

  useEffect(() => { setView(initialView); }, [initialView]);

  useEffect(() => {
    const refresh = () => {
      try { setExtensions(readClub()); } catch { /* storage unavailable */ }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SCOREKEEPER_STORAGE_KEY) refresh();
    };
    window.addEventListener(CLUB_WRITTEN, refresh);
    window.addEventListener(CLUB_REFRESH, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CLUB_WRITTEN, refresh);
      window.removeEventListener(CLUB_REFRESH, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const persistExtensions = (next: Record<string, unknown>) => {
    setExtensions(updateClub(() => next));
  };

  return (
    <section className="scorekeeper" aria-labelledby="scorekeeper-title">
      <div className="scorekeeper-head compact">
        <button className="text-link back-link" aria-label={`Back to ${backLabel}`} onClick={onBack}>
          <CaretLeft size={15} weight="bold" />{backLabel}
        </button>
        <FeltHeader
          compact
          id="scorekeeper-title"
          title={getClubName(extensions) || 'Your club'}
          intro="Stats, seasons, trophies and every night you have saved."
          cards={['QS', 'KD']}
        />
      </div>

      <div className="club-tabs tabs-club" aria-label="Club sections">
        {CLUB_TABS.map(([id, label]) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            aria-pressed={view === id}
            onClick={() => { keyboard.hide(); setView(id); onView?.(id); }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'stats' && <ClubhouseStats extensions={extensions} onChange={persistExtensions} startMode={startMode} />}
      {view === 'leagues' && <ClubhouseLeagues extensions={extensions} onChange={persistExtensions} />}
      {view === 'trophies' && <TrophyRoom extensions={extensions} onChange={persistExtensions} />}
      {view === 'history' && <NightHistory extensions={extensions} onChange={persistExtensions} startMode={startMode} />}
    </section>
  );
}
