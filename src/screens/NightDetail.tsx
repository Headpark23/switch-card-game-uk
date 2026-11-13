import { useState } from 'react';
import { CalendarBlank, MapPin, Robot, Trophy, Users } from '@phosphor-icons/react';
import { BottomSheet } from '../mobile';
import type { ComputerGame } from '../switch/computerLog';
import type { SwitchNightRecord } from '../switch/history';
import { countryName } from '../switch/places';
import { resolveHistoryPlayerId, type LocalProfile } from '../switch/profiles';

const LEVEL_NAMES: Record<string, string> = { relaxed: 'Relaxed', standard: 'Standard', sharp: 'Sharp' };
const ordinal = (place: number) => `${place}${['st', 'nd', 'rd'][place - 1] ?? 'th'}`;
const longDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The full record of one game you played: when, where, who, and every score along the way. */
export default function NightDetail({ night, game, meId, profiles, onClose }: {
  night: SwitchNightRecord | null; game: ComputerGame | null; meId: string; profiles: readonly LocalProfile[]; onClose: () => void;
}) {
  // Kept after closing so the sheet does not go blank while it slides away.
  const [shown, setShown] = useState<{ night: SwitchNightRecord | null; game: ComputerGame | null }>({ night, game });
  if ((night && night !== shown.night) || (game && game !== shown.game)) setShown({ night, game });
  const open = Boolean(night || game);
  const title = shown.night ? shown.night.title : 'Against the computer';

  return <BottomSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={title} snap={0.85}>
    {shown.night && (() => {
      const record = shown.night;
      const mine = record.players.find((player) => resolveHistoryPlayerId(player, profiles) === meId);
      const won = !!mine && record.winnerIds.includes(mine.id);
      const winners = record.players.filter((player) => record.winnerIds.includes(player.id)).map((player) => player.name);
      return <div className="night-detail">
        {mine && <p className={'night-result ' + (won ? 'win' : 'loss')}>{won ? 'You won' : 'You lost'}</p>}
        <ul className="night-facts">
          <li><CalendarBlank size={17} weight="bold" /><span>{longDate(record.completedAt)}</span></li>
          <li><MapPin size={17} weight="bold" /><span>{record.place ? `${record.place.name}, ${countryName(record.place.country)}` : 'No venue recorded'}</span></li>
          <li><Trophy size={17} weight="bold" /><span>{record.formatLabel} · {winners.length ? `${winners.join(' and ')} won` : record.outcome}</span></li>
          <li><Users size={17} weight="bold" /><span>{record.players.map((player) => player.name).join(', ')}</span></li>
        </ul>
        {record.details.length > 0
          ? record.details.map((section, index) => <section key={index} className="night-section"><h4>{section.heading}</h4><ol>{section.lines.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ol></section>)
          : <p className="dash-note">This night was saved before full scores were kept, so only the result is known.</p>}
      </div>;
    })()}
    {!shown.night && shown.game && (() => {
      const record = shown.game;
      return <div className="night-detail">
        <p className={'night-result ' + (record.won ? 'win' : 'loss')}>{record.won ? 'You won' : `You finished ${ordinal(record.place)}`}</p>
        <ul className="night-facts">
          <li><CalendarBlank size={17} weight="bold" /><span>{longDate(record.playedAt)}</span></li>
          <li><Robot size={17} weight="bold" /><span>{record.opponents === 1 ? 'One computer player' : `${record.opponents} computer players`} · {LEVEL_NAMES[record.level]}</span></li>
          <li><Trophy size={17} weight="bold" /><span>Finished {ordinal(record.place)} of {record.opponents + 1} · {record.moves} moves</span></li>
        </ul>
        <p className="dash-note">Games against the computer count towards your record, streaks and badges.</p>
      </div>;
    })()}
  </BottomSheet>;
}
