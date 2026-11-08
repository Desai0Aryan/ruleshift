/** Tiny WebAudio synth so the web preview has real feedback sounds without any asset files. */
let ac: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    if (!ac) ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slide = 0, delay = 0) {
  const a = ctx(); if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export const sfx = {
  tick: (k = 1, v = 0.06) => tone(520 * k, 0.06, 'triangle', v),
  whoosh: () => tone(180, 0.25, 'sawtooth', 0.04, 500),
  pop: (p: number) => tone(260 + p * 380, 0.09, 'sine', 0.05 + p * 0.06, -80),
  boing: () => tone(300, 0.2, 'square', 0.05, 380),
  portal: () => tone(900, 0.22, 'sine', 0.05, -600),
  ding: () => tone(1100, 0.2, 'sine', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, 0, i * 0.09)),
  lose: () => tone(220, 0.28, 'sawtooth', 0.05, -120),
};
