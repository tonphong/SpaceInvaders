import { sfx, unlockAudio, toggleMute, isMuted, applyVolumes } from './audio.js';
import { music } from './music.js';
import { buildSprites, COLORS, SPR, rgba } from './sprites.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { settings, progress, unlockWave, loadHi, saveHi, bindLabel, DIFFICULTIES } from './settings.js';

const VERSION = '1.1.0';
const W = 600;
const H = 800;
const HALF = SPR / 2;
const TAU = Math.PI * 2;
const PLAYER_Y = 712;
const BREACH_Y = 636;
const FIELD_START = 74;
const COURIER_Y = 54;
const COLS = 8;
const ROWS = 5;
const SX = 58;
const SY = 46;
const COMBO_TIME = 2.4;
const POWER_TIME = 12;
const MAX_LIVES = 6;
const EXTRA_LIFE_EVERY = 15000;
const MAX_PARTICLES = 700;
const FONT = "'Orbitron', 'Segoe UI', system-ui, sans-serif";
const BASE_POINTS = { darter: 20, warden: 40, lancer: 60 };
const LANCER_ORDER = [3, 4, 1, 6, 0, 7, 2, 5];
const POWERS = {
  spread: { label: 'SPREAD', glyph: 'S' },
  aegis: { label: 'AEGIS', glyph: 'A' },
  gunner: { label: 'GUNNER', glyph: 'G' },
};
const WAVE_TIPS = {
  1: 'MATCH YOUR POLARITY TO DAMAGE',
  2: 'CHAIN KILLS · NEVER MISS',
  3: 'WARNING: POLARITY SHIFTS BEGIN',
  4: 'LANCERS GROW BOLDER',
};

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---------- DOM + platform ----------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const muteBtn = document.getElementById('btn-mute');
const uiRoot = document.getElementById('ui');
const fine = matchMedia('(pointer: fine)').matches;
let touchDetected = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !fine);
let isTouch = false;

function applyTouchMode() {
  const show = settings.touch === 'on' || (settings.touch === 'auto' && touchDetected);
  if (show === isTouch) return;
  isTouch = show;
  document.body.classList.toggle('touch', show);
  resize();
}

const view = { scale: 1, dpr: 1 };

function resize() {
  const r = stage.getBoundingClientRect();
  const scale = Math.max(0.1, Math.min((r.width - 12) / W, (r.height - 12) / H));
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  view.scale = scale;
  view.dpr = dpr;
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  document.documentElement.style.setProperty('--side', `${Math.max(0, (window.innerWidth - W * scale) / 2)}px`);
  uiRoot.style.setProperty('--u', `${scale}px`);
}
applyTouchMode();
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
window.visualViewport?.addEventListener('resize', resize);

const sprites = buildSprites(clamp(Math.ceil(view.scale * view.dpr * 1.25), 2, 4));
const bg = buildBackground();

const input = createInput({
  canvas,
  pad: document.getElementById('pad'),
  fireBtn: document.getElementById('btn-fire'),
  swapBtn: document.getElementById('btn-swap'),
  pauseBtn: document.getElementById('btn-pause'),
  muteBtn,
  logicalWidth: W,
  getCanvasScale: () => view.scale,
  onGesture: unlockAudio,
  onTouch: () => {
    if (touchDetected) return;
    touchDetected = true;
    applyTouchMode();
  },
  isPlaying: () => mode === 'playing',
});

function syncMute() { muteBtn?.classList.toggle('muted', isMuted()); }
syncMute();

// ---------- background ----------

function buildBackground() {
  const r = 2;
  const c = document.createElement('canvas');
  c.width = W * r;
  c.height = H * r;
  const b = c.getContext('2d');
  b.scale(r, r);
  const g = b.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04020d');
  g.addColorStop(0.6, '#0a0620');
  g.addColorStop(1, '#170a30');
  b.fillStyle = g;
  b.fillRect(0, 0, W, H);
  const blobs = [
    { x: 110, y: 210, r: 280, c: COLORS.pol[1], a: 0.075 },
    { x: 500, y: 430, r: 320, c: COLORS.pol[0], a: 0.06 },
    { x: 300, y: 780, r: 340, c: COLORS.field, a: 0.1 },
  ];
  for (const n of blobs) {
    const rg = b.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    rg.addColorStop(0, rgba(n.c, n.a));
    rg.addColorStop(1, rgba(n.c, 0));
    b.fillStyle = rg;
    b.fillRect(0, 0, W, H);
  }
  // Synthwave ground grid behind the player zone.
  b.strokeStyle = rgba(COLORS.field, 0.09);
  b.lineWidth = 1;
  const horizon = 646;
  for (let i = 0; i < 10; i++) {
    const y = horizon + i * i * 1.9;
    b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke();
  }
  for (let i = -12; i <= 12; i++) {
    b.beginPath(); b.moveTo(W / 2 + i * 16, horizon); b.lineTo(W / 2 + i * 110, H); b.stroke();
  }
  return c;
}

const STAR_SPEED = [8, 22, 56];
const STAR_SIZE = [1, 1.5, 2.2];
const stars = Array.from({ length: 110 }, (_, i) => ({
  x: rand(0, W), y: rand(0, H), layer: i < 60 ? 0 : i < 90 ? 1 : 2, tw: rand(0, TAU),
}));
let warp = 1;

function updateStars(dt) {
  const target = game && game.clearing ? 9 : 1;
  warp += (target - warp) * Math.min(1, dt * 3);
  for (const s of stars) {
    s.y += STAR_SPEED[s.layer] * dt * warp;
    if (s.y > H) { s.y -= H; s.x = rand(0, W); }
  }
}

function drawStars() {
  ctx.save();
  for (const s of stars) {
    const a = (0.3 + 0.25 * s.layer) * (0.7 + 0.3 * Math.sin(time * 2 + s.tw));
    ctx.fillStyle = `rgba(230,225,255,${a})`;
    const sz = STAR_SIZE[s.layer];
    if (warp > 2) ctx.fillRect(s.x, s.y, sz * 0.8, STAR_SPEED[s.layer] * warp * 0.04);
    else ctx.fillRect(s.x, s.y, sz, sz);
  }
  ctx.restore();
}

// ---------- game state ----------

let mode = 'menu';
let game = null;
let time = 0;
let modeTimer = 0;
let hiScore = loadHi();
let newHi = false;

