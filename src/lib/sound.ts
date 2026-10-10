let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ignore */
  }
}

export function beep(times = 3) {
  try {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = i === times - 1 ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * 0.22);
      o.stop(t0 + i * 0.22 + 0.2);
    }
  } catch {
    /* ignore */
  }
}
