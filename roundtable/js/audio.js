/** Short Web Audio voices. No sample assets. Gain stays low and muted by the settings toggle. */

const VOICES = {
  openai: { wave: 'triangle', notes: [392], ms: 110 },
  anthropic: { wave: 'sine', notes: [523.25], ms: 130 },
  google: { wave: 'sine', notes: [659.25, 784], ms: 80 },
  meta: { wave: 'triangle', notes: [349.23], ms: 150 },
  deepseek: { wave: 'sine', notes: [293.66, 349.23], ms: 80 },
  arbiter: { wave: 'sine', notes: [440, 554.37], ms: 100 },
  human: { wave: 'sine', notes: [246.94], ms: 60 },
};

const CUES = {
  approve: { wave: 'sine', notes: [523.25, 659.25, 783.99], ms: 90 },
  dock: { wave: 'sine', notes: [494, 370], ms: 80 },
  undock: { wave: 'sine', notes: [370, 494], ms: 80 },
  enable: { wave: 'triangle', notes: [587.33], ms: 70 },
  send: { wave: 'sine', notes: [698.46], ms: 50 },
};

const STORAGE_KEY = 'round-table:sound';

export function createAudio() {
  let context = null;
  let enabled = true;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    enabled = true;
  }

  function ctx() {
    if (!context) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { context = new Ctor(); } catch { return null; }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function play(spec) {
    if (!enabled || !spec) return;
    const audio = ctx();
    if (!audio) return;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.connect(audio.destination);
    const start = audio.currentTime + 0.01;
    spec.notes.forEach((freq, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = spec.wave;
      osc.frequency.value = freq;
      const at = start + index * (spec.ms / 1000 + 0.02);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.035, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + spec.ms / 1000);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(at);
      osc.stop(at + spec.ms / 1000 + 0.02);
    });
  }

  return {
    unlock() { ctx(); },
    enabled() { return enabled; },
    setEnabled(next) {
      enabled = Boolean(next);
      try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* private mode */ }
    },
    voice(providerId) { play(VOICES[providerId] || VOICES.human); },
    cue(name) { play(CUES[name]); },
  };
}