function waveCfg(n) {
  const d = DIFFICULTIES[settings.difficulty];
  return {
    fieldSpeed: Math.min(22, 5.5 + n * 1.3) * d.field,
    fireRate: Math.min(2.4, 0.4 + n * 0.14) * d.fire,
    aggroRate: Math.min(1.4, 0.18 + n * 0.09) * d.fire,
    bulletSpeed: Math.min(380, 210 + n * 12),
    dodge: Math.min(0.65, 0.2 + n * 0.05),
    lancerInterval: Math.max(2.2, 5.4 - n * 0.3) * d.lancer,
    lancerMax: 1 + Math.floor(n / 4),
    lancerCount: Math.min(COLS, 2 + n),
    flipInterval: n >= 3 ? Math.max(5, 10.5 - (n - 3) * 0.6) : 0,
    swaySpeed: Math.min(1.3, 0.55 + n * 0.05),
  };
}

function newGame(startAt) {
  newHi = false;
  game = {
    score: 0, lives: 3, wave: 0, nextLife: EXTRA_LIFE_EVERY,
    player: { x: W / 2, pol: 0, heat: 0, overheated: false, cooldown: 0, sinceShot: 1, swapCd: 0, swapFx: 0, invuln: 0, alive: true, tilt: 0 },
    shots: [], ricochets: [], ebullets: [], enemies: [], particles: [], popups: [], pickups: [],
    formation: null, cfg: null, courier: null, courierTimer: 14, power: null,
    chain: 0, bestChain: 0, comboTimer: 0, multPulse: 0,
    shake: 0, flash: 0, flashColor: COLORS.danger, banner: null,
    lancerTimer: 3, flipTimer: 0, flipWarn: false, aggro: null, danger: 0,
    marchTimer: 1, marchStep: 0, gunnerCd: 0, droneX: W / 2 - 38,
    intro: 0, clearing: false, clearTimer: 0, deadTimer: 0,
    stats: { shots: 0, hits: 0 },
  };
  startWave(startAt);
}

function startWave(n) {
  const g = game;
  const cfg = waveCfg(n);
  g.wave = n;
  g.cfg = cfg;
  g.enemies = [];
  const lancerCols = new Set(LANCER_ORDER.slice(0, cfg.lancerCount));
  const pattern = (n - 1) % 3;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = row === 0 ? 'lancer' : row <= 2 ? 'warden' : 'darter';
      if (type === 'lancer' && !lancerCols.has(col)) continue;
      const pol = pattern === 0 ? (col + row) % 2 : pattern === 1 ? col % 2 : row % 2;
      g.enemies.push({
        type, col, row, pol, alive: true,
        hp: type === 'warden' ? 2 : 1, shield: type === 'warden',
        r: type === 'warden' ? 19 : 17,
        x: W / 2, y: -100, ox: 0, dodge: 0, dv: 0, dodgeCd: 0,
        phase: Math.random() * TAU, flash: 0, beam: null,
      });
    }
  }
  g.formation = { t: 0, fieldY: FIELD_START, mid: W / 2, amp: 0, angle: 0, scale: 1, cx: W / 2, first: true };
  g.intro = 0;
  g.clearing = false;
  g.clearTimer = 0;
  g.lancerTimer = 2.5;
  g.flipTimer = cfg.flipInterval;
  g.flipWarn = false;
  g.ebullets.length = 0;
  g.courier = null;
  g.courierTimer = rand(10, 16);
  g.marchTimer = 1.2;
  showBanner(`WAVE ${n}`, WAVE_TIPS[n] || 'HOLD THE LINE', COLORS.pol[(n + 1) % 2], 2.2);
}

function showBanner(text, sub, color, dur = 2) {
  game.banner = { text, sub, color, t: 0, dur };
}

function popup(x, y, text, color, size = 12) {
  game.popups.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
}

function mult() { return Math.min(8, 1 + Math.floor(game.chain / 4)); }

function addScore(n) {
  const g = game;
  g.score += n;
  while (g.score >= g.nextLife) {
    g.nextLife += EXTRA_LIFE_EVERY;
    if (g.lives < MAX_LIVES) {
      g.lives++;
      sfx.extraLife();
      popup(g.player.x, PLAYER_Y - 56, '+1 LIFE', COLORS.gold, 15);
    }
  }
}

// ---------- particles ----------

function pushParticle(p) {
  const list = game.particles;
  list.push(p);
  if (list.length > MAX_PARTICLES) list.splice(0, list.length - MAX_PARTICLES);
}

function burst(x, y, color, n, speed, life, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const v = rand(0.25, 1) * speed;
    const l = rand(0.5, 1) * life;
    pushParticle({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, color, size: rand(0.6, 1) * size });
  }
}

function ring(x, y, color, r, vr, life, width = 2) {
  pushParticle({ ring: true, x, y, r, vr, life, max: life, color, width, vx: 0, vy: 0 });
}

function explode(x, y, color, big = false) {
  burst(x, y, color, big ? 42 : 16, big ? 330 : 220, big ? 1 : 0.55, big ? 4 : 3);
  burst(x, y, '#ffffff', big ? 14 : 6, big ? 200 : 140, 0.35, 2);
  ring(x, y, color, 4, big ? 230 : 150, big ? 0.6 : 0.35, big ? 3 : 2);
}

// ---------- update: formation & enemies ----------

function updateFormation(dt) {
  const g = game;
  const f = g.formation;
  const cfg = g.cfg;
  f.t += dt;
  g.intro += dt;
  if (g.intro > 1.2) f.fieldY += cfg.fieldSpeed * dt;
  f.scale = 1 - 0.14 * clamp((f.fieldY - FIELD_START) / 360, 0, 1);

  let minL = Infinity;
  let maxL = -Infinity;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const lx = (e.col - (COLS - 1) / 2) * SX * f.scale;
    if (lx < minL) minL = lx;
    if (lx > maxL) maxL = lx;
  }
  if (minL === Infinity) return;

  // The pendulum widens as columns die, so a thinned formation sweeps further.
  const margin = 36;
  const lo = margin - minL;
  const hi = W - margin - maxL;
  const k = f.first ? 1 : Math.min(1, dt * 1.2);
  f.first = false;
  f.mid += ((lo + hi) / 2 - f.mid) * k;
  f.amp += (Math.max(0, (hi - lo) / 2) - f.amp) * k;
  f.cx = f.mid + f.amp * Math.sin(f.t * cfg.swaySpeed);
  f.angle = 0.12 * Math.sin(f.t * cfg.swaySpeed * 0.8 + 0.6);

  const cos = Math.cos(f.angle);
  const sin = Math.sin(f.angle);
  const cy = f.fieldY + 38 + ((ROWS - 1) / 2) * SY * f.scale;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const lx = (e.col - (COLS - 1) / 2) * SX * f.scale;
    const ly = (e.row - (ROWS - 1) / 2) * SY * f.scale;
    const intro = easeOut(clamp((g.intro - (ROWS - 1 - e.row) * 0.08 - e.col * 0.02) / 0.9, 0, 1));
    e.x = clamp(f.cx + lx * cos - ly * sin + e.ox, 18, W - 18);
    e.y = cy + lx * sin + ly * cos - (1 - intro) * 480;
  }
}

