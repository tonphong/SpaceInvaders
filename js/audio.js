// Web Audio mixer + synthesized sound effects. Music and SFX run on separate buses so each has its own
// volume, and SFX briefly duck the music so important cues always cut through.
import { settings, saveSettings } from './settings.js';

const MUSIC_LEVEL = 0.75;
const SFX_LEVEL = 0.9;

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let duckGain = null;
let noiseBuf = null;
let lastDuck = 0;
const readyListeners = [];

export function onAudioReady(fn) {
  if (ac) fn(ac);
  else readyListeners.push(fn);
}

export function getAudio() {
  return ac ? { ac, musicIn: musicBus, noiseBuf } : null;
}

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ac.destination);
    master = ac.createGain();
    master.connect(comp);
    sfxBus = ac.createGain();
    sfxBus.connect(master);
    duckGain = ac.createGain();
    duckGain.connect(master);
    musicBus = ac.createGain();
    musicBus.connect(duckGain);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    // iOS only starts the audio pipeline once something plays inside a user gesture.
    const silent = ac.createBufferSource();
    silent.buffer = ac.createBuffer(1, 1, ac.sampleRate);
    silent.connect(ac.destination);
    silent.start(0);
    readyListeners.splice(0).forEach((fn) => fn(ac));
  }
  if (ac.state === 'suspended' && !document.hidden) ac.resume();
}

export function applyVolumes() {
  if (!ac) return;
  const t = ac.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.02);
  // Squared curves make the sliders feel linear to the ear.
  sfxBus.gain.setTargetAtTime(settings.sfx * settings.sfx * SFX_LEVEL, t, 0.02);
  musicBus.gain.setTargetAtTime(settings.music * settings.music * MUSIC_LEVEL, t, 0.05);
}

export function isMuted() { return settings.muted; }

export function toggleMute() {
  settings.muted = !settings.muted;
  saveSettings();
  applyVolumes();
  return settings.muted;
}

document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend();
  else ac.resume();
});

function duck(depth) {
  if (!ac || !settings.duck) return;
  const t = ac.currentTime;
  if (t - lastDuck < 0.04) return;
  lastDuck = t;
  const g = duckGain.gain;
  if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
  else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
  g.setTargetAtTime(1 - depth, t, 0.012);
  g.setTargetAtTime(1, t + 0.1, 0.22);
}

function tone(f0, f1, dur, type, vol, delay = 0) {
  if (!ac || settings.muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol, f0, f1, filterType = 'lowpass', delay = 0) {
  if (!ac || settings.muted) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ac.createBiquadFilter();
  flt.type = filterType;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const MARCH = [98, 87.3, 77.8, 73.4];

export const sfx = {
  shoot(pol) { pol ? tone(760, 380, 0.09, 'square', 0.06) : tone(980, 490, 0.09, 'square', 0.06); },
  gunner() { tone(1400, 900, 0.05, 'triangle', 0.04); },
  deflect() { tone(2400, 1500, 0.07, 'triangle', 0.12); tone(3400, 2900, 0.04, 'sine', 0.05); },
  shieldBreak() { duck(0.3); noise(0.2, 0.22, 7000, 1500, 'highpass'); tone(620, 300, 0.16, 'square', 0.07); },
  kill() { duck(0.35); noise(0.25, 0.28, 3200, 250); tone(320, 70, 0.22, 'square', 0.07); },
  playerHit() { duck(0.7); noise(0.9, 0.45, 2600, 90); tone(420, 40, 0.9, 'sawtooth', 0.16); },
  charge() { duck(0.3); tone(170, 880, 1.15, 'sawtooth', 0.045); },
  beam() { duck(0.5); tone(110, 65, 0.5, 'sawtooth', 0.14); noise(0.5, 0.16, 1400, 300, 'bandpass'); },
  swap(pol) { pol ? tone(520, 780, 0.08, 'sine', 0.14) : tone(780, 520, 0.08, 'sine', 0.14); },
  overheat() { duck(0.4); tone(150, 80, 0.4, 'square', 0.11); noise(0.4, 0.12, 900, 200); },
  pickup() { duck(0.4); [660, 880, 1320].forEach((f, i) => tone(f, f, 0.1, 'square', 0.07, i * 0.07)); },
  extraLife() { duck(0.5); [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.12, i * 0.08)); },
  waveClear() { duck(0.5); [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.16, 'square', 0.06, i * 0.09)); },
  courierBlip() { tone(1250, 950, 0.06, 'sine', 0.035); },
  flip() { duck(0.4); tone(300, 1500, 0.35, 'triangle', 0.1); tone(1500, 300, 0.35, 'triangle', 0.06); },
  breach() { duck(0.6); tone(90, 45, 0.8, 'square', 0.14); },
  march(step) { const f = MARCH[step % MARCH.length]; tone(f, f * 0.96, 0.12, 'square', 0.1); },
  ui() { tone(880, 1100, 0.05, 'triangle', 0.06); },
};
