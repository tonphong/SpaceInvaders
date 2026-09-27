// HTML menus layered over the canvas: main menu, wave select, how-to-play, settings, pause and game over.
import {
  settings, saveSettings, ACTIONS, DIFFICULTIES, keyLabel, bindLabel,
  setBind, clearBind, resetBinds, progress, resetProgress,
} from './settings.js';
import { applyVolumes, sfx } from './audio.js';

const TOUCH_MODES = { auto: 'AUTO', on: 'ON', off: 'OFF' };
const GRID_COLS = 5;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

export function createUI({ root, sprites, onAction, onSettingsChanged }) {
  const panels = {};
  root.querySelectorAll('.panel').forEach((p) => { panels[p.dataset.panel] = p; });
  const fill = (name) => root.querySelector(`[data-fill="${name}"]`);
  const context = { retryWave: 1 };
  let stack = [];
  let capture = null;
  let resetArmed = 0;

  const icon = {};
  const spriteURL = (key, img) => (icon[key] ||= img.toDataURL());

  function current() { return stack[stack.length - 1] || null; }

  function show(name, { push = false } = {}) {
    if (!push) stack = [];
    if (name) stack.push(name);
    render();
  }

  function render(keepFocus = false) {
    const cur = current();
    for (const [k, p] of Object.entries(panels)) p.classList.toggle('active', k === cur);
    if (!cur) {
      if (root.contains(document.activeElement)) document.activeElement.blur();
      return;
    }
    const fid = keepFocus ? document.activeElement?.dataset?.fid : null;
    const scroller = panels[cur].querySelector('.scroll');
    const scrollTop = scroller?.scrollTop ?? 0;
    refresh(cur);
    if (scroller) scroller.scrollTop = scrollTop;
    const target = (fid && panels[cur].querySelector(`[data-fid="${fid}"]`)) || focusables(panels[cur])[0];
    target?.focus({ preventScroll: keepFocus });
  }

  function back() {
    capture = null;
    if (stack.length > 1) { stack.pop(); render(); return; }
    if (current() === 'pause') onAction('resume');
  }

  function refresh(name) {
    if (name === 'main') {
      const cont = panels.main.querySelector('[data-label="continue"]');
      cont.textContent = progress.unlocked > 1 ? `CONTINUE · WAVE ${progress.unlocked}` : 'PLAY';
      panels.main.querySelector('[data-label="new"]').hidden = progress.unlocked <= 1;
    } else if (name === 'over') {
      panels.over.querySelector('[data-label="retry"]').textContent = `RETRY · WAVE ${context.retryWave}`;
    } else if (name === 'waves') {
      buildWaves();
    } else if (name === 'help') {
      buildHelp();
    } else if (name === 'settings') {
      buildSettings();
    }
  }

  // ---------- wave select ----------

  function buildWaves() {
    const grid = fill('waves');
    const shown = Math.max(10, Math.ceil((progress.unlocked + 1) / GRID_COLS) * GRID_COLS);
    const buttons = [];
    for (let n = 1; n <= shown; n++) {
      const locked = n > progress.unlocked;
      const cleared = n < progress.unlocked;
      const tag = locked ? 'LOCKED' : cleared ? 'CLEARED' : 'NEXT';
      buttons.push(el('button', {
        class: `btn${cleared ? ' cleared' : ''}${!locked && !cleared ? ' next' : ''}`,
        type: 'button',
        disabled: locked,
        'data-fid': `wave-${n}`,
        'aria-label': `Wave ${n}, ${tag.toLowerCase()}`,
        onclick: () => onAction('start', { wave: n }),
      }, String(n), el('small', { text: tag })));
    }
    grid.replaceChildren(...buttons);
  }

  // ---------- how to play ----------

  function buildHelp() {
    const f = Math.floor(performance.now() / 500) % 2;
    const enemies = [
      ['darter', sprites.darter[0][f], 'DARTER', '20', 'Evasive. Sidesteps your shots.', 'var(--cyan)'],
      ['warden', sprites.warden[1][f], 'WARDEN', '40', 'Shielded. Takes two hits.', 'var(--magenta)'],
      ['lancer', sprites.lancer[0][f], 'LANCER', '60', 'Charges a telegraphed beam.', 'var(--cyan)'],
      ['courier', sprites.courier[0], 'COURIER', '150', 'Destroy it for a drone power-up.', '#ffd84a'],
    ];
    const rules = [
      ['Polarity', 'Shots only damage enemies that match your ship (● cyan / ◆ magenta). Swap any time. From wave 3 the formation periodically shifts polarity.'],
      ['Heat', 'Each shot builds heat. Overheat and your gun locks until it fully cools.'],
      ['Chains', 'Kills within 2.4 s build a chain. Every 4 kills adds +1 to the multiplier (max ×8). A missed or deflected shot breaks it.'],
      ['Static field', 'The crackling field pushes the formation down. If an enemy crosses the red breach line you lose a life.'],
      ['Aggro', 'The enemy closest to you (red ring) fires aimed shots. Take it out first.'],
      ['Courier drops', 'Catch the capsule for 12 s of Spread (extra shots), Aegis (shield bubble) or Gunner (auto-firing drone).'],
      ['Progress', 'Clearing a wave unlocks it for good. If you lose, retry from the same wave, or pick any wave from Wave Select.'],
    ];
    const controls = [
      ['Move', `${bindLabel('left')}  ·  ${bindLabel('right')}`],
      ['Fire (hold)', bindLabel('fire')],
      ['Swap polarity', bindLabel('swap')],
      ['Pause', bindLabel('pause')],
      ['Mute', bindLabel('mute')],
      ['Touch', 'Drag the pad or playfield · hold FIRE · tap SWAP'],
    ];
    fill('help').replaceChildren(
      el('div', { class: 'section-title', text: 'ENEMIES' }),
      ...enemies.map(([key, img, name, pts, desc, color]) => el('div', { class: 'help-enemy' },
        el('img', { src: spriteURL(key, img), alt: '' }),
        el('div', {}, el('b', { text: name, style: `color:${color}` }), el('span', { text: desc })),
        el('div', { class: 'pts', text: `${pts} PTS` }))),
      el('div', { class: 'section-title', text: 'RULES' }),
      el('ul', { class: 'help-list' }, rules.map(([k, v]) => el('li', {}, el('b', { text: `${k}: ` }), v))),
      el('div', { class: 'section-title', text: 'CONTROLS' }),
      ...controls.map(([k, v]) => el('div', { class: 'row' }, el('span', { class: 'label', text: k }), el('span', { class: 'val', text: v }))),
    );
  }

  // ---------- settings ----------

  function changed(key) {
    saveSettings();
    onSettingsChanged(key);
    render(true);
  }

  function slider(id, label, key, note, onCommit) {
    const val = el('span', { class: 'val', text: `${Math.round(settings[key] * 100)}%` });
    const input = el('input', {
      type: 'range', min: 0, max: 100, step: 5, value: Math.round(settings[key] * 100), id, 'data-fid': id,
      oninput: (e) => {
        settings[key] = Number(e.target.value) / 100;
        val.textContent = `${e.target.value}%`;
        applyVolumes();
      },
      onchange: () => { saveSettings(); onCommit?.(); },
    });
    return el('div', { class: 'row' },
      el('label', { for: id }, label, note && el('span', { class: 'note', text: note })),
      el('div', { class: 'ctl' }, input, val));
  }

  function toggle(id, label, key, note) {
    return el('div', { class: 'row' },
      el('span', { class: 'label' }, label, note && el('span', { class: 'note', text: note })),
      el('button', {
        class: `chip${settings[key] ? ' on' : ''}`, type: 'button', 'data-fid': id,
        'aria-pressed': String(settings[key]),
        onclick: () => { settings[key] = !settings[key]; sfx.ui(); changed(key); },
      }, settings[key] ? 'ON' : 'OFF'));
  }

  function cycle(id, label, key, options, note) {
    const keys = Object.keys(options);
    return el('div', { class: 'row' },
      el('span', { class: 'label' }, label, note && el('span', { class: 'note', text: note })),
      el('button', {
        class: 'chip on', type: 'button', 'data-fid': id,
        onclick: () => {
          settings[key] = keys[(keys.indexOf(settings[key]) + 1) % keys.length];
          sfx.ui();
          changed(key);
        },
      }, typeof options[settings[key]] === 'string' ? options[settings[key]] : options[settings[key]].label));
  }

  function keyRow({ id, label }) {
    const slots = [0, 1].map((slot) => {
      const code = settings.binds[id][slot];
      const isCap = capture && capture.action === id && capture.slot === slot;
      return el('button', {
        class: `key${code ? '' : ' empty'}${isCap ? ' capturing' : ''}`,
        type: 'button',
        'data-fid': `key-${id}-${slot}`,
        'aria-label': `${label} key ${slot + 1}: ${code ? keyLabel(code) : 'unbound'}`,
        onclick: () => {
          capture = isCap ? null : { action: id, slot };
          render(true);
        },
      }, isCap ? 'PRESS KEY' : keyLabel(code));
    });
    return el('div', { class: 'row' }, el('span', { class: 'label', text: label }), el('div', { class: 'ctl' }, slots));
  }

  function buildSettings() {
    const armed = performance.now() < resetArmed;
    fill('settings').replaceChildren(
      el('div', { class: 'section-title', text: 'AUDIO' }),
      slider('set-music', 'Music volume', 'music', null),
      slider('set-sfx', 'Sound effects', 'sfx', null, () => sfx.pickup()),
      toggle('set-duck', 'Duck music under effects', 'duck', 'Music dips briefly so effects cut through'),
      toggle('set-muted', 'Mute everything', 'muted'),
      el('div', { class: 'section-title', text: 'GAMEPLAY' }),
      cycle('set-diff', 'Difficulty', 'difficulty', DIFFICULTIES, 'Applies from the next wave'),
      toggle('set-shake', 'Screen shake', 'shake'),
      toggle('set-flash', 'Screen flashes', 'flashes'),
      cycle('set-touch', 'Touch controls', 'touch', TOUCH_MODES, 'Auto shows them on touch screens'),
      el('div', { class: 'section-title', text: 'KEYBOARD' }),
      el('p', { class: 'hint', text: 'Click a key, then press the new key. ESC cancels, BACKSPACE clears the slot.' }),
      ...ACTIONS.map(keyRow),
      el('div', { class: 'stack' },
        el('button', {
          class: 'btn', type: 'button', 'data-fid': 'reset-binds',
          onclick: () => { capture = null; resetBinds(); sfx.ui(); render(true); },
        }, 'RESET CONTROLS')),
      el('div', { class: 'section-title', text: 'PROGRESS' }),
      el('div', { class: 'row' },
        el('span', { class: 'label', text: 'Waves unlocked' }),
        el('span', { class: 'val', text: String(progress.unlocked) })),
      el('div', { class: 'stack' },
        el('button', {
          class: `btn danger${armed ? ' armed' : ''}`, type: 'button', 'data-fid': 'reset-progress',
          onclick: () => {
            if (performance.now() < resetArmed) {
              resetArmed = 0;
              resetProgress();
              onSettingsChanged('progress');
            } else {
              resetArmed = performance.now() + 3000;
              setTimeout(() => { if (current() === 'settings') render(true); }, 3050);
            }
            render(true);
          },
        }, armed ? 'TAP AGAIN TO CONFIRM' : 'RESET WAVE PROGRESS')),
    );
  }

  // ---------- events ----------

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || !root.contains(b)) return;
    const { action, target } = b.dataset;
    sfx.ui();
    if (action === 'open') show(target, { push: true });
    else if (action === 'back') back();
    else onAction(action);
  });

  function focusables(panel) {
    return [...panel.querySelectorAll('button, input')].filter((n) => !n.disabled && n.offsetParent !== null);
  }

  // Runs in the capture phase so menu keys never leak into gameplay input.
  window.addEventListener('keydown', (e) => {
    if (capture) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') capture = null;
      else if (e.code === 'Backspace' || e.code === 'Delete') { clearBind(capture.action, capture.slot); capture = null; }
      else { setBind(capture.action, capture.slot, e.code); capture = null; sfx.ui(); }
      render(true);
      return;
    }
    const cur = current();
    if (!cur) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      back();
      return;
    }
    if (cur === 'pause' && settings.binds.pause.includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      onAction('resume');
      return;
    }
    const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.code];
    if (!dir) return;
    const active = document.activeElement;
    const horizontal = e.code === 'ArrowLeft' || e.code === 'ArrowRight';
    if (active?.type === 'range' && horizontal) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const list = focusables(panels[cur]);
    let i = list.indexOf(active);
    const inGrid = active?.closest('.wave-grid');
    const step = inGrid && !horizontal ? GRID_COLS : 1;
    i = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + dir * step));
    list[i]?.focus();
    list[i]?.scrollIntoView({ block: 'nearest' });
  }, true);

  return { show, back, current, context, refresh: () => render(true) };
}
