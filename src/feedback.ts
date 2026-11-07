/** Short, layered game feedback made with Web Audio. No downloads, no delay, and play never depends on it. */
const KEY = 'switchFeedback';

export type Cue = 'play' | 'draw' | 'penalty' | 'last-card' | 'good' | 'bad' | 'win';

type CueProfile = { paper: number; notes: readonly number[]; noteLength: number; vibrate: number | number[]; volume?: number };

const PROFILES: Readonly<Record<Cue, CueProfile>> = Object.freeze({
  play: { paper: 1, notes: [620], noteLength: 0.045, vibrate: 10, volume: 0.035 },
  draw: { paper: 2, notes: [390], noteLength: 0.06, vibrate: 8, volume: 0.025 },
  penalty: { paper: 3, notes: [220, 174], noteLength: 0.11, vibrate: [30, 35, 55], volume: 0.055 },
  'last-card': { paper: 0, notes: [659, 880], noteLength: 0.095, vibrate: [12, 35, 18], volume: 0.06 },
  good: { paper: 0, notes: [523, 659], noteLength: 0.085, vibrate: [10, 28, 10], volume: 0.05 },
  bad: { paper: 0, notes: [247, 196], noteLength: 0.13, vibrate: 40, volume: 0.05 },
  win: { paper: 0, notes: [523, 659, 784, 1047], noteLength: 0.11, vibrate: [20, 35, 20, 35, 60], volume: 0.07 },
});

export function feedbackEnabled(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setFeedbackEnabled(on: boolean): void {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

let audio: AudioContext | null = null;

function paperSound(ctx: AudioContext, start: number, index: number): void {
  const duration = 0.052;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let sample = 0; sample < data.length; sample += 1) {
    const fade = 1 - sample / data.length;
    data[sample] = (Math.random() * 2 - 1) * fade * fade;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = 'highpass';
  filter.frequency.value = 900 + index * 170;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.09, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(start);
}

function note(ctx: AudioContext, frequency: number, start: number, duration: number, volume: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function cue(name: Cue): void {
  if (!feedbackEnabled() || typeof window === 'undefined') return;
  const profile = PROFILES[name];
  try { navigator.vibrate?.(profile.vibrate); } catch { /* not supported */ }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime + 0.005;
    for (let index = 0; index < profile.paper; index += 1) paperSound(ctx, now + index * 0.035, index);
    profile.notes.forEach((frequency, index) => {
      note(ctx, frequency, now + index * profile.noteLength * 0.72, profile.noteLength, profile.volume ?? 0.05);
    });
  } catch { /* feedback is optional; the game must remain playable without audio */ }
}
