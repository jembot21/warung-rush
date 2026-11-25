// A silent, safe no-op until unlockAudio() is called by a real gesture.
export let muted = false;
let context = null;
let master = null;
let noiseBuffer = null;
let loopsPaused = false;
const wantedSizzles = new Set();
const sizzles = new Map();

export function unlockAudio() {
  try {
    if (!context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') {
      const resumed = context.resume();
      if (resumed && resumed.catch) resumed.catch(() => {});
    }
    syncSizzles();
  } catch {
    // Cooking still works when WebAudio is unavailable or denied.
  }
}

function audible() {
  return context && master && context.state === 'running' && !muted;
}

function tone(frequency, duration = 0.1, type = 'sine', volume = 0.16, delay = 0, end = frequency) {
  if (!audible()) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.015);
}

export function chop() {
  tone(170, 0.065, 'triangle', 0.24, 0, 55);
  tone(140, 0.05, 'triangle', 0.17, 0.09, 45);
}
export function pickup() { tone(400, 0.09, 'sine', 0.14, 0, 700); }
export function place() { tone(280, 0.07, 'triangle', 0.13, 0, 140); }
export function ding() {
  tone(1047, 0.35, 'sine', 0.15);
  tone(1568, 0.22, 'sine', 0.065, 0.04);
}
export function orderArrival() {
  tone(260, 0.045, 'triangle', 0.035, 0, 140);
  tone(880, 0.19, 'sine', 0.065, 0.025, 1047);
}
export function ready() {
  tone(784, 0.13, 'sine', 0.065);
  tone(1047, 0.16, 'sine', 0.045, 0.065);
}
export function serve(tipSize = 0) {
  const generosity = Math.max(0, Math.min(1, tipSize));
  const notes = [659, 784, 988, 1175, 1568].slice(0, 3 + Math.round(generosity * 2));
  notes.forEach((frequency, index) => {
    tone(frequency, 0.14 + index * 0.025, 'sine',
      (0.09 + generosity * 0.035) * (0.7 + index * 0.15), index * 0.06);
  });
}
export function expire() {
  tone(95, 0.3, 'sawtooth', 0.075, 0, 55);
  tone(75, 0.2, 'triangle', 0.1, 0.12, 45);
}
export function click() { tone(600, 0.045, 'triangle', 0.08, 0, 350); }
export function dayComplete() {
  [523, 659, 784, 1047, 784, 1047].forEach((frequency, index) => {
    tone(frequency, index === 5 ? 0.5 : 0.18, 'triangle', 0.13, index * 0.14);
  });
}

function stopLoop(key) {
  const loop = sizzles.get(key);
  if (!loop) return;
  loop.source.stop();
  loop.source.disconnect();
  loop.filter.disconnect();
  loop.gain.disconnect();
  sizzles.delete(key);
}

function syncSizzles() {
  for (const key of sizzles.keys()) {
    if (!audible() || loopsPaused || !wantedSizzles.has(key)) stopLoop(key);
  }
  if (!audible() || loopsPaused) return;
  for (const key of wantedSizzles) {
    if (sizzles.has(key)) continue;
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = key === 'grill' ? 1300 : 2100;
    gain.gain.value = key === 'grill' ? 0.035 : 0.045;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    sizzles.set(key, { source, filter, gain });
  }
}

export function setSizzle(station, cooking) {
  if (station !== 'wok' && station !== 'grill') return;
  if (cooking) wantedSizzles.add(station);
  else wantedSizzles.delete(station);
  syncSizzles();
}

export function pauseSizzles(paused) {
  loopsPaused = paused;
  syncSizzles();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  syncSizzles();
  return muted;
}
