/* King of Bonk — fight sounds, synthesised with the kit's Kit.sound.tone / hiss (so mute and volume are shared).
   Kit.sound already has punch (a bonk), swish (basketball net), jump, land and click; the rest are here.
   Kit candidates: bonk, whoosh, block, bell, fanfare, boing. */
(function () {
  'use strict';
  const S = () => window.Kit.sound;

  const sfx = {
    // a landed blow: the kit's bonk, plus a squeaky toy for big ones
    hit(big) {
      S().punch();
      if (big) {
        S().tone({ type: 'square', f: 900, to: 300, dur: 0.18, vol: 0.06, lp: 2400, at: 0.02 });
        S().tone({ f: 120, to: 50, dur: 0.25, vol: 0.35 });
      }
    },
    // the wooden "bonk" of a KO, then a cuckoo-ish double tweet
    bonk() {
      S().tone({ type: 'triangle', f: 520, to: 180, dur: 0.22, vol: 0.35 });
      S().tone({ f: 180, to: 60, dur: 0.3, vol: 0.3, at: 0.02 });
      [1568, 1319, 1568, 1319].forEach((f, i) => S().tone({ type: 'sine', f, dur: 0.1, vol: 0.08, at: 0.35 + i * 0.12 }));
    },
    whoosh(big) { S().hiss({ f: big ? 900 : 1600, to: big ? 300 : 700, q: 1.4, dur: big ? 0.25 : 0.12, vol: big ? 0.2 : 0.1 }); },
    block() {
      S().tone({ type: 'triangle', f: 330, to: 260, dur: 0.08, vol: 0.18 });
      S().hiss({ filter: 'highpass', f: 3500, dur: 0.06, vol: 0.08 });
    },
    boing() { S().tone({ type: 'sine', f: 220, to: 660, dur: 0.18, vol: 0.12 }); },
    land() { S().land(); },
    down() {
      S().tone({ f: 110, to: 45, dur: 0.25, vol: 0.35 });
      S().hiss({ filter: 'lowpass', f: 900, to: 200, dur: 0.25, vol: 0.2 });
    },
    // boxing-ring bell: ding ding ding
    bell(n = 1) {
      for (let i = 0; i < n; i++) {
        const at = i * 0.32;
        S().tone({ type: 'sine', f: 1318, dur: 0.7, vol: 0.12, at });
        S().tone({ type: 'sine', f: 1975, dur: 0.5, vol: 0.05, at });
        S().tone({ type: 'triangle', f: 659, dur: 0.6, vol: 0.06, at });
      }
    },
    round() { [392, 523].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.18, vol: 0.06, lp: 2200, at: i * 0.14 })); },
    fight() {
      S().bump();
      [523, 659, 784, 1047].forEach((f, i) => S().tone({ type: 'square', f, dur: 0.12, vol: 0.06, lp: 2600, at: i * 0.06 }));
    },
    fanfare() {
      [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.65], [1047, 0.8]].forEach(([f, at]) => {
        S().tone({ type: 'square', f, dur: 0.22, vol: 0.06, lp: 2600, at });
        S().tone({ type: 'triangle', f: f / 2, dur: 0.25, vol: 0.1, at });
      });
    },
    special(kind) {
      switch (kind) {
        case 'jumpshot': S().jump(); break;
        case 'peace': S().powerup(); break;
        case 'dash': S().board(); break;
        case 'moon': S().hiss({ f: 1200, to: 2400, q: 3, dur: 0.4, vol: 0.12 }); break;
        case 'zap': S().tone({ type: 'sawtooth', f: 200, to: 1600, dur: 0.35, vol: 0.06, lp: 3000 }); break;
        case 'slam': S().tone({ type: 'square', f: 180, to: 520, dur: 0.3, vol: 0.06, lp: 1500 }); break;
        case 'boo':
          S().tone({ type: 'sawtooth', f: 140, to: 90, dur: 0.5, vol: 0.1, lp: 700 });
          S().tone({ type: 'square', f: 230, to: 110, dur: 0.35, vol: 0.1, lp: 1500, at: 0.25 });
          break;
      }
    },
    swish() { S().swish(); },
    click() { S().click(); },
    clash() {
      S().tone({ type: 'square', f: 1200, to: 400, dur: 0.12, vol: 0.06, lp: 3000 });
      S().hiss({ filter: 'highpass', f: 2000, dur: 0.12, vol: 0.1 });
    },
    cheer() {
      S().hiss({ f: 1400, to: 1800, q: 0.6, dur: 1.4, vol: 0.12, attack: 0.15 });
      S().powerup();
    },
  };

  window.KofSfx = sfx;
})();
