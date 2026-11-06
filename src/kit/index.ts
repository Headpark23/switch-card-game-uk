/**
 * Companion-app kit: the parts of Switch that are not about Switch.
 * Start a new card or board game app by keeping this folder's exports and replacing the game content.
 * See docs/REUSE-GUIDE.md.
 */
export { cue, feedbackEnabled, setFeedbackEnabled, type Cue } from '../feedback';
export { default as InstallButton } from '../InstallButton';
export { ShareButton } from '../ShareButton';
export { enableOffline } from '../offline';
export { CoachPanel } from '../ui';
export type { Lesson } from '../switch/lessons';
export type { CoachOption } from '../switch/coach';
export { badgeFor, loadProgress, saveProgress, recordResult, type PuzzleProgress } from '../switch/puzzles';
export { default as RealCards } from '../screens/RealCards';
export { default as QuickNight } from '../screens/QuickNight';
