/* King of Bonk — effects: comic POW bursts, flying stars, dust puffs, block shields, the projectiles' emoji sprites,
   dizzy stars over a KO'd head, and the basketball in Teddy's hands. Textures are painted once on canvases. */
(function () {
  'use strict';
  const T = THREE;
  let scene, G;
  const live = [];
  const burstCache = {};
  const projSprites = new Map(); // projectile id -> { group, kind, parts }

  // Burst colours per word: [outer, inner, text]
  const STYLE = {
    'POW!': ['#ffd400', '#ff8a1f', '#e8203a'], 'BAM!': ['#ffd400', '#ff8a1f', '#e8203a'], 'WHAM!': ['#ff8a1f', '#ffd400', '#7a1fd1'],
    'BOP!': ['#ffe14d', '#ffffff', '#1f6fe0'], 'BIP!': ['#ffe14d', '#ffffff', '#1f6fe0'], 'BONK!': ['#ff5aa0', '#ffd400', '#ffffff'],
    'KAPOW!': ['#ff3d3d', '#ffd400', '#ffffff'], 'ZAP!': ['#5ef2ff', '#ffffff', '#1f4fe0'], 'SWISH!': ['#ff8a1f', '#ffd400', '#ffffff'],
    'PEACE!': ['#ff9fd0', '#fff2a8', '#b02a8a'], 'BOO!': ['#9be37a', '#e8ffd8', '#3a2a5a'], 'THUD!': ['#c58a4a', '#ffd9a0', '#ffffff'],
    'ZOOM!': ['#18b4ff', '#ffffff', '#ff3d7f'], 'POP!': ['#ffffff', '#fff2a8', '#ff3d7f'], 'BLOCK!': ['#4aa8ff', '#d8f0ff', '#ffffff'],
  };

  function burstTexture(word) {
    if (burstCache[word]) return burstCache[word];
    const { makeCanvas, toTexture, FONT } = window.Kit.gfx;
    const [c, g] = makeCanvas(256, 256);
    const [outer, inner, text] = STYLE[word] || STYLE['POW!'];
    const star = (r1, r2, n, fill) => {
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? r2 * (0.85 + ((i * 37) % 7) / 30) : r1 * (0.88 + ((i * 53) % 5) / 25);
        g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    g.lineJoin = 'round';
    star(124, 70, 12, '#14121f');
    star(114, 62, 12, outer);
    star(84, 52, 10, inner);
    g.translate(128, 132);
    g.rotate(-0.12);
    const size = word.length > 5 ? 50 : 60;
    g.font = `${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#14121f';
    g.strokeText(word, 0, 0);
    g.fillStyle = text;
    g.fillText(word, 0, 0);
    return (burstCache[word] = toTexture(c));
  }

  function sprite(tex, size, x, y, z, o = {}) {
    const m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !o.onTop, color: o.color || '#ffffff' });
    if (o.add) m.blending = T.AdditiveBlending;
    const s = new T.Sprite(m);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = o.onTop ? 20 : 5;
    scene.add(s);
    return s;
  }

  function add(s, fx) {
    live.push(Object.assign({ s, t: 0, life: 0.6, vx: 0, vy: 0, g: 0, spin: 0, size: s.scale.x }, fx));
  }

  // ---------------------------------------------------------------- one-shots

  function pow(x, y, word, big) {
    const s = sprite(burstTexture(word), 0.1, x, y, 0.8, { onTop: true });
    s.material.rotation = (Math.random() - 0.5) * 0.5;
    add(s, { kind: 'burst', life: big ? 0.7 : 0.5, size: big ? 1.75 : 1.25 });
    stars(x, y, big ? 7 : 4);
  }

  function stars(x, y, n) {
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 3;
      const s = sprite(tex, 0.32, x, y, 0.7, { onTop: true });
      add(s, { kind: 'spark', life: 0.55 + Math.random() * 0.25, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, g: 9, spin: (Math.random() - 0.5) * 12 });
    }
  }

  function block(x, y) {
    const s = sprite(burstTexture('BLOCK!'), 0.1, x, y, 0.8, { onTop: true });
    add(s, { kind: 'burst', life: 0.4, size: 1.0 });
    const tex = G.emojiTexture('✨');
    for (let i = 0; i < 3; i++) {
      const sp = sprite(tex, 0.3, x, y, 0.7, { onTop: true });
      add(sp, { kind: 'spark', life: 0.4, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2 });
    }
  }

  function dust(x, n = 5, big = false) {
    const tex = G.dotTexture();
    for (let i = 0; i < n; i++) {
      const s = sprite(tex, big ? 0.7 : 0.45, x + (Math.random() - 0.5) * 0.6, 0.12, 0.2 + (Math.random() - 0.5) * 0.4, { color: '#d8c39a' });
      s.material.opacity = 0.8;
      add(s, { kind: 'dust', life: 0.5 + Math.random() * 0.3, vx: (Math.random() - 0.5) * (big ? 4 : 2.4), vy: 0.6 + Math.random() * 0.8, size: s.scale.x });
    }
  }

  function clash(x, y) {
    pow(x, y, 'POP!', false);
  }

  // A decorative item that flies along a path for a while (Teddy's victory ball, Tommy's victory stars).
  function toss(emoji, x, y, vx, vy, size = 0.5, life = 1.2) {
    const s = sprite(G.emojiTexture(emoji), size, x, y, 0.3);
    add(s, { kind: 'spark', life, vx, vy, g: 12, spin: -6 });
  }

  // ---------------------------------------------------------------- projectiles

  const PROJ_SIZE = { ball: 0.6, peace: 1.25, moon: 0.8, zap: 0.8, shock: 1.0, boo: 1.3, bball: 0.5, bpeace: 0.95 };
  // companions throw smaller versions of the brothers' own specials
  const STYLE_OF = { bball: 'ball', bpeace: 'peace' };

  function syncProjectiles(list, dt, time) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const kind = STYLE_OF[p.kind] || p.kind;
      let e = projSprites.get(p.id);
      if (!e) {
        const group = new T.Group();
        scene.add(group);
        const main = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(p.emoji), transparent: true, depthWrite: false }));
        const sz = PROJ_SIZE[p.kind] || 0.7;
        main.scale.set(sz, sz, 1);
        group.add(main);
        const parts = [];
        if (kind === 'peace') {
          // Tommy's wave: the big ✌️ with stars spinning around it
          for (let i = 0; i < 4; i++) {
            const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(i % 2 ? '⭐' : '✌️'), transparent: true, depthWrite: false }));
            s.scale.set(0.42, 0.42, 1);
            group.add(s);
            parts.push(s);
          }
        }
        if (kind === 'zap' || kind === 'peace' || kind === 'moon') {
          const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: kind === 'zap' ? '#5ef2ff' : kind === 'moon' ? '#fff3a0' : '#ffb0e0', transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
          glow.scale.set(sz * 1.6, sz * 1.6, 1);
          glow.material.opacity = kind === 'peace' ? 0.55 : 0.9;
          glow.renderOrder = -1;
          group.add(glow);
          parts.push(glow);
        }
        e = { group, main, parts, kind, trail: 0 };
        projSprites.set(p.id, e);
      }
      e.group.position.set(p.x, p.y, 0.15);
      const m = e.main.material;
      if (kind === 'ball') m.rotation -= p.vx * dt * 1.5;
      else if (kind === 'moon') m.rotation += 14 * dt * p.dir;
      else if (kind === 'zap') e.main.scale.setScalar(0.65 + Math.sin(time * 60) * 0.12);
      else if (kind === 'boo') {
        m.rotation = Math.sin(time * 9) * 0.25;
        m.opacity = 0.9;
      }
      if (kind === 'peace') {
        e.parts.forEach((s, i) => {
          if (i >= 4) return;
          const a = time * 6 + (i * Math.PI) / 2;
          s.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.65, 0.05);
        });
      }
      // sparkle trails
      e.trail -= dt;
      if (e.trail <= 0 && !p.spent) {
        e.trail = kind === 'shock' ? 0.05 : 0.07;
        if (kind === 'shock') dust(p.x, 1, true);
        else if (kind !== 'ball') {
          const s = sprite(G.emojiTexture(kind === 'zap' ? '✨' : '⭐'), 0.22, p.x, p.y + (Math.random() - 0.5) * 0.4, 0.1);
          add(s, { kind: 'spark', life: 0.35, vy: 0.5 });
        }
      }
    }
    for (const [id, e] of projSprites) {
      if (seen.has(id)) continue;
      scene.remove(e.group);
      e.group.traverse((o) => o.material && o.material.dispose());
      projSprites.delete(id);
    }
  }

  // ---------------------------------------------------------------- per fighter: dizzy stars, held ball

  function makeFighterFx() {
    const dizzy = new T.Group();
    const orbit = [];
    ['⭐', '💫', '⭐', '🐤'].forEach((em) => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(em), transparent: true, depthWrite: false }));
      s.scale.set(0.42, 0.42, 1);
      dizzy.add(s);
      orbit.push(s);
    });
    dizzy.visible = false;
    scene.add(dizzy);
    const ball = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture('🏀'), transparent: true, depthWrite: false }));
    ball.scale.set(0.5, 0.5, 1);
    ball.visible = false;
    scene.add(ball);
    return { dizzy, orbit, ball };
  }

  const tmpA = new T.Vector3(), tmpB = new T.Vector3();

  function updateFighterFx(ffx, person, show, time) {
    ffx.dizzy.visible = show.dizzy;
    if (show.dizzy) {
      person.head.getWorldPosition(tmpA);
      ffx.dizzy.position.set(tmpA.x, tmpA.y + 0.62, tmpA.z);
      ffx.orbit.forEach((s, i) => {
        const a = time * 3.2 + (i * Math.PI) / 2;
        s.position.set(Math.cos(a) * 0.48, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.48);
      });
    }
    ffx.ball.visible = show.ball;
    if (show.ball) {
      window.Kit.people.handWorld(person, -1, tmpA);
      window.Kit.people.handWorld(person, 1, tmpB);
      ffx.ball.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
      ffx.ball.position.y += 0.08;
    }
  }

  // ---------------------------------------------------------------- update

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      const u = e.t / e.life;
      if (u >= 1) {
        scene.remove(e.s);
        e.s.material.dispose();
        live.splice(i, 1);
        continue;
      }
      e.vy -= e.g * dt;
      e.s.position.x += e.vx * dt;
      e.s.position.y += e.vy * dt;
      e.s.material.rotation += e.spin * dt;
      if (e.kind === 'burst') {
        // pop in with an overshoot, hold, then shrink away
        const k = u < 0.18 ? (u / 0.18) * 1.25 : u < 0.3 ? 1.25 - ((u - 0.18) / 0.12) * 0.25 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
        e.s.scale.setScalar(e.size * k);
      } else if (e.kind === 'dust') {
        e.s.scale.setScalar(e.size * (1 + u * 1.5));
        e.s.material.opacity = 0.8 * (1 - u);
        e.vx *= 0.92;
      } else {
        e.s.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      }
    }
  }

  function clear() {
    for (const e of live) {
      scene.remove(e.s);
      e.s.material.dispose();
    }
    live.length = 0;
    syncProjectiles([], 0, 0);
  }

  function init(sc) {
    scene = sc;
    G = window.Kit.gfx;
    Object.keys(STYLE).forEach(burstTexture); // paint them now, not mid-fight
  }

  window.KofFx = { init, pow, stars, block, dust, clash, toss, syncProjectiles, makeFighterFx, updateFighterFx, update, clear };
})();
