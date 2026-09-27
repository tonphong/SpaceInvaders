// Procedural synthwave soundtrack: a lookahead step sequencer driving Web Audio synth voices.
// Everything plays into the music bus from audio.js, so it follows the music volume and SFX ducking.
import { getAudio, onAudioReady } from './audio.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 8-bar progression in A minor: Am F C G | Am F G E
const BARS = [
  { root: 45, pad: [57, 60, 64] },
  { root: 41, pad: [57, 60, 65] },
  { root: 48, pad: [55, 60, 64] },
  { root: 43, pad: [55, 59, 62] },
  { root: 45, pad: [57, 60, 64] },
  { root: 41, pad: [57, 60, 65] },
  { root: 43, pad: [55, 59, 62] },
  { root: 40, pad: [56, 59, 64] },
];

// Lead melody: [16th step within the 8-bar phrase, midi note, length in steps]
const MELODY = [
  [0, 76, 4], [4, 81, 2], [6, 79, 2], [8, 76, 4], [12, 74, 2], [14, 72, 2],
  [16, 72, 4], [20, 69, 2], [22, 72, 2], [24, 77, 6], [30, 76, 2],
  [32, 76, 4], [36, 79, 2], [38, 76, 2], [40, 72, 4], [44, 74, 2], [46, 76, 2],
  [48, 74, 6], [54, 71, 2], [56, 74, 4], [60, 79, 4],
  [64, 81, 4], [68, 79, 2], [70, 76, 2], [72, 81, 4], [76, 79, 4],
  [80, 77, 4], [84, 76, 2], [86, 72, 2], [88, 69, 8],
  [96, 71, 4], [100, 74, 2], [102, 79, 2], [104, 77, 4], [108, 74, 4],
  [112, 76, 8], [120, 71, 4], [124, 76, 4],
];
const MELODY_AT = new Map(MELODY.map(([s, n, l]) => [s, [n, l]]));
const ARP = [0, 1, 2, 3, 4, 5, 4, 3];

const TRACKS = {
  menu: { bpm: 92, arp: 2, bass: 'long', drums: false, lead: false, padLevel: 1 },
  game: { bpm: 118, arp: 1, bass: 'drive', drums: true, lead: true, padLevel: 0.75 },
};

let out = null;
let trackGain = null;
let delaySend = null;
let delayNode = null;
let track = null;
let pending = 'menu';
let step = 0;
let nextTime = 0;
let intensity = 0;
let paused = false;
let timer = null;

function build(ac, musicIn) {
  out = ac.createGain();
  out.connect(musicIn);
  trackGain = ac.createGain();
  trackGain.gain.value = 0;
  trackGain.connect(out);
  const delay = ac.createDelay(1);
  const fb = ac.createGain();
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2400;
  fb.gain.value = 0.3;
  delaySend = ac.createGain();
  delaySend.gain.value = 0.35;
  delaySend.connect(delay);
  delay.connect(tone);
  tone.connect(fb);
  fb.connect(delay);
  tone.connect(trackGain);
  delayNode = delay;
}

function env(g, t, peak, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return t + attack + hold + release + 0.05;
}

function pad(ac, t, notes, dur, level) {
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 900 + intensity * 500;
  flt.Q.value = 0.6;
  const g = ac.createGain();
  flt.connect(g);
  g.connect(trackGain);
  const end = env(g, t, 0.05 * level, 0.35, Math.max(0.05, dur - 0.55), 0.6);
  for (const n of notes) {
    for (const cents of [-7, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(n);
      o.detune.value = cents;
      o.connect(flt);
      o.start(t);
      o.stop(end);
    }
  }
}

function bass(ac, t, midi, dur) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = mtof(midi);
  const sub = ac.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = mtof(midi - 12);
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.Q.value = 4;
  flt.frequency.setValueAtTime(260, t);
  flt.frequency.exponentialRampToValueAtTime(900 + intensity * 700, t + 0.02);
  flt.frequency.exponentialRampToValueAtTime(240, t + Math.min(dur, 0.25));
  const g = ac.createGain();
  o.connect(flt);
  sub.connect(g);
  flt.connect(g);
  g.connect(trackGain);
  const end = env(g, t, 0.11, 0.005, dur * 0.6, dur * 0.4);
  o.start(t); sub.start(t);
  o.stop(end); sub.stop(end);
}

function arp(ac, t, midi, dur) {
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.value = mtof(midi);
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 1100 + intensity * 2600;
  const g = ac.createGain();
  o.connect(flt);
  flt.connect(g);
  g.connect(trackGain);
  g.connect(delaySend);
  const end = env(g, t, 0.028, 0.004, dur * 0.3, dur * 0.6);
  o.start(t);
  o.stop(end);
}

