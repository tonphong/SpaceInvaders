// Persistent player settings, keybinds and wave progress (localStorage, with safe fallbacks).
const SETTINGS_KEY = 'spaceinvaders.settings';
const PROGRESS_KEY = 'spaceinvaders.progress';
const HI_KEY = 'spaceinvaders.hi';
const LEGACY_HI_KEY = 'spaceinvader.polarity.hi';

export const ACTIONS = [
  { id: 'left', label: 'Move left' },
  { id: 'right', label: 'Move right' },
  { id: 'fire', label: 'Fire' },
  { id: 'swap', label: 'Swap polarity' },
  { id: 'pause', label: 'Pause' },
  { id: 'mute', label: 'Mute' },
];

const DEFAULT_BINDS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire: ['Space', 'KeyZ'],
  swap: ['KeyX', 'ShiftLeft'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM', null],
};

export const DIFFICULTIES = {
  relaxed: { label: 'RELAXED', field: 0.75, fire: 0.7, lancer: 1.3 },
  normal: { label: 'NORMAL', field: 1, fire: 1, lancer: 1 },
  intense: { label: 'INTENSE', field: 1.3, fire: 1.35, lancer: 0.8 },
};

const DEFAULTS = {
  music: 0.5,
  sfx: 0.8,
  duck: true,
  muted: false,
  shake: true,
  flashes: true,
  touch: 'auto',
  difficulty: 'normal',
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const cloneBinds = (b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]]));

function loadSettings() {
  const saved = read(SETTINGS_KEY) || {};
  const s = { ...DEFAULTS, binds: cloneBinds(DEFAULT_BINDS) };
  for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) s[k] = saved[k];
  if (!DIFFICULTIES[s.difficulty]) s.difficulty = DEFAULTS.difficulty;
  if (!['auto', 'on', 'off'].includes(s.touch)) s.touch = DEFAULTS.touch;
  if (saved.binds && typeof saved.binds === 'object') {
    for (const { id } of ACTIONS) {
      const b = saved.binds[id];
      if (Array.isArray(b) && b.length === 2 && b.some(Boolean)) s.binds[id] = b.map((c) => (typeof c === 'string' ? c : null));
    }
  }
  return s;
}

export const settings = loadSettings();
export function saveSettings() { write(SETTINGS_KEY, settings); }

export function resetBinds() {
  settings.binds = cloneBinds(DEFAULT_BINDS);
  saveSettings();
}

// Assigning a key steals it from any other action so one key never triggers two actions.
export function setBind(action, slot, code) {
  for (const { id } of ACTIONS) {
    settings.binds[id] = settings.binds[id].map((c) => (c === code ? null : c));
  }
  settings.binds[action][slot] = code;
  for (const { id } of ACTIONS) {
    if (!settings.binds[id].some(Boolean)) settings.binds[id] = [...DEFAULT_BINDS[id]].map((c) => (c === code ? null : c));
  }
  saveSettings();
}

export function clearBind(action, slot) {
  const other = settings.binds[action][1 - slot];
  if (!other) return false;
  settings.binds[action][slot] = null;
  saveSettings();
  return true;
}

export function actionForKey(code) {
  for (const { id } of ACTIONS) if (settings.binds[id].includes(code)) return id;
  return null;
}

const KEY_NAMES = {
  Space: 'SPACE', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT', AltRight: 'R-ALT', MetaLeft: 'L-META', MetaRight: 'R-META',
  Enter: 'ENTER', Escape: 'ESC', Tab: 'TAB', Backspace: 'BKSP', CapsLock: 'CAPS',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

export function bindLabel(action) {
  return settings.binds[action].filter(Boolean).map(keyLabel).join(' / ');
}

// ---------- progress ----------

function loadProgress() {
  const p = read(PROGRESS_KEY);
  return { unlocked: Math.max(1, Number.isInteger(p?.unlocked) ? p.unlocked : 1) };
}

export const progress = loadProgress();

export function unlockWave(n) {
  if (n <= progress.unlocked) return;
  progress.unlocked = n;
  write(PROGRESS_KEY, progress);
}

export function resetProgress() {
  progress.unlocked = 1;
  write(PROGRESS_KEY, progress);
}

export function loadHi() {
  const v = read(HI_KEY) ?? read(LEGACY_HI_KEY);
  return Number.isFinite(v) ? v : 0;
}
export function saveHi(v) { write(HI_KEY, v); }
