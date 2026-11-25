import type { ReactNode } from 'react';
import type { StickerId } from '../switch/stats/reactions';
import { reactionOf } from '../switch/stats/reactions';

/* Our own card-character stickers, drawn in the app's cream, forest green, gold and card red. */
const CREAM = '#fffaf0';
const GREEN = '#053527';
const GOLD = '#c8961c';
const DEEP_GOLD = '#ac7b26';
const RED = '#b33426';
const SWEAT = '#7fc4d8';
const SUB_YELLOW = '#f4c430';
const MEANIE_BLUE = '#3d6fb8';
const RASTA_GREEN = '#2e8b4f';

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
  // The Beatles: a yellow submarine, porthole faces and all.
  'yellow-submarine': <>
    <path d="M30 12 V20 M30 12 H38" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    <rect x={26} y={18} width={14} height={8} rx={3} fill={SUB_YELLOW} stroke={GREEN} strokeWidth={2.2} />
    <ellipse cx={30} cy={36} rx={22} ry={13} fill={SUB_YELLOW} stroke={GREEN} strokeWidth={2.5} />
    <circle cx={21} cy={35} r={4} fill={CREAM} stroke={GREEN} strokeWidth={2} /><circle cx={32} cy={35} r={4} fill={CREAM} stroke={GREEN} strokeWidth={2} /><circle cx={43} cy={35} r={4} fill={CREAM} stroke={GREEN} strokeWidth={2} />
    <path d="M8 30 L3 24 L3 46 L8 40 Z" fill={SUB_YELLOW} stroke={GREEN} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M4 56 Q10 51 16 56 T28 56 T40 56 T52 56 T61 55" fill="none" stroke={MEANIE_BLUE} strokeWidth={3} strokeLinecap="round" />
  </>,
  // I am the walrus: goo goo g'joob.
  walrus: <>
    <ellipse cx={32} cy={32} rx={22} ry={20} fill="#b89572" stroke={GREEN} strokeWidth={2.5} />
    <circle cx={22} cy={25} r={6.5} fill={CREAM} stroke={GREEN} strokeWidth={2.2} /><circle cx={42} cy={25} r={6.5} fill={CREAM} stroke={GREEN} strokeWidth={2.2} /><path d="M28.5 25 H35.5" stroke={GREEN} strokeWidth={2.2} />
    <circle cx={23} cy={26} r={2} fill={GREEN} /><circle cx={41} cy={26} r={2} fill={GREEN} />
    <path d="M14 40 Q20 34 32 38 Q44 34 50 40 Q44 47 32 45 Q20 47 14 40 Z" fill="#5a4129" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
    <path d="M25 44 V58 M39 44 V58" stroke={CREAM} strokeWidth={5} strokeLinecap="round" /><path d="M25 44 V58 M39 44 V58" stroke={GREEN} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.6} />
  </>,
  // The Blue Meanie: grumpy, pointy and fanged.
  'blue-meanie': <>
    <path d="M14 22 L8 4 L24 14 Z M50 22 L56 4 L40 14 Z" fill={MEANIE_BLUE} stroke={GREEN} strokeWidth={2.2} strokeLinejoin="round" />
    <circle cx={32} cy={34} r={22} fill={MEANIE_BLUE} stroke={GREEN} strokeWidth={2.5} />
    <path d="M17 26 L28 31 M47 26 L36 31" stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
    <circle cx={24} cy={35} r={3.6} fill={CREAM} /><circle cx={40} cy={35} r={3.6} fill={CREAM} /><circle cx={25} cy={36} r={1.6} fill={GREEN} /><circle cx={39} cy={36} r={1.6} fill={GREEN} />
    <path d="M19 46 Q32 54 45 46 Q32 49 19 46 Z" fill={GREEN} stroke={GREEN} strokeWidth={1.5} strokeLinejoin="round" />
    <path d="M24 47 L26 51 L28 48 M36 48 L38 51 L40 47" fill={CREAM} stroke={CREAM} strokeWidth={1.5} strokeLinejoin="round" />
  </>,
  // Ziggy Stardust: the face with the lightning flash.
  'ziggy-bolt': <>
    <path d="M12 26 L8 14 L18 18 L20 6 L28 14 L34 4 L40 14 L48 8 L48 20 L56 22 L50 30 Z" fill={RED} stroke={GREEN} strokeWidth={2} strokeLinejoin="round" />
    <ellipse cx={32} cy={38} rx={17} ry={20} fill={CREAM} stroke={GREEN} strokeWidth={2.5} />
    <path d="M38 18 L26 36 H34 L25 56 L44 32 H35 L42 18 Z" fill={MEANIE_BLUE} stroke={RED} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={24} cy={36} r={2.2} fill={GREEN} /><path d="M24 48 Q31 52 38 47" fill="none" stroke={RED} strokeWidth={2.5} strokeLinecap="round" />
  </>,
  // I'm a Starman, waiting in the sky.
  starman: <>
    <path d="M32 6 L38.5 23 L56 24 L42 35 L47 53 L32 43 L17 53 L22 35 L8 24 L25.5 23 Z" fill={GOLD} stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" />
    <circle cx={26} cy={30} r={2} fill={GREEN} /><circle cx={38} cy={30} r={2} fill={GREEN} /><path d="M27 36 Q32 40 37 36" fill="none" stroke={GREEN} strokeWidth={2.2} strokeLinecap="round" />
    <path d="M4 10 H14 M2 16 H10 M54 52 H62 M50 58 H60" stroke={DEEP_GOLD} strokeWidth={2.5} strokeLinecap="round" />
  </>,
  // Major Tom, floating in a most peculiar way.
  'major-tom': <>
    <path d="M32 14 V6" stroke={GREEN} strokeWidth={2.5} strokeLinecap="round" /><circle cx={32} cy={5} r={3} fill={RED} stroke={GREEN} strokeWidth={1.5} />
    <circle cx={32} cy={34} r={22} fill={CREAM} stroke={GREEN} strokeWidth={2.5} />
    <rect x={15} y={22} width={34} height={24} rx={11} fill={GREEN} />
    <path d="M22 28 Q26 25 31 26" fill="none" stroke={CREAM} strokeWidth={2.2} strokeLinecap="round" opacity={0.75} />
    <path d="M40 40 L41.5 36 L43 40 L47 41.5 L43 43 L41.5 47 L40 43 L36 41.5 Z" fill={GOLD} />
    <path d="M12 52 H52" stroke={DEEP_GOLD} strokeWidth={3} strokeLinecap="round" /><circle cx={20} cy={58} r={1.6} fill={DEEP_GOLD} /><circle cx={44} cy={58} r={1.6} fill={DEEP_GOLD} />
  </>,
  // The Lion of Judah, mane and all.
  lion: <>
    <circle cx={32} cy={33} r={27} fill={DEEP_GOLD} stroke={GREEN} strokeWidth={2.5} />
    <path d="M32 8 L36 14 L42 10 L43 17 L50 16 L47 23 L55 26 L48 31 L55 37 L47 40 L50 48 L42 47 L40 54 L34 49 L30 56 L26 49 L20 54 L18 47 L10 48 L14 40 L8 36 L14 30 L9 25 L17 23 L14 16 L22 17 L23 10 L28 14 Z" fill={GOLD} stroke={GREEN} strokeWidth={1.8} strokeLinejoin="round" />
    <circle cx={32} cy={36} r={16} fill="#f6d98a" stroke={GREEN} strokeWidth={2.2} />
    <circle cx={26} cy={32} r={2.2} fill={GREEN} /><circle cx={38} cy={32} r={2.2} fill={GREEN} />
    <path d="M29 38 H35 L32 42 Z" fill={GREEN} stroke={GREEN} strokeWidth={1.5} strokeLinejoin="round" /><path d="M32 42 Q28 47 24 44 M32 42 Q36 47 40 44" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" />
  </>,
  // One love: a heart in red, gold and green.
  'one-love': <>
    <clipPath id="one-love-heart"><path d="M32 56 Q6 38 8 22 Q10 10 21 10 Q29 10 32 18 Q35 10 43 10 Q54 10 56 22 Q58 38 32 56 Z" /></clipPath>
    <g clipPath="url(#one-love-heart)"><rect x={0} y={0} width={64} height={26} fill={RED} /><rect x={0} y={26} width={64} height={14} fill={GOLD} /><rect x={0} y={40} width={64} height={24} fill={RASTA_GREEN} /></g>
    <path d="M32 56 Q6 38 8 22 Q10 10 21 10 Q29 10 32 18 Q35 10 43 10 Q54 10 56 22 Q58 38 32 56 Z" fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" />
    <path d="M32 24 L33.8 29 L39 29 L34.8 32 L36.4 37 L32 34 L27.6 37 L29.2 32 L25 29 L30.2 29 Z" fill={GREEN} />
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