function lead(ac, t, midi, dur) {
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.value = mtof(midi);
  const o2 = ac.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = mtof(midi);
  o2.detune.value = 8;
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain);
  lfoGain.connect(o.detune);
  lfoGain.connect(o2.detune);
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = 2200;
  const mix = ac.createGain();
  mix.gain.value = 0.35;
  o2.connect(mix);
  mix.connect(flt);
  o.connect(flt);
  const g = ac.createGain();
  flt.connect(g);
  g.connect(trackGain);
  g.connect(delaySend);
  const end = env(g, t, 0.05, 0.02, dur * 0.7, dur * 0.5);
  for (const osc of [o, o2, lfo]) { osc.start(t); osc.stop(end); }
}

function kick(ac, t) {
  const o = ac.createOscillator();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ac.createGain();
  o.connect(g);
  g.connect(trackGain);
  o.start(t);
  o.stop(env(g, t, 0.32, 0.002, 0.02, 0.24));
}

function noiseHit(ac, t, type, freq, peak, len, send = false) {
  const { noiseBuf } = getAudio();
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const flt = ac.createBiquadFilter();
  flt.type = type;
  flt.frequency.value = freq;
  const g = ac.createGain();
  src.connect(flt);
  flt.connect(g);
  g.connect(trackGain);
  if (send) g.connect(delaySend);
  src.start(t, Math.random() * 0.5);
  src.stop(env(g, t, peak, 0.002, 0.01, len));
}

function snare(ac, t) {
  noiseHit(ac, t, 'bandpass', 1900, 0.13, 0.16, true);
  const o = ac.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  const g = ac.createGain();
  o.connect(g);
  g.connect(trackGain);
  o.start(t);
  o.stop(env(g, t, 0.07, 0.002, 0.01, 0.09));
}

function scheduleStep(ac, s, t) {
  const cfg = TRACKS[track];
  const stepDur = 60 / cfg.bpm / 4;
  const inBar = s % 16;
  const barIdx = Math.floor(s / 16) % BARS.length;
  const bar = BARS[barIdx];
  const phraseStep = s % 128;
  const leadPhrase = Math.floor(s / 128) % 2 === 1;

  if (inBar === 0) pad(ac, t, bar.pad, stepDur * 16, cfg.padLevel);

  if (cfg.bass === 'drive') {
    if (s % 2 === 0) bass(ac, t, bar.root + (inBar === 6 || inBar === 14 ? 12 : 0), stepDur * 1.8);
  } else if (inBar === 0 || inBar === 8) {
    bass(ac, t, bar.root, stepDur * 7.5);
  }

  if (s % cfg.arp === 0) {
    const tones = [...bar.pad, ...bar.pad.map((n) => n + 12)];
    const idx = ARP[(s / cfg.arp) % ARP.length];
    arp(ac, t, tones[idx] + 12, stepDur * cfg.arp);
  }

  if (cfg.drums) {
    const kicks = intensity > 0.55 ? [0, 6, 8, 10] : [0, 8];
    if (kicks.includes(inBar)) kick(ac, t);
    if (inBar === 4 || inBar === 12) snare(ac, t);
    if (barIdx === 7 && inBar >= 13) snare(ac, t);
    const hatEvery = intensity > 0.45 ? 1 : 2;
    if (s % hatEvery === 0) noiseHit(ac, t, 'highpass', 7500, inBar % 4 === 2 ? 0.05 : 0.028, inBar === 14 ? 0.18 : 0.035);
  }

  if (cfg.lead && leadPhrase) {
    const note = MELODY_AT.get(phraseStep);
    if (note) lead(ac, t, note[0], note[1] * stepDur);
  }
}

function tick() {
  const a = getAudio();
  if (!a || a.ac.state !== 'running' || !track) return;
  const { ac } = a;
  if (nextTime < ac.currentTime - 0.25) nextTime = ac.currentTime + 0.05;
  const stepDur = 60 / TRACKS[track].bpm / 4;
  while (nextTime < ac.currentTime + 0.12) {
    scheduleStep(ac, step, nextTime);
    nextTime += stepDur;
    step++;
  }
}

function fadeTo(value, time = 0.4) {
  const a = getAudio();
  if (!a || !trackGain) return;
  trackGain.gain.setTargetAtTime(value, a.ac.currentTime, time / 3);
}

function switchTrack(name) {
  const a = getAudio();
  if (!a) return;
  track = name;
  step = 0;
  nextTime = a.ac.currentTime + 0.08;
  delayNode.delayTime.setValueAtTime((60 / TRACKS[name].bpm) * 0.75, a.ac.currentTime);
  fadeTo(paused ? 0.45 : 1, 0.3);
}

export const music = {
  play(name) {
    if (name === pending && (track === name || !trackGain)) return;
    pending = name;
    if (!trackGain) return;
    if (!track) { switchTrack(name); return; }
    fadeTo(0, 0.25);
    setTimeout(() => { if (pending === name) switchTrack(name); }, 300);
  },
  setIntensity(x) {
    intensity += (x - intensity) * 0.05;
  },
  setPaused(p) {
    paused = p;
    if (track) fadeTo(p ? 0.45 : 1, 0.3);
  },
};

onAudioReady((ac) => {
  build(ac, getAudio().musicIn);
  switchTrack(pending);
  timer = timer || setInterval(tick, 25);
});
