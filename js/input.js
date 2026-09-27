// Unified keyboard + multi-touch gameplay input. Keys come from the player's saved keybinds.
// Touch movement is relative drag, so the finger never hides the ship.
import { settings, actionForKey } from './settings.js';

export function createInput({ canvas, pad, fireBtn, swapBtn, pauseBtn, muteBtn, logicalWidth, getCanvasScale, onGesture, onTouch, isPlaying }) {
  const keys = new Set();
  const edges = { swap: false, pause: false, mute: false };
  const drags = new Map();
  const fireTouches = new Set();
  let drag = 0;

  window.addEventListener('keydown', (e) => {
    onGesture();
    const action = actionForKey(e.code);
    if (action && isPlaying()) e.preventDefault();
    keys.add(e.code);
    if (e.repeat || !action) return;
    if (action in edges) edges[action] = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); fireTouches.clear(); drags.clear(); });

  window.addEventListener('pointerdown', (e) => {
    onGesture();
    if (e.pointerType === 'touch') onTouch();
  });
  window.addEventListener('pointerup', onGesture);

  function beginDrag(el, e, factor) {
    drags.set(e.pointerId, { lastX: e.clientX, factor, el });
    el.classList.add('active');
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
  }
  function endPointer(e) {
    const d = drags.get(e.pointerId);
    if (d) { d.el.classList.remove('active'); drags.delete(e.pointerId); }
    if (fireTouches.delete(e.pointerId) && fireTouches.size === 0) fireBtn?.classList.remove('pressed');
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!isPlaying()) return;
    e.preventDefault();
    beginDrag(canvas, e, () => 1 / getCanvasScale());
  });
  pad?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    beginDrag(pad, e, () => logicalWidth / pad.getBoundingClientRect().width);
  });
  window.addEventListener('pointermove', (e) => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    drag += (e.clientX - d.lastX) * d.factor();
    d.lastX = e.clientX;
  });
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);

  fireBtn?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fireTouches.add(e.pointerId);
    fireBtn.classList.add('pressed');
    try { fireBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  swapBtn?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    edges.swap = true;
    swapBtn.classList.add('pressed');
  });
  swapBtn?.addEventListener('pointerup', () => swapBtn.classList.remove('pressed'));
  swapBtn?.addEventListener('pointerleave', () => swapBtn.classList.remove('pressed'));
  pauseBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); onGesture(); edges.pause = true; });
  muteBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); onGesture(); edges.mute = true; });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const held = (action) => settings.binds[action].some((k) => k && keys.has(k));
  return {
    get left() { return held('left'); },
    get right() { return held('right'); },
    get fire() { return held('fire') || fireTouches.size > 0; },
    takeDrag() { const d = drag; drag = 0; return d; },
    take(name) { const v = edges[name]; edges[name] = false; return v; },
    endFrame() { for (const k in edges) edges[k] = false; drag = 0; },
    releaseAll() { keys.clear(); fireTouches.clear(); fireBtn?.classList.remove('pressed'); },
  };
}
