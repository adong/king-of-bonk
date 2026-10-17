/* King of Bonk — controls: the keyboard for one or two players, and on-screen buttons for touch.
   Presses are latched until the engine's next frame reads them, so a tap shorter than one frame still counts.
   P1: A D walk, W jump, S crouch, F punch, G kick, H special, R block (or hold back), T companion.
   P2: arrows, J punch, K kick, L special, I block, Enter companion (numpad 1 2 3 0 work too).
   In 1-player mode both sets drive P1. */
(function () {
  'use strict';

  const KEYS = {
    KeyA: [0, 'left'], KeyD: [0, 'right'], KeyW: [0, 'up'], KeyS: [0, 'down'],
    KeyF: [0, 'p'], KeyG: [0, 'k'], KeyH: [0, 's'], KeyR: [0, 'block'], KeyT: [0, 'c'],
    ArrowLeft: [1, 'left'], ArrowRight: [1, 'right'], ArrowUp: [1, 'up'], ArrowDown: [1, 'down'],
    KeyJ: [1, 'p'], KeyK: [1, 'k'], KeyL: [1, 's'], KeyI: [1, 'block'], Enter: [1, 'c'], NumpadEnter: [1, 'c'],
    Numpad1: [1, 'p'], Numpad2: [1, 'k'], Numpad3: [1, 's'], Numpad0: [1, 'block'],
  };
  const PRESS = { p: 1, k: 1, s: 1, c: 1 };

  // key sources: [player][source] so a key released on one set doesn't cancel the same action held on another
  const held = [{}, {}];
  const latched = [{}, {}];
  const touch = { left: false, right: false, up: false, down: false, block: false };
  let twoPlayer = false;

  function setKey(code, down, repeat) {
    const m = KEYS[code];
    if (!m) return false;
    const [side, act] = m;
    if (PRESS[act]) {
      if (down && !repeat) latched[side][act] = true;
    } else held[side][act + ':' + code] = down;
    return true;
  }

  function heldAct(side, act) {
    for (const k in held[side]) if (held[side][k] && k.startsWith(act + ':')) return true;
    return false;
  }

  // The input for one engine frame. Clears the latched presses it reports.
  function snapshot(side) {
    const srcs = side === 0 && !twoPlayer ? [0, 1] : [side];
    const out = { left: false, right: false, up: false, down: false, block: false, p: false, k: false, s: false, c: false };
    for (const s of srcs) {
      for (const a of ['left', 'right', 'up', 'down', 'block']) if (heldAct(s, a)) out[a] = true;
      for (const a in PRESS) {
        if (latched[s][a]) out[a] = true;
        latched[s][a] = false;
      }
    }
    if (side === 0) {
      for (const a in touch) if (touch[a]) out[a] = true;
      for (const a in PRESS) {
        if (touchLatched[a]) out[a] = true;
        touchLatched[a] = false;
      }
    }
    return out;
  }

  function clear() {
    for (const s of [0, 1]) {
      for (const k in held[s]) held[s][k] = false;
      for (const k in latched[s]) latched[s][k] = false;
    }
    for (const a in touch) touch[a] = false;
    for (const a in touchLatched) touchLatched[a] = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (setKey(e.code, true, e.repeat) && e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => setKey(e.code, false, false));
  window.addEventListener('blur', clear);

  // ---------------------------------------------------------------- touch

  const touchLatched = {};

  // A round pad on the left (slide your thumb around it) and four buttons on the right.
  function bindTouch(pad, buttons) {
    const zone = (e) => {
      const r = pad.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      touch.left = dx < -0.35;
      touch.right = dx > 0.35;
      touch.up = dy < -0.45;
      touch.down = dy > 0.45;
      pad.dataset.dir = (touch.up ? 'u' : touch.down ? 'd' : '') + (touch.left ? 'l' : touch.right ? 'r' : '');
    };
    let finger = null; // the pointer steering the pad, so a second thumb on the buttons doesn't move it
    const capture = (el, e) => {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* not an active pointer (synthetic events) */ }
    };
    const release = (e) => {
      if (e.pointerId !== finger) return;
      finger = null;
      touch.left = touch.right = touch.up = touch.down = false;
      pad.dataset.dir = '';
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      finger = e.pointerId;
      capture(pad, e);
      zone(e);
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId === finger) zone(e);
    });
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    for (const b of buttons) {
      const act = b.dataset.act;
      const up = () => {
        if (act === 'block') touch.block = false;
        b.classList.remove('down');
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capture(b, e);
        if (act === 'block') touch.block = true;
        else touchLatched[act] = true;
        b.classList.add('down');
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
  }

  window.KofInput = {
    snapshot, clear, bindTouch, KEYS,
    setTwoPlayer(on) { twoPlayer = !!on; },
  };
})();
