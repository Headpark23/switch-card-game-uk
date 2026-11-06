/** Tiny sound and haptic cues. Game-agnostic: no assets, just short synthesised tones. Off-switch is remembered. */
const KEY = 'switchFeedback';

export type Cue = 'play' | 'draw' | 'good' | 'bad' | 'win';

export function feedbackEnabled(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setFeedbackEnabled(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

let audio: AudioContext | null = null;
const TONES: Record<Cue, { freq: number[]; dur: number; vibrate: number | number[] }> = {
  play: { freq: [520], dur: 0.07, vibrate: 12 },
  draw: { freq: [330], dur: 0.08, vibrate: 8 },
  good: { freq: [523, 659], dur: 0.09, vibrate: [10, 30, 10] },
  bad: { freq: [196], dur: 0.16, vibrate: 40 },
  win: { freq: [523, 659, 784, 1047], dur: 0.12, vibrate: [20, 40, 20, 40, 60] },
};

export function cue(name: Cue): void {
  if (!feedbackEnabled() || typeof window === 'undefined') return;
  const tone = TONES[name];
  try { navigator.vibrate?.(tone.vibrate); } catch { /* not supported */ }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    if (ctx.state === 'suspended') void ctx.resume();
    tone.freq.forEach((freq, index) => {
      const start = ctx.currentTime + index * tone.dur;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + tone.dur + 0.02);
    });
  } catch { /* audio is a nicety, never a requirement */ }
}