function updateEnemies(dt) {
  const g = game;
  const cfg = g.cfg;
  let aggro = null;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (!aggro || e.y > aggro.y) aggro = e;
  }
  g.aggro = aggro;

  for (const e of g.enemies) {
    if (!e.alive) continue;
    if (e.type === 'darter') {
      e.dodgeCd -= dt;
      if (e.dodgeCd <= 0) {
        for (const s of g.shots) {
          if (s.y > e.y && s.y - e.y < 120 && Math.abs(s.x - e.x) < 26) {
            e.dodgeCd = 0.75;
            if (Math.random() < cfg.dodge) e.dv = (s.x < e.x ? 1 : -1) * 280;
            break;
          }
        }
      }
      e.dodge = clamp(e.dodge + e.dv * dt, -30, 30);
      e.dv *= Math.exp(-7 * dt);
      e.dodge *= Math.exp(-0.9 * dt);
      e.ox = e.dodge + Math.sin(time * 3.2 + e.phase) * (e === aggro ? 12 : 6);
    } else {
      e.ox = e === aggro ? Math.sin(time * 9 + e.phase) * 4 : 0;
    }
  }
}

function updateLancers(dt) {
  const g = game;
  const cfg = g.cfg;
  const p = g.player;
  if (g.intro > 1.8 && p.alive) {
    g.lancerTimer -= dt;
    if (g.lancerTimer <= 0) {
      g.lancerTimer = cfg.lancerInterval * rand(0.7, 1.3);
      const idle = g.enemies.filter((e) => e.alive && e.type === 'lancer' && !e.beam);
      const active = g.enemies.filter((e) => e.alive && e.beam).length;
      if (idle.length && active < cfg.lancerMax) {
        pick(idle).beam = { state: 'charge', t: 1.15, blocked: false };
        sfx.charge();
      }
    }
  }
  for (const e of g.enemies) {
    if (!e.alive || !e.beam) continue;
    const b = e.beam;
    b.t -= dt;
    if (b.state === 'charge') {
      if (b.t <= 0) {
        b.state = 'fire';
        b.t = 0.45;
        sfx.beam();
        g.shake = Math.max(g.shake, 4);
      }
      continue;
    }
    if (b.t <= 0) { e.beam = null; continue; }
    if (!b.blocked && p.alive && Math.abs(p.x - e.x) < 20) {
      if (g.power?.type === 'aegis') {
        b.blocked = true;
        g.power = null;
        burst(p.x, PLAYER_Y - 36, COLORS.gold, 22, 260, 0.5);
        sfx.shieldBreak();
        popup(p.x, PLAYER_Y - 58, 'AEGIS BROKEN', COLORS.gold);
      } else if (p.invuln <= 0) {
        hitPlayer();
      }
    }
    if (!b.blocked && Math.random() < dt * 40) burst(e.x + rand(-8, 8), H - 4, COLORS.danger, 1, 160, 0.3, 2);
  }
}

function updatePolarityShift(dt) {
  const g = game;
  if (!g.cfg.flipInterval || g.intro < 1.2) return;
  g.flipTimer -= dt;
  g.flipWarn = g.flipTimer < 1.2;
  if (g.flipTimer > 0) return;
  g.flipTimer = g.cfg.flipInterval;
  g.flipWarn = false;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.pol ^= 1;
    ring(e.x, e.y, COLORS.pol[e.pol], 6, 90, 0.3, 1.5);
  }
  sfx.flip();
  g.flash = 0.18;
  g.flashColor = COLORS.field;
}

function updateEnemyFire(dt) {
  const g = game;
  const cfg = g.cfg;
  const p = g.player;
  if (g.intro < 1.5 || !p.alive) return;
  if (Math.random() < cfg.fireRate * dt) {
    const front = new Map();
    for (const e of g.enemies) {
      if (!e.alive || e.type === 'lancer') continue;
      const cur = front.get(e.col);
      if (!cur || e.row > cur.row) front.set(e.col, e);
    }
    if (front.size) {
      const e = pick([...front.values()]);
      g.ebullets.push({ x: e.x, y: e.y + 14, vx: 0, vy: cfg.bulletSpeed, aimed: false });
    }
  }
  // The enemy closest to the player is the aggro target: it jitters harder and fires aimed shots.
  const a = g.aggro;
  if (a && Math.random() < cfg.aggroRate * dt) {
    const dx = p.x - a.x;
    const dy = PLAYER_Y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = cfg.bulletSpeed * 1.1;
    g.ebullets.push({ x: a.x, y: a.y + 14, vx: (dx / d) * sp, vy: (dy / d) * sp, aimed: true });
  }
}

// ---------- update: player & projectiles ----------

function updatePlayer(dt) {
  const g = game;
  const p = g.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.swapCd -= dt;
  p.cooldown -= dt;
  p.sinceShot += dt;
  p.swapFx = Math.max(0, p.swapFx - dt);
  const drag = input.takeDrag();
  if (!p.alive) return;

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const oldX = p.x;
  p.x = clamp(p.x + dir * 340 * dt + drag, 24, W - 24);
  const v = (p.x - oldX) / Math.max(dt, 1e-3);
  p.tilt += (clamp(v / 340, -1, 1) - p.tilt) * Math.min(1, dt * 10);

  if (input.take('swap') && p.swapCd <= 0) {
    p.pol ^= 1;
    p.swapCd = 0.12;
    p.swapFx = 0.35;
    sfx.swap(p.pol);
    burst(p.x, PLAYER_Y, COLORS.pol[p.pol], 10, 160, 0.35, 2.5);
  }

  if (p.overheated) {
    p.heat -= 50 * dt;
    if (p.heat <= 0) { p.heat = 0; p.overheated = false; }
    if (Math.random() < dt * 25) {
      pushParticle({ x: p.x + rand(-6, 6), y: PLAYER_Y - 16, vx: rand(-15, 15), vy: rand(-70, -40), life: 0.6, max: 0.6, color: '#8a7f9e', size: 3 });
    }
  } else if (input.fire && p.cooldown <= 0) {
    fire();
  } else if (p.sinceShot > 0.2) {
    p.heat = Math.max(0, p.heat - 40 * dt);
  }
}

