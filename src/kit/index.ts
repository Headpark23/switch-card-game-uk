/**
 * Companion-app kit: the parts of Switch that are not about Switch.
 * Start a new card or board game app by keeping this folder's exports and replacing the game content.
 * See docs/REUSE-GUIDE.md.
 */
export { cue, feedbackEnabled, setFeedbackEnabled, type Cue } from '../services/feedback';
export { default as InstallButton } from '../components/InstallButton';
export { ShareButton } from '../components/ShareButton';
export { enableOffline } from '../services/offline';
export { CoachPanel } from '../components/ui';
export type { Lesson } from '../switch/ai/lessons';
export type { CoachOption } from '../switch/ai/coach';
export { badgeFor, loadProgress, saveProgress, recordResult, type PuzzleProgress } from '../switch/ai/puzzles';
export { default as RealCards } from '../components/RealCards';
export { default as QuickNight } from '../screens/QuickNight';
