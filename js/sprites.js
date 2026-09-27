// Neon vector sprites, pre-rendered once to offscreen canvases so gameplay frames never pay for shadowBlur.
export const COLORS = {
  pol: ['#29e7ff', '#ff3df2'],
  gold: '#ffd84a',
  danger: '#ff3b4e',
  amber: '#ffae34',
  field: '#b18cff',
  white: '#f4f0ff',
};

export const SPR = 80;

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function makeCanvas(res) {
  const c = document.createElement('canvas');
  c.width = c.height = SPR * res;
  const g = c.getContext('2d');
  g.scale(res, res);
  g.translate(SPR / 2, SPR / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return [c, g];
}

function poly(g, pts) {
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}

function neon(g, color, build, { fill = 0.16, width = 2.4, blur = 10 } = {}) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.fillStyle = rgba(color, fill);
  g.beginPath();
  build(g);
  if (fill > 0) g.fill();
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,0.72)';
  g.lineWidth = width * 0.38;
  g.beginPath();
  build(g);
  g.stroke();
  g.restore();
}

// Polarity 0 has a round core, polarity 1 a diamond core, so the rule never relies on color alone.
function core(g, pol, x, y, color, size = 1) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.beginPath();
  if (pol === 0) g.arc(x, y, 3.4 * size, 0, Math.PI * 2);
  else poly(g, [x, y - 4.8 * size, x + 4.8 * size, y, x, y + 4.8 * size, x - 4.8 * size, y]);
  g.fill();
  g.restore();
}

function darter(res, pol, frame) {
  const [c, g] = makeCanvas(res);
  const col = COLORS.pol[pol];
  const pts = frame === 0
    ? [0, 15, 7, 2, 18, -4, 10, -10, 0, -4, -10, -10, -18, -4, -7, 2]
    : [0, 15, 7, 2, 16, -13, 8, -9, 0, -4, -8, -9, -16, -13, -7, 2];
  neon(g, col, (p) => poly(p, pts));
  neon(g, col, (p) => { p.moveTo(-4, -6); p.lineTo(-6, -15); p.moveTo(4, -6); p.lineTo(6, -15); }, { fill: 0, width: 1.6 });
  core(g, pol, 0, 2, col);
  return c;
}

function warden(res, pol, frame) {
  const [c, g] = makeCanvas(res);
  const col = COLORS.pol[pol];
  const hex = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    hex.push(Math.cos(a) * 13, Math.sin(a) * 13);
  }
  neon(g, col, (p) => poly(p, hex));
  const spread = frame === 0 ? 5 : 1;
  neon(g, col, (p) => {
    p.moveTo(-7, 11); p.lineTo(-7 - spread, 19);
    p.moveTo(7, 11); p.lineTo(7 + spread, 19);
    p.moveTo(-9, -15); p.lineTo(9, -15);
  }, { fill: 0, width: 1.8 });
  core(g, pol, 0, 0, col, frame === 0 ? 1.15 : 0.9);
  return c;
}

function lancer(res, pol, frame) {
  const [c, g] = makeCanvas(res);
  const col = COLORS.pol[pol];
  neon(g, col, (p) => poly(p, [-16, -8, 16, -8, 10, 6, -10, 6]));
  neon(g, col, (p) => poly(p, [-3.5, 6, 3.5, 6, 2.5, 17, -2.5, 17]), { fill: 0.3 });
  const tip = frame === 0 ? 17 : 14;
  neon(g, col, (p) => {
    p.moveTo(-9, -8); p.lineTo(-13, -tip);
    p.moveTo(9, -8); p.lineTo(13, -tip);
  }, { fill: 0, width: 1.6 });
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(-13, -tip, 1.8, 0, Math.PI * 2); g.arc(13, -tip, 1.8, 0, Math.PI * 2); g.fill();
  core(g, pol, 0, -1, col);
  return c;
}

function courier(res, frame) {
  const [c, g] = makeCanvas(res);
  const col = COLORS.gold;
  neon(g, col, (p) => p.ellipse(0, 3, 26, 8, 0, 0, Math.PI * 2), { fill: 0.2 });
  neon(g, col, (p) => { p.moveTo(-11, -1); p.arc(0, -1, 11, Math.PI, 0); }, { fill: 0.12, width: 2 });
  for (let i = 0; i < 4; i++) {
    const on = (i + frame) % 2 === 0;
    g.fillStyle = on ? '#ffffff' : rgba(col, 0.5);
    g.beginPath(); g.arc(-15 + i * 10, 4, on ? 2.2 : 1.6, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function player(res, pol) {
  const [c, g] = makeCanvas(res);
  const col = COLORS.pol[pol];
  neon(g, col, (p) => poly(p, [0, -21, 6, -7, 9, -2, 19, 8, 19, 13, 7, 10, 4, 14, -4, 14, -7, 10, -19, 13, -19, 8, -9, -2, -6, -7]), { fill: 0.22, width: 2.6, blur: 12 });
  neon(g, col, (p) => { p.moveTo(-13, 6); p.lineTo(-13, 12); p.moveTo(13, 6); p.lineTo(13, 12); }, { fill: 0, width: 1.4 });
  core(g, pol, 0, 1, col, 1.1);
  return c;
}

export function buildSprites(res) {
  const byPol = (fn) => [0, 1].map((pol) => [0, 1].map((f) => fn(res, pol, f)));
  return {
    darter: byPol(darter),
    warden: byPol(warden),
    lancer: byPol(lancer),
    courier: [0, 1].map((f) => courier(res, f)),
    player: [0, 1].map((pol) => player(res, pol)),
  };
}