function fire() {
  const g = game;
  const p = g.player;
  p.cooldown = 0.15;
  p.sinceShot = 0;
  p.heat += 11;
  g.shots.push({ x: p.x, y: PLAYER_Y - 20, vx: 0, vy: -760, pol: p.pol, main: true, neutral: false });
  g.stats.shots++;
  if (g.power?.type === 'spread') {
    for (const s of [-1, 1]) g.shots.push({ x: p.x + s * 18, y: PLAYER_Y - 6, vx: s * 170, vy: -740, pol: p.pol, main: false, neutral: false });
  }
  sfx.shoot(p.pol);
  if (p.heat >= 100) {
    p.heat = 100;
    p.overheated = true;
    sfx.overheat();
    popup(p.x, PLAYER_Y - 44, 'OVERHEAT', COLORS.danger, 13);
  }
}

function miss() {
  const g = game;
  if (g.clearing || g.chain === 0) return;
  popup(g.player.x, PLAYER_Y - 44, 'CHAIN BROKEN', rgba(COLORS.white, 0.8), 11);
  g.chain = 0;
  g.comboTimer = 0;
}

function updateShots(dt) {
  const g = game;
  for (let i = g.shots.length - 1; i >= 0; i--) {
    const s = g.shots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    let remove = false;
    if (s.y < -20 || s.x < -20 || s.x > W + 20) {
      remove = true;
      if (s.main) miss();
    } else {
      let hit = null;
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        if (dx * dx + dy * dy < e.r * e.r) { hit = e; break; }
      }
      if (hit) {
        remove = true;
        if (s.neutral || s.pol === hit.pol) {
          if (s.main) g.stats.hits++;
          damage(hit);
        } else {
          deflect(s, hit);
        }
      } else if (g.courier && Math.abs(s.x - g.courier.x) < 27 && Math.abs(s.y - g.courier.y) < 13) {
        remove = true;
        if (s.main) g.stats.hits++;
        hitCourier();
      }
    }
    if (remove) g.shots.splice(i, 1);
  }
}

function deflect(s, e) {
  const g = game;
  g.ricochets.push({ x: s.x, y: s.y, vx: rand(-260, 260), vy: rand(160, 300), life: 0.5, pol: s.pol });
  burst(s.x, s.y, '#ffffff', 5, 160, 0.2, 2);
  sfx.deflect();
  if (s.main) {
    popup(e.x, e.y - 26, 'DEFLECT', COLORS.pol[e.pol], 10);
    miss();
  }
}

function damage(e) {
  const g = game;
  e.flash = 0.12;
  if (e.shield) {
    e.shield = false;
    e.hp--;
    sfx.shieldBreak();
    burst(e.x, e.y, COLORS.pol[e.pol], 14, 200, 0.45, 2.5);
    ring(e.x, e.y, COLORS.pol[e.pol], 22, 60, 0.3, 2);
    if (g.chain > 0) g.comboTimer = COMBO_TIME;
    addScore(10);
    return;
  }
  e.hp--;
  if (e.hp <= 0) kill(e);
}

function registerKill(x, y, base, color) {
  const g = game;
  const before = mult();
  g.chain++;
  g.bestChain = Math.max(g.bestChain, g.chain);
  g.comboTimer = COMBO_TIME;
  const m = mult();
  if (m > before) g.multPulse = 0.35;
  const pts = base * m;
  addScore(pts);
  popup(x, y, `+${pts}`, m > 1 ? COLORS.gold : color, m > 1 ? 15 : 12);
}

function kill(e) {
  const g = game;
  e.alive = false;
  e.beam = null;
  registerKill(e.x, e.y, BASE_POINTS[e.type], COLORS.pol[e.pol]);
  explode(e.x, e.y, COLORS.pol[e.pol]);
  sfx.kill();
  g.shake = Math.max(g.shake, 3);
}

function updateRicochets(dt) {
  const list = game.ricochets;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.life -= dt;
    if (r.life <= 0) list.splice(i, 1);
  }
}

function updateEnemyBullets(dt) {
  const g = game;
  const p = g.player;
  const aegis = g.power?.type === 'aegis';
  for (let i = g.ebullets.length - 1; i >= 0; i--) {
    const b = g.ebullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let remove = b.y > H + 10 || b.x < -10 || b.x > W + 10;
    if (!remove && p.alive) {
      const dx = b.x - p.x;
      const dy = b.y - PLAYER_Y;
      if (aegis && dx * dx + (dy + 2) * (dy + 2) < 38 * 38) {
        remove = true;
        burst(b.x, b.y, COLORS.gold, 6, 140, 0.25, 2);
        sfx.deflect();
      } else if (p.invuln <= 0 && Math.abs(dx) < 14 && dy > -16 && dy < 12) {
        hitPlayer();
        return;
      }
    }
    if (remove) g.ebullets.splice(i, 1);
  }
}

function hitPlayer() {
  const g = game;
  const p = g.player;
  if (!p.alive) return;
  g.lives--;
  explode(p.x, PLAYER_Y, COLORS.pol[p.pol], true);
  sfx.playerHit();
  g.shake = 18;
  g.flash = 0.45;
  g.flashColor = COLORS.danger;
  g.chain = 0;
  g.comboTimer = 0;
  g.power = null;
  g.ebullets.length = 0;
  for (const e of g.enemies) e.beam = null;
  p.heat = 0;
  p.overheated = false;
  if (g.lives <= 0) {
    p.alive = false;
    g.deadTimer = 2.2;
  } else {
    p.invuln = 2.4;
  }
}

// ---------- update: courier, pickups, power-ups ----------

function updateCourier(dt) {
  const g = game;
  if (!g.courier) {
    if (g.intro > 2 && !g.clearing && g.player.alive) {
      g.courierTimer -= dt;
      if (g.courierTimer <= 0) {
        g.courierTimer = rand(16, 26);
        const dir = Math.random() < 0.5 ? 1 : -1;
        g.courier = { x: dir > 0 ? -40 : W + 40, y: COURIER_Y, dir, hp: 3, flash: 0, blip: 0 };
      }
    }
    return;
  }
  const c = g.courier;
  c.x += c.dir * 120 * dt;
  c.y = COURIER_Y + Math.sin(time * 4) * 4;
  c.flash = Math.max(0, c.flash - dt);
  c.blip -= dt;
  if (c.blip <= 0) { c.blip = 0.32; sfx.courierBlip(); }
  if (c.x < -60 || c.x > W + 60) g.courier = null;
}

