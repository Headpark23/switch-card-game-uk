import { expect, test } from "@playwright/test";

test("card actions and big moments have distinct layered feedback", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const starts: Array<{ type: string; at: number }> = [];
    const vibrations: Array<number | number[]> = [];
    let paperBursts = 0;

    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern: number | number[]) => { vibrations.push(pattern); return true; } });

    class FakeAudioContext {
      currentTime = 1;
      state = "running";
      destination = {};
      sampleRate = 44_100;
      resume() { return Promise.resolve(); }
      createOscillator() {
        return {
          type: "sine",
          frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() { return this; },
          start(at: number) { starts.push({ type: "tone", at }); },
          stop() {},
        };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return this; } };
      }
      createBuffer(_channels: number, length: number) {
        return { getChannelData: () => new Float32Array(length) };
      }
      createBufferSource() {
        return { buffer: null, connect() { return this; }, start(at: number) { paperBursts += 1; starts.push({ type: "paper", at }); } };
      }
      createBiquadFilter() {
        return { type: "highpass", frequency: { value: 0 }, connect() { return this; } };
      }
    }

    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    localStorage.setItem("switchFeedback", "on");
    const feedback = await import("/src/feedback.ts");

    feedback.cue("play");
    const afterPlay = { paperBursts, tones: starts.filter((entry) => entry.type === "tone").length, vibration: vibrations.at(-1) };
    feedback.cue("draw");
    const afterDraw = { addedPaperBursts: paperBursts - afterPlay.paperBursts, vibration: vibrations.at(-1) };
    feedback.cue("last-card");
    const afterLastCard = { tones: starts.filter((entry) => entry.type === "tone").length - afterPlay.tones, vibration: vibrations.at(-1) };
    feedback.cue("win");
    const totalTones = starts.filter((entry) => entry.type === "tone").length;

    return { afterPlay, afterDraw, afterLastCard, totalTones, finalVibration: vibrations.at(-1) };
  });

  expect(result.afterPlay.paperBursts).toBeGreaterThanOrEqual(1);
  expect(result.afterDraw.addedPaperBursts).toBeGreaterThanOrEqual(2);
  expect(result.afterDraw.vibration).not.toEqual(result.afterPlay.vibration);
  expect(result.afterLastCard.tones).toBeGreaterThanOrEqual(2);
  expect(Array.isArray(result.afterLastCard.vibration)).toBe(true);
  expect(result.totalTones).toBeGreaterThanOrEqual(6);
  expect(Array.isArray(result.finalVibration)).toBe(true);
});
