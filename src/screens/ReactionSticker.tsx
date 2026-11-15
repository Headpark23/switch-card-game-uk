import type { ReactNode } from 'react';
import type { StickerId } from '../switch/reactions';
import { reactionOf } from '../switch/reactions';

/* Our own card-character stickers, drawn in the app's cream, forest green, gold and card red. */
const CREAM = '#fffaf0';
const GREEN = '#053527';
const GOLD = '#c8961c';
const DEEP_GOLD = '#ac7b26';
const RED = '#b33426';
const SWEAT = '#7fc4d8';

/** A playing card body to hang a face on. */
const Card = ({ x = 14, y = 10, w = 36, h = 48, tilt = 0 }: { x?: number; y?: number; w?: number; h?: number; tilt?: number }) =>
  <rect x={x} y={y} width={w} height={h} rx={6} fill={CREAM} stroke={GREEN} strokeWidth={2.5} transform={tilt ? `rotate(${tilt} ${x + w / 2} ${y + h / 2})` : undefined} />;

const ART: Record<StickerId, ReactNode> = {
  // The king in shades: too easy.
  'smug-king': <>
    <Card y={14} h={44} />
    <path d="M17 18 L21 6 L27 13 L32 4 L37 13 L43 6 L47 18 Z" fill={GOLD} stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={32} cy={8} r={2} fill={RED} />
    <rect x={19} y={28} width={11} height={7} rx={3} fill={GREEN} /><rect x={34} y={28} width={11} height={7} rx={3} fill={GREEN} />
    <path d="M30 30 H34" stroke={GREEN} strokeWidth={2} />
    <path d="M24 44 Q33 48 41 41" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
    <text x={18} y={55} fontSize={8} fontWeight={800} fill={RED} fontFamily="Georgia,serif">K</text>
  </>,
  // A grumpy salt shaker, still shaking.
  salty: <>
    <path d="M20 26 Q20 20 26 20 H38 Q44 20 44 26 V54 Q44 58 40 58 H24 Q20 58 20 54 Z" fill={CREAM} stroke={GREEN} strokeWidth={2.5} />
    <path d="M22 20 Q22 10 32 10 Q42 10 42 20 Z" fill={GREEN} />
    <circle cx={28} cy={15} r={1.4} fill={CREAM} /><circle cx={32} cy={13} r={1.4} fill={CREAM} /><circle cx={36} cy={15} r={1.4} fill={CREAM} />
    <path d="M24 33 L30 36 M40 33 L34 36" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
    <circle cx={28} cy={39} r={2} fill={GREEN} /><circle cx={36} cy={39} r={2} fill={GREEN} />
    <path d="M27 49 Q32 45 37 49" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
    <rect x={9} y={8} width={3} height={3} fill={DEEP_GOLD} transform="rotate(20 10 9)" /><rect x={52} y={6} width={3} height={3} fill={DEEP_GOLD} transform="rotate(-15 53 7)" /><rect x={50} y={15} width={2.5} height={2.5} fill={DEEP_GOLD} /><rect x={12} y={16} width={2.5} height={2.5} fill={DEEP_GOLD} />
  </>,
  // A fin circling the table, with an ace up its sleeve.
  'card-shark': <>
    <rect x={34} y={10} width={20} height={27} rx={4} fill={CREAM} stroke={GREEN} strokeWidth={2} transform="rotate(14 44 23)" />
    <text x={40} y={28} fontSize={12} fontWeight={800} fill={GREEN} fontFamily="Georgia,serif" transform="rotate(14 44 23)">A♠</text>
    <path d="M10 46 Q22 14 40 40 Q30 40 24 46 Z" fill={GREEN} />
    <path d="M24 30 Q28 31 30 35" fill="none" stroke={CREAM} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
    <path d="M4 48 Q10 43 16 48 T28 48 T40 48 T52 48 T62 47" fill="none" stroke={DEEP_GOLD} strokeWidth={3} strokeLinecap="round" />
    <path d="M10 56 Q16 51 22 56 T34 56 T46 56 T56 55" fill="none" stroke={DEEP_GOLD} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
  </>,
  // The ace, sweating it out.
  'sweating-ace': <>
    <Card tilt={-6} />
    <text x={18} y={23} fontSize={10} fontWeight={800} fill={GREEN} fontFamily="Georgia,serif" transform="rotate(-6 32 34)">A</text>
    <circle cx={26} cy={33} r={3.4} fill={CREAM} stroke={GREEN} strokeWidth={2} /><circle cx={38} cy={32} r={3.4} fill={CREAM} stroke={GREEN} strokeWidth={2} />
    <circle cx={26.5} cy={34} r={1.5} fill={GREEN} /><circle cx={38.5} cy={33} r={1.5} fill={GREEN} />
    <path d="M25 46 Q28 43 31 46 Q34 49 37 45" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
    <path d="M49 12 Q55 21 52 25 Q48 28 46 23 Q45 19 49 12 Z" fill={SWEAT} stroke={GREEN} strokeWidth={1.5} />
    <path d="M10 26 Q13 31 11 33 Q8 34 8 31 Q8 29 10 26 Z" fill={SWEAT} stroke={GREEN} strokeWidth={1.2} />
  </>,
  // Said everything there is to say.
  'mic-drop': <>
    <g transform="rotate(-32 32 34)">
      <rect x={28} y={26} width={8} height={30} rx={3} fill={GREEN} />
      <circle cx={32} cy={20} r={10} fill={GOLD} stroke={GREEN} strokeWidth={2.5} />
      <path d="M24 17 H40 M23 22 H41" stroke={GREEN} strokeWidth={1.5} opacity={0.55} />
    </g>
    <path d="M47 8 V14 M44 11 H50" stroke={DEEP_GOLD} strokeWidth={2.5} strokeLinecap="round" />
    <path d="M54 22 V26 M52 24 H56" stroke={DEEP_GOLD} strokeWidth={2} strokeLinecap="round" />
    <path d="M8 44 H16 M6 50 H14 M10 56 H18" stroke={RED} strokeWidth={2.5} strokeLinecap="round" />
  </>,
  // The jack who cannot believe what he just saw.
  'facepalm-jack': <>
    <Card />
    <text x={18} y={21} fontSize={9} fontWeight={800} fill={RED} fontFamily="Georgia,serif">J</text>
    <path d="M22 12 Q32 2 42 12" fill={RED} stroke={GREEN} strokeWidth={2} />
    <path d="M24 41 Q32 38 40 41" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
    <path d="M20 22 Q18 34 26 36 Q34 38 44 33 Q48 30 44 24 L40 18 Q38 16 36 19 L35 15 Q33 13 31 16 L30 13 Q28 11 26 14 L25 17 Q22 15 20 22 Z" fill="#f2d3a7" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
    <path d="M30 18 L32 27 M35 18 L36 26" stroke={GREEN} strokeWidth={1.4} opacity={0.6} />
  </>,
  // The joker, in floods.
  'crying-joker': <>
    <circle cx={32} cy={38} r={16} fill={CREAM} stroke={GREEN} strokeWidth={2.5} />
    <path d="M16 32 L10 10 L24 24 L32 6 L40 24 L54 10 L48 32 Z" fill={RED} stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
    <path d="M24 24 L32 6 L40 24 Z" fill={GREEN} />
    <circle cx={10} cy={10} r={3} fill={GOLD} /><circle cx={32} cy={6} r={3} fill={GOLD} /><circle cx={54} cy={10} r={3} fill={GOLD} />
    <path d="M24 38 Q26 35 28 38 M36 38 Q38 35 40 38" fill="none" stroke={GREEN} strokeWidth={2.2} strokeLinecap="round" />
    <path d="M26 48 Q32 43 38 48" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" />
    <path d="M25 40 Q23 48 26 56" fill="none" stroke={SWEAT} strokeWidth={3} strokeLinecap="round" />
    <path d="M39 40 Q41 48 38 56" fill="none" stroke={SWEAT} strokeWidth={3} strokeLinecap="round" />
  </>,
  // A seven that cannot be stopped.
  'seven-on-fire': <>
    <path d="M14 56 Q6 40 16 26 Q16 36 22 36 Q18 22 30 8 Q30 22 38 24 Q40 16 46 14 Q42 26 50 32 Q56 42 50 56 Z" fill={RED} />
    <path d="M20 56 Q15 46 22 38 Q24 44 28 44 Q26 34 34 26 Q34 36 42 40 Q48 46 44 56 Z" fill={GOLD} />
    <rect x={21} y={30} width={22} height={28} rx={4} fill={CREAM} stroke={GREEN} strokeWidth={2.5} />
    <text x={32} y={52} textAnchor="middle" fontSize={21} fontWeight={800} fill={RED} fontFamily="Georgia,serif">7</text>
  </>,
};

/** One of our stickers. It is decoration; say what it means in text beside it. */
export function Sticker({ id, size = 44 }: { id: StickerId; size?: number }) {
  return <svg className="reaction-sticker" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">{ART[id]}</svg>;
}

/** How a reaction shows up beside a seat or in a list: a sticker, or the saying in a speech bubble's words. */
export function ReactionFace({ id, size = 40 }: { id: string; size?: number }) {
  const reaction = reactionOf(id);
  if (!reaction) return null;
  return reaction.sticker ? <Sticker id={reaction.sticker} size={size} /> : <span className="reaction-saying">{reaction.text}</span>;
}