function hitCourier() {
  const g = game;
  const c = g.courier;
  c.hp--;
  c.flash = 0.12;
  burst(c.x, c.y, COLORS.gold, 6, 150, 0.3, 2);
  if (c.hp > 0) { sfx.shieldBreak(); return; }
  g.courier = null;
  registerKill(c.x, c.y, 150, COLORS.gold);
  explode(c.x, c.y, COLORS.gold, true);
  sfx.kill();
  g.shake = Math.max(g.shake, 6);
  g.pickups.push({ x: c.x, y: c.y, type: pick(Object.keys(POWERS)), t: 0 });
}

function updatePickups(dt) {
  const g = game;
  const p = g.player;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const k = g.pickups[i];
    k.y += 120 * dt;
    k.t += dt;
    if (p.alive && Math.abs(k.x - p.x) < 30 && Math.abs(k.y - PLAYER_Y) < 30) {
      g.power = { type: k.type, time: POWER_TIME };
      g.gunnerCd = 0;
      sfx.pickup();
      popup(p.x, PLAYER_Y - 50, POWERS[k.type].label, COLORS.gold, 15);
      ring(p.x, PLAYER_Y, COLORS.gold, 10, 180, 0.45, 2);
      g.pickups.splice(i, 1);
    } else if (k.y > H + 20) {
      g.pickups.splice(i, 1);
    }
  }
}

function dronePos() {
  return { x: game.droneX, y: PLAYER_Y + 4 + Math.sin(time * 3) * 5 };
}

function updatePower(dt) {
  const g = game;
  const p = g.player;
  const side = p.x < W / 2 ? 1 : -1;
  g.droneX += (p.x + side * 40 - g.droneX) * Math.min(1, dt * 8);
  if (!g.power) return;
  g.power.time -= dt;
  if (g.power.time <= 0) { g.power = null; return; }
  if (g.power.type !== 'gunner' || !p.alive) return;
  g.gunnerCd -= dt;
  if (g.gunnerCd > 0) return;
  g.gunnerCd = 0.32;
  const d = dronePos();
  let vx = 0;
  let vy = -700;
  const t = g.aggro;
  if (t && t.alive && t.y < d.y) {
    const dx = t.x - d.x;
    const dy = t.y - d.y;
    const len = Math.hypot(dx, dy);
    vx = (dx / len) * 700;
    vy = (dy / len) * 700;
  }
  g.shots.push({ x: d.x, y: d.y - 6, vx, vy, pol: 0, main: false, neutral: true });
  sfx.gunner();
}

// ---------- update: flow ----------

function lowestEnemyY() {
  let low = -Infinity;
  for (const e of game.enemies) if (e.alive && e.y + e.r > low) low = e.y + e.r;
  return low;
}

function updateMarch(dt) {
  const g = game;
  if (g.clearing || !g.player.alive || g.intro < 1.2) return;
  g.danger = clamp((lowestEnemyY() - 290) / (BREACH_Y - 290), 0, 1);
  // The classic speeding-up march only plays when the soundtrack is off; otherwise the music carries the tension.
  if (settings.music > 0) return;
  g.marchTimer -= dt;
  if (g.marchTimer <= 0) {
    g.marchTimer = lerp(0.8, 0.2, g.danger);
    sfx.march(g.marchStep++);
  }
}

function checkBreach() {
  const g = game;
  if (!g.player.alive || g.clearing || g.intro < 1.2) return;
  if (lowestEnemyY() < BREACH_Y) return;
  g.formation.fieldY = Math.max(FIELD_START, g.formation.fieldY - 170);
  showBanner('BREACH!', 'FORMATION REPELLED', COLORS.danger, 1.6);
  sfx.breach();
  g.player.invuln = 0;
  hitPlayer();
}

function checkWaveFlow(dt) {
  const g = game;
  if (g.clearing) {
    g.clearTimer -= dt;
    if (g.clearTimer <= 0) startWave(g.wave + 1);
    return;
  }
  if (!g.player.alive || g.enemies.some((e) => e.alive)) return;
  g.clearing = true;
  g.clearTimer = 2.8;
  unlockWave(g.wave + 1);
  const remaining = Math.max(0, 340 - (g.formation.fieldY - FIELD_START));
  const bonus = Math.round((remaining * 3 * (1 + g.wave * 0.2)) / 10) * 10;
  addScore(bonus);
  showBanner(`WAVE ${g.wave} CLEAR`, `FIELD BONUS +${bonus}`, COLORS.gold, 2.6);
  sfx.waveClear();
  g.ebullets.length = 0;
  g.courier = null;
}

function updateCombo(dt) {
  const g = game;
  g.multPulse = Math.max(0, g.multPulse - dt);
  if (g.chain === 0) return;
  g.comboTimer -= dt;
  if (g.comboTimer <= 0) { g.chain = 0; g.comboTimer = 0; }
}

function updateEffects(dt) {
  const g = game;
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= dt;
    if (p.life <= 0) { g.particles.splice(i, 1); continue; }
    if (p.ring) { p.r += p.vr * dt; continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = Math.exp(-2.2 * dt);
    p.vx *= drag;
    p.vy *= drag;
  }
  for (let i = g.popups.length - 1; i >= 0; i--) {
    const p = g.popups[i];
    p.life -= dt;
    p.y -= 34 * dt;
    if (p.life <= 0) g.popups.splice(i, 1);
  }
  if (g.banner) {
    g.banner.t += dt;
    if (g.banner.t >= g.banner.dur) g.banner = null;
  }
  g.shake = Math.max(0, g.shake - dt * 40);
  g.flash = Math.max(0, g.flash - dt);
  updateRicochets(dt);
}

function updateGame(dt) {
  const g = game;
  updatePlayer(dt);
  if (!g.clearing) {
    updateFormation(dt);
    updateEnemies(dt);
    updateLancers(dt);
    updatePolarityShift(dt);
    updateEnemyFire(dt);
  }
  const steps = Math.max(1, Math.ceil(dt / 0.012));
  for (let i = 0; i < steps; i++) updateShots(dt / steps);
  updateEnemyBullets(dt);
  updateCourier(dt);
  updatePickups(dt);
  updatePower(dt);
  updateCombo(dt);
  updateMarch(dt);
  checkBreach();
  checkWaveFlow(dt);
  if (!g.player.alive) {
    g.deadTimer -= dt;
    if (g.deadTimer <= 0) enterGameOver();
  }
  updateEffects(dt);
}

function recordScore() {
  if (!game || game.score <= hiScore) return;
  hiScore = game.score;
  newHi = true;
  saveHi(hiScore);
}

function setMode(m) {
  mode = m;
  modeTimer = 0;
  document.body.classList.toggle('in-menu', m !== 'playing');
  if (m !== 'playing') input.releaseAll();
  music.setPaused(m === 'paused');
  music.play(m === 'playing' || m === 'paused' ? 'game' : 'menu');
}

