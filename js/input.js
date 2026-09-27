// Unified keyboard + multi-touch input. Movement from touch is relative drag, so the finger never hides the ship.
const FIRE_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const SWAP_KEYS = ['KeyX', 'KeyK', 'ShiftLeft', 'ShiftRight', 'ArrowDown', 'KeyS'];
const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const BLOCK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export function createInput({ canvas, pad, fireBtn, swapBtn, pauseBtn, muteBtn, logicalWidth, getCanvasScale, onGesture, onTouch }) {
  const keys = new Set();
  const edges = { swap: false, pause: false, start: false, mute: false };
  const drags = new Map();
  const fireTouches = new Set();
  let drag = 0;

  window.addEventListener('keydown', (e) => {
    onGesture();
    if (BLOCK_KEYS.has(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (SWAP_KEYS.includes(e.code)) edges.swap = true;
    if (e.code === 'KeyP' || e.code === 'Escape') edges.pause = true;
    if (e.code === 'KeyM') edges.mute = true;
    if (e.code === 'Enter' || e.code === 'Space') edges.start = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); fireTouches.clear(); drags.clear(); });

  window.addEventListener('pointerdown', (e) => {
    onGesture();
    if (e.pointerType === 'touch') onTouch();
    edges.start = true;
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
    e.preventDefault();
    beginDrag(canvas, e, () => 1 / getCanvasScale());
  });
  pad?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    beginDrag(pad, e, () => (logicalWidth / pad.getBoundingClientRect().width));
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
  // Utility buttons must not also count as "tap to start/resume".
  pauseBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onGesture(); edges.pause = true; });
  muteBtn?.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onGesture(); edges.mute = true; });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  const any = (list) => list.some((k) => keys.has(k));
  return {
    get left() { return any(LEFT_KEYS); },
    get right() { return any(RIGHT_KEYS); },
    get fire() { return any(FIRE_KEYS) || fireTouches.size > 0; },
    takeDrag() { const d = drag; drag = 0; return d; },
    take(name) { const v = edges[name]; edges[name] = false; return v; },
    endFrame() { for (const k in edges) edges[k] = false; drag = 0; },
  };
}