function startRun(wave) {
  newGame(clamp(wave, 1, progress.unlocked));
  ui.show(null);
  setMode('playing');
}

function pauseGame() {
  if (mode !== 'playing') return;
  setMode('paused');
  ui.show('pause');
}

function resumeGame() {
  if (mode !== 'paused') return;
  ui.show(null);
  setMode('playing');
}

function quitToMenu() {
  recordScore();
  game = null;
  setMode('menu');
  ui.show('main');
}

function enterGameOver() {
  recordScore();
  ui.context.retryWave = game.wave;
  setMode('gameover');
}

function handleAction(action, data) {
  switch (action) {
    case 'continue': startRun(progress.unlocked); break;
    case 'new': startRun(1); break;
    case 'start': startRun(data.wave); break;
    case 'retry': startRun(ui.context.retryWave); break;
    case 'resume': resumeGame(); break;
    case 'quit': quitToMenu(); break;
  }
}

function handleSettingsChanged(key) {
  if (key === 'touch') applyTouchMode();
  if (key === 'muted') { applyVolumes(); syncMute(); }
}

function update(dt) {
  time += dt;
  updateStars(dt);
  if (input.take('mute')) { toggleMute(); syncMute(); if (ui.current() === 'settings') ui.refresh(); }
  switch (mode) {
    case 'playing':
      if (input.take('pause')) pauseGame();
      else updateGame(dt);
      if (game) music.setIntensity(game.danger);
      break;
    case 'gameover':
      modeTimer += dt;
      updateEffects(dt);
      if (modeTimer > 1.1 && !ui.current()) ui.show('over');
      break;
  }
  input.endFrame();
}

// ---------- rendering ----------

function text(str, x, y, { size = 14, color = COLORS.white, align = 'center', weight = 700, glow = 0, alpha = 1, spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillText(str, x, y);
  ctx.restore();
}

function line(x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function drawSprite(img, x, y, angle = 0, flash = 0, size = SPR) {
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, flash);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

function drawField() {
  const y = game.formation.fieldY;
  ctx.save();
  const grad = ctx.createLinearGradient(0, y - 70, 0, y);
  grad.addColorStop(0, rgba(COLORS.field, 0));
  grad.addColorStop(1, rgba(COLORS.field, 0.13));
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - 70, W, 70);
  ctx.globalCompositeOperation = 'lighter';
  const seed = Math.floor(time * 20);
  ctx.beginPath();
  for (let x = 0; x <= W; x += 20) {
    const j = hash(x * 13 + seed) * 8 - 4;
    if (x === 0) ctx.moveTo(x, y + j); else ctx.lineTo(x, y + j);
  }
  ctx.strokeStyle = rgba(COLORS.field, 0.35);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
  text('STATIC FIELD', W - 12, y - 8, { size: 8, align: 'right', color: COLORS.field, alpha: 0.6 });
}

function drawBreach() {
  const d = game.danger;
  const a = 0.22 + d * 0.55 * (0.5 + 0.5 * Math.sin(time * 10));
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = rgba(COLORS.danger, a);
  ctx.lineWidth = 1.5;
  line(0, BREACH_Y, W, BREACH_Y);
  ctx.restore();
  text('BREACH', 12, BREACH_Y - 6, { size: 8, align: 'left', color: COLORS.danger, alpha: Math.min(1, a + 0.2) });
}

function drawBeams() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of game.enemies) {
    if (!e.alive || !e.beam) continue;
    const b = e.beam;
    const x = e.x;
    const y0 = e.y + 16;
    if (b.state === 'charge') {
      const k = 1 - b.t / 1.15;
      ctx.strokeStyle = rgba(COLORS.danger, (0.2 + 0.6 * k) * (0.6 + 0.4 * Math.sin(time * 50)));
      ctx.lineWidth = 1 + k * 2.5;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 90;
      line(x, y0, x, H);
      ctx.setLineDash([]);
      const r = 4 + k * 11;
      const rg = ctx.createRadialGradient(x, y0, 0, x, y0, r);
      rg.addColorStop(0, 'rgba(255,255,255,0.95)');
      rg.addColorStop(0.4, rgba(COLORS.danger, 0.8));
      rg.addColorStop(1, rgba(COLORS.danger, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y0, r, 0, TAU); ctx.fill();
    } else {
      const y1 = b.blocked ? PLAYER_Y - 38 : H;
      const fade = Math.min(1, b.t / 0.12);
      const wob = Math.sin(time * 80) * 2;
      ctx.fillStyle = rgba(COLORS.danger, 0.25 * fade);
      ctx.fillRect(x - 14 - wob / 2, y0, 28 + wob, y1 - y0);
      ctx.fillStyle = rgba('#ff7a9a', 0.7 * fade);
      ctx.fillRect(x - 6, y0, 12, y1 - y0);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
      ctx.fillRect(x - 2, y0, 4, y1 - y0);
      const rg = ctx.createRadialGradient(x, y1, 0, x, y1, 30);
      rg.addColorStop(0, rgba(b.blocked ? COLORS.gold : COLORS.danger, 0.7 * fade));
      rg.addColorStop(1, rgba(COLORS.danger, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y1, 30, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

function drawHex(x, y, r, angle, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.strokeStyle = rgba(color, alpha * 0.35);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  const g = game;
  const f = g.formation;
  const warnBlink = g.flipWarn && Math.floor(time * 10) % 2 === 1;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const pol = warnBlink ? e.pol ^ 1 : e.pol;
    const frame = Math.floor(time * 2.2 + e.col * 0.37 + e.row * 0.5) % 2;
    drawSprite(sprites[e.type][pol][frame], e.x, e.y, f.angle, e.flash / 0.12);
    if (e.shield) drawHex(e.x, e.y, 24, f.angle, COLORS.pol[pol], 0.45 + 0.2 * Math.sin(time * 4 + e.phase));
    if (e === g.aggro) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(COLORS.danger, 0.55 + 0.3 * Math.sin(time * 12));
      ctx.lineWidth = 2;
      const rot = time * 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 10, rot + (i * Math.PI) / 2, rot + (i * Math.PI) / 2 + 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawCourier() {
  const c = game.courier;
  if (!c) return;
  drawSprite(sprites.courier[Math.floor(time * 6) % 2], c.x, c.y, 0, c.flash / 0.12);
}

function drawPickups() {
  for (const k of game.pickups) {
    const y = k.y + Math.sin(k.t * 6) * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(k.x, y, 0, k.x, y, 26);
    rg.addColorStop(0, rgba(COLORS.gold, 0.45));
    rg.addColorStop(1, rgba(COLORS.gold, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(k.x, y, 26, 0, TAU); ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(k.x, y, 13, 0, TAU); ctx.stroke();
    ctx.restore();
    text(POWERS[k.type].glyph, k.x, y + 5, { size: 13, weight: 900, color: '#ffffff' });
  }
}

function drawShots() {
  const g = game;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const s of g.shots) {
    const c = s.neutral ? COLORS.gold : COLORS.pol[s.pol];
    const tx = s.x - s.vx * 0.022;
    const ty = s.y - s.vy * 0.022;
    ctx.strokeStyle = rgba(c, 0.35);
    ctx.lineWidth = 7;
    line(s.x, s.y, tx, ty);
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    line(s.x, s.y, tx, ty);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    line(s.x, s.y, (s.x + tx) / 2, (s.y + ty) / 2);
  }
  for (const r of g.ricochets) {
    ctx.strokeStyle = rgba(COLORS.pol[r.pol], (r.life / 0.5) * 0.6);
    ctx.lineWidth = 2;
    line(r.x, r.y, r.x - r.vx * 0.03, r.y - r.vy * 0.03);
  }
  ctx.restore();
}

function drawEnemyBullets() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of game.ebullets) {
    const c = b.aimed ? COLORS.danger : COLORS.amber;
    ctx.fillStyle = rgba(c, 0.28);
    ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(time * 8);
    ctx.fillStyle = c;
    ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, 1.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawPlayer() {
  const g = game;
  const p = g.player;
  if (!p.alive) return;
  const col = COLORS.pol[p.pol];
  const blink = p.invuln > 0 && Math.floor(time * 16) % 2 === 0;

  if (g.power) {
    const fading = g.power.time < 3 && Math.floor(time * 8) % 2 === 0;
    const pa = fading ? 0.35 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (g.power.type === 'aegis') {
      const rg = ctx.createRadialGradient(p.x, PLAYER_Y - 2, 20, p.x, PLAYER_Y - 2, 38);
      rg.addColorStop(0, rgba(COLORS.gold, 0));
      rg.addColorStop(1, rgba(COLORS.gold, 0.22 * pa));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(p.x, PLAYER_Y - 2, 38, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(COLORS.gold, 0.7 * pa);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = time * 1.5 + (i * TAU) / 6;
        ctx.beginPath(); ctx.arc(p.x, PLAYER_Y - 2, 37, a, a + 0.7); ctx.stroke();
      }
    } else if (g.power.type === 'spread') {
      ctx.strokeStyle = rgba(col, 0.9 * pa);
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(p.x + s * 24, PLAYER_Y - 10);
        ctx.lineTo(p.x + s * 29, PLAYER_Y + 4);
        ctx.lineTo(p.x + s * 19, PLAYER_Y + 4);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (g.power.type === 'gunner') {
      const d = dronePos();
      const rg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 14);
      rg.addColorStop(0, rgba('#ffffff', 0.9 * pa));
      rg.addColorStop(0.35, rgba(COLORS.gold, 0.7 * pa));
      rg.addColorStop(1, rgba(COLORS.gold, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(d.x, d.y, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(COLORS.gold, 0.8 * pa);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(d.x, d.y, 8, time * 4, time * 4 + 4.5); ctx.stroke();
    }
    ctx.restore();
  }

  if (blink) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flame = rand(9, 17);
  ctx.fillStyle = rgba(col, 0.6);
  ctx.beginPath();
  ctx.moveTo(p.x - 5, PLAYER_Y + 13);
  ctx.lineTo(p.x + 5, PLAYER_Y + 13);
  ctx.lineTo(p.x, PLAYER_Y + 13 + flame);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(p.x - 2, PLAYER_Y + 13);
  ctx.lineTo(p.x + 2, PLAYER_Y + 13);
  ctx.lineTo(p.x, PLAYER_Y + 13 + flame * 0.5);
  ctx.closePath();
  ctx.fill();
  if (p.heat > 30) {
    const rg = ctx.createRadialGradient(p.x, PLAYER_Y - 18, 0, p.x, PLAYER_Y - 18, 14);
    rg.addColorStop(0, rgba(COLORS.danger, (p.heat / 100) * 0.6));
    rg.addColorStop(1, rgba(COLORS.danger, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(p.x, PLAYER_Y - 18, 14, 0, TAU); ctx.fill();
  }
  if (p.swapFx > 0) {
    const k = 1 - p.swapFx / 0.35;
    ctx.strokeStyle = rgba(col, 1 - k);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, PLAYER_Y, 18 + k * 34, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  drawSprite(sprites.player[p.pol], p.x, PLAYER_Y, p.tilt * 0.18);
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.restore();
}

function drawPopups() {
  for (const p of game.popups) {
    text(p.text, p.x, p.y, { size: p.size, color: p.color, alpha: Math.min(1, (p.life / p.max) * 1.6), weight: 900 });
  }
}

function drawWorld() {
  const g = game;
  ctx.save();
  if (g.shake > 0.2 && settings.shake) ctx.translate(rand(-1, 1) * g.shake, rand(-1, 1) * g.shake);
  if (!g.clearing) drawField();
  drawBreach();
  drawBeams();
  drawEnemies();
  drawCourier();
  drawPickups();
  drawShots();
  drawEnemyBullets();
  drawPlayer();
  drawParticles();
  drawPopups();
  ctx.restore();
}

function polarityGlyph(x, y, pol, size) {
  ctx.save();
  ctx.fillStyle = COLORS.pol[pol];
  ctx.shadowColor = COLORS.pol[pol];
  ctx.shadowBlur = 8;
  ctx.beginPath();
  if (pol === 0) ctx.arc(x, y, size, 0, TAU);
  else { ctx.moveTo(x, y - size * 1.3); ctx.lineTo(x + size * 1.3, y); ctx.lineTo(x, y + size * 1.3); ctx.lineTo(x - size * 1.3, y); ctx.closePath(); }
  ctx.fill();
  ctx.restore();
}

function drawHUD() {
  const g = game;
  const p = g.player;
  const dim = rgba(COLORS.white, 0.5);

  text('SCORE', 16, 16, { size: 9, align: 'left', color: dim, spacing: 2 });
  text(String(g.score).padStart(7, '0'), 16, 36, { size: 17, align: 'left', glow: 6 });
  text('HI', W - 16, 16, { size: 9, align: 'right', color: dim, spacing: 2 });
  text(String(Math.max(hiScore, g.score)).padStart(7, '0'), W - 16, 36, { size: 17, align: 'right', color: rgba(COLORS.white, 0.8) });

  if (g.chain > 0) {
    const m = mult();
    text(`CHAIN ${g.chain}`, W / 2, 14, { size: 9, color: dim, spacing: 2 });
    text(`x${m}`, W / 2, 36, { size: 20 + g.multPulse * 20, weight: 900, color: m > 1 ? COLORS.gold : COLORS.white, glow: m > 1 ? 12 : 0 });
    ctx.fillStyle = rgba(COLORS.white, 0.12);
    ctx.fillRect(W / 2 - 45, 42, 90, 3);
    ctx.fillStyle = m > 1 ? COLORS.gold : COLORS.white;
    ctx.fillRect(W / 2 - 45, 42, 90 * clamp(g.comboTimer / COMBO_TIME, 0, 1), 3);
  }

  if (g.flipWarn && Math.floor(time * 8) % 2 === 0) {
    text('POLARITY SHIFT', W / 2, 64, { size: 12, weight: 900, color: COLORS.pol[Math.floor(time * 16) % 2], glow: 10, spacing: 2 });
  }

  for (let i = 0; i < g.lives; i++) ctx.drawImage(sprites.player[0], 8 + i * 24, 752, 30, 30);

  const bx = W / 2 - 90;
  const by = 772;
  const bw = 180;
  const hot = p.overheated;
  text(hot ? 'OVERHEAT' : 'HEAT', W / 2, 764, { size: 9, color: hot ? COLORS.danger : dim, alpha: hot && Math.floor(time * 8) % 2 ? 0.4 : 1, spacing: 2 });
  ctx.fillStyle = rgba(COLORS.white, 0.1);
  ctx.fillRect(bx, by, bw, 7);
  ctx.fillStyle = hot || p.heat > 85 ? COLORS.danger : p.heat > 60 ? COLORS.amber : COLORS.pol[p.pol];
  ctx.fillRect(bx, by, bw * (p.heat / 100), 7);
  polarityGlyph(bx - 14, by + 3.5, p.pol, 4.5);

  text(`WAVE ${g.wave}`, W - 16, 786, { size: 12, align: 'right', color: rgba(COLORS.white, 0.8) });
  if (g.power) {
    text(POWERS[g.power.type].label, W - 16, 758, { size: 10, align: 'right', color: COLORS.gold, weight: 900 });
    ctx.fillStyle = rgba(COLORS.gold, 0.2);
    ctx.fillRect(W - 86, 764, 70, 3);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(W - 86, 764, 70 * (g.power.time / POWER_TIME), 3);
  }
}

function drawBanner() {
  const b = game.banner;
  if (!b) return;
  const a = clamp(Math.min(b.t / 0.25, (b.dur - b.t) / 0.4), 0, 1);
  text(b.text, W / 2, H * 0.46, { size: 40, weight: 900, color: b.color, glow: 18, alpha: a, spacing: 3 });
  text(b.sub, W / 2, H * 0.46 + 32, { size: 12, alpha: a * 0.85, spacing: 2 });
}

function dimScreen(a) {
  ctx.fillStyle = `rgba(5,3,15,${a})`;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle() {
  const bob = Math.sin(time * 2) * 3;
  text('SPACE', W / 2, 112 + bob, { size: 56, weight: 900, color: COLORS.pol[0], glow: 22, spacing: 6 });
  text('INVADERS', W / 2, 170 + bob, { size: 56, weight: 900, color: COLORS.pol[1], glow: 22, spacing: 6 });
  text('— POLARITY —', W / 2, 206, { size: 14, weight: 700, color: COLORS.white, spacing: 6, alpha: 0.85 });

  const f = Math.floor(time * 2) % 2;
  const parade = [sprites.darter[0][f], sprites.warden[1][f], sprites.lancer[0][f], sprites.courier[Math.floor(time * 6) % 2]];
  parade.forEach((img, i) => {
    const x = W / 2 + (i - 1.5) * 76;
    const y = 250 + Math.sin(time * 2.4 + i * 1.1) * 5;
    ctx.drawImage(img, x - 26, y - 26, 52, 52);
  });

  if (!isTouch) {
    const hint = `MOVE ${bindLabel('left')} ${bindLabel('right')}   FIRE ${bindLabel('fire')}   SWAP ${bindLabel('swap')}`;
    text(hint, W / 2, 660, { size: 10, color: rgba(COLORS.white, 0.6), spacing: 1 });
    text(`PAUSE ${bindLabel('pause')}   MUTE ${bindLabel('mute')}   ·   ARROWS + ENTER TO NAVIGATE`, W / 2, 680, { size: 9, color: rgba(COLORS.white, 0.4), spacing: 1 });
  }
  text(`HI ${String(hiScore).padStart(7, '0')}`, 16, 786, { size: 10, align: 'left', color: rgba(COLORS.white, 0.55) });
  text(`v${VERSION}`, W - 16, 786, { size: 10, align: 'right', color: rgba(COLORS.white, 0.4) });
}

function drawGameOver() {
  const g = game;
  dimScreen(Math.min(0.8, modeTimer));
  text('GAME OVER', W / 2, 300, { size: 48, weight: 900, color: COLORS.danger, glow: 22, spacing: 4 });
  text(String(g.score).padStart(7, '0'), W / 2, 360, { size: 30, weight: 900, glow: 10 });
  if (newHi && Math.floor(time * 3) % 2 === 0) text('NEW HIGH SCORE', W / 2, 392, { size: 13, color: COLORS.gold, glow: 10, spacing: 3 });
  const acc = g.stats.shots ? Math.round((g.stats.hits / g.stats.shots) * 100) : 0;
  const stats = [['WAVE', g.wave], ['BEST CHAIN', g.bestChain], ['ACCURACY', `${acc}%`]];
  stats.forEach(([k, v], i) => {
    const x = W / 2 + (i - 1) * 150;
    text(k, x, 440, { size: 9, color: rgba(COLORS.white, 0.5), spacing: 2 });
    text(String(v), x, 464, { size: 18 });
  });
}

function render() {
  const k = view.scale * view.dpr;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(bg, 0, 0, W, H);
  drawStars();
  if (mode === 'menu' || !game) {
    drawTitle();
    return;
  }
  drawWorld();
  drawHUD();
  if (game.flash > 0 && settings.flashes) {
    ctx.fillStyle = rgba(game.flashColor, Math.min(0.35, game.flash * 0.6));
    ctx.fillRect(0, 0, W, H);
  }
  drawBanner();
  if (mode === 'paused') dimScreen(0.6);
  if (mode === 'gameover') drawGameOver();
}

const ui = createUI({ root: uiRoot, sprites, onAction: handleAction, onSettingsChanged: handleSettingsChanged });
ui.show('main');

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
