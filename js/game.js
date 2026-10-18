/* King of Bonk — the game: scene, camera, menus, HUD, the main loop and the window.kof test hooks.
   The rules live in js/fight.js. This file reads match state every frame and turns match.events into POW bursts,
   sounds, banners and camera shake. Behind the title and select screens, two CPUs fight a quiet demo match. */
(function () {
  'use strict';
  const T = THREE, F = window.KofFight, C = window.KofCPU, P = window.KofPoses, FX = window.KofFx, S = window.KofSfx, I = window.KofInput;
  const Kit = window.Kit;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (k, dt) => 1 - Math.exp(-k * dt);
  const PI = Math.PI;
  const HOOP = { x: -8.6, y: 3.0, z: -2.6 };
  const SIDE_COLOR = ['#8cc2ff', '#ffb0b0'];
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const BUD_REST = 240; // frames a companion rests after a visit (4 s), in 2P and against the Normal CPU
  const BUD_REST_EASY = 30; // a player facing the Easy CPU can call him right back
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('kofTeddy.' + k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try { localStorage.setItem('kofTeddy.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
  };

  const G = {
    screen: 'title', // title | select | fight | pause | results
    mode: '1p', level: store.get('level', 'easy'),
    picks: [null, null], cursor: [0, 1], vsT: 0,
    attract: true, slowT: 0, shake: 0, time: 0, acc: 0, timers: [], overShown: false,
    lastMatch: null,
  };
  let renderer, scene, camera, sun, stage, debugBoxes = null;
  let M = null, brains = [null, null], fighters = [];
  let portraits = {}, last = 0;
  const cam = { x: 0, dist: 11 };
  const ui = {};
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;
  const ROSTER = () => Kit.roster.list.filter((e) => window.KofChars.ids.includes(e.id));

  function later(t, fn) {
    G.timers.push({ t, fn });
  }

  // ---------------------------------------------------------------- fighters and matches

  function altLook(look) {
    // mirror match: the second one wears different colours
    const shift = (hex, h) => '#' + new T.Color(hex).offsetHSL(h, 0, 0).getHexString();
    return Object.assign({}, look, { top: shift(look.top, 0.42), bottom: shift(look.bottom, 0.3), shoes: shift(look.shoes, 0.5) });
  }

  function buildFighter(id, side, alt, who) {
    const entry = Kit.roster.get(id) || Kit.roster.list[0];
    const person = Kit.people.build(alt ? altLook(entry.look) : entry.look);
    person.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(person.root);
    return {
      id, person, entry, ch: window.KofChars.get(id), ffx: FX.makeFighterFx(), u: side === 0 ? 1 : -1, squash: 0, tag: makeTag(who, side), who,
      hello: Kit.roster.signature(entry, 'hello'), lastCyc: 0, confettiT: 0,
    };
  }

  // The companion (the other brother) for one side: built at his buddy size, with a name tag in his caller's colour.
  function buildBud(side, id, alt) {
    const entry = Kit.roster.get(id);
    const person = Kit.people.build(alt ? altLook(entry.look) : entry.look);
    person.root.scale.setScalar(entry.buddyScale || 0.8);
    person.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    person.root.visible = false;
    scene.add(person.root);
    const tag = Kit.gfx.nameTag(entry.name, SIDE_COLOR[side]);
    tag.scale.multiplyScalar(0.5);
    tag.renderOrder = 15;
    tag.visible = false;
    scene.add(tag);
    const treat = new T.Sprite(new T.SpriteMaterial({ depthWrite: false }));
    treat.visible = false;
    scene.add(treat);
    return { id, entry, person, tag, u: side === 0 ? 1 : -1, treat, flyT: -1, holdT: 0, from: new T.Vector3() };
  }

  // "1P" / "2P" / "CPU" over a fighter's head, drawn in the current language (CPU is 电脑 in 中文).
  function makeTag(who, side) {
    if (!who) return null;
    const tag = Kit.gfx.nameTag(Kit.lang.t(who), who === 'CPU' ? '#ff8a8a' : side === 0 ? '#8cc2ff' : '#ffb0b0');
    tag.scale.multiplyScalar(0.55);
    tag.renderOrder = 15;
    scene.add(tag);
    return tag;
  }

  function relabelTags() {
    fighters.forEach((fv, side) => {
      if (!fv.tag) return;
      scene.remove(fv.tag);
      fv.tag.material.map.dispose();
      fv.tag.material.dispose();
      fv.tag = makeTag(fv.who, side);
    });
  }

  function clearFighters() {
    for (const f of fighters) {
      scene.remove(f.person.root, f.ffx.dizzy, f.ffx.ball);
      if (f.tag) scene.remove(f.tag);
      if (f.bud) {
        scene.remove(f.bud.person.root, f.bud.tag, f.bud.treat);
        if (f.bud.treat.parent) f.bud.treat.parent.remove(f.bud.treat);
      }
    }
    fighters = [];
  }

  // brains: 'human' (keyboard/touch for that side), or a CPU level
  function startMatch(chars, who, attract) {
    clearFighters();
    FX.clear();
    const mods = who.map((b) => (C.LEVELS[b] ? C.modsFor(b) : { dmg: 1, walk: 1 }));
    const rest = who.map((b, side) => (b === 'human' && who[side ^ 1] === 'easy' ? BUD_REST_EASY : BUD_REST));
    M = F.create({ chars, mods, buddyRest: rest });
    brains = who.map((b, side) => (b === 'human' ? () => I.snapshot(side) : C.brain(b)));
    const labels = attract ? [null, null] : who.map((b, side) => (b === 'human' ? (G.mode === '2p' ? `${side + 1}P` : '1P') : 'CPU'));
    fighters = chars.map((id, side) => buildFighter(id, side, side === 1 && chars[0] === chars[1], labels[side]));
    fighters.forEach((fv, side) => { fv.bud = buildBud(side, M.f[side].bud.id, side === 1 && M.f[0].bud.id === M.f[1].bud.id); });
    G.attract = !!attract;
    G.slowT = 0;
    G.acc = 0;
    G.overShown = false;
    G.timers = [];
    cam.x = 0;
    cam.dist = 11;
    I.setTwoPlayer(G.mode === '2p');
    I.clear();
    if (!attract) {
      G.lastMatch = { chars: chars.slice(), who: who.slice() };
      setupHud();
    }
  }

  function startAttract() {
    const ids = window.KofChars.ids;
    const a = Math.random() < 0.6 ? 'teddy' : ids[Math.floor(Math.random() * ids.length)];
    let b = Math.random() < 0.6 ? 'tommy' : ids[Math.floor(Math.random() * ids.length)];
    if (b === a) b = a === 'tommy' ? 'teddy' : 'tommy';
    startMatch(Math.random() < 0.5 ? [a, b] : [b, a], ['normal', 'normal'], true);
  }

  function startFight() {
    const who = G.mode === '2p' ? ['human', 'human'] : ['human', G.level];
    startMatch(G.picks.slice(), who, false);
    show('fight');
    Kit.sound.music('play');
  }

  // ---------------------------------------------------------------- the loop

  function tick() {
    if (!M) return;
    const a = brains[0](M, M.f[0], M.f[1]);
    const b = brains[1](M, M.f[1], M.f[0]);
    M.step(a, b);
    handleEvents();
  }

  function advance(dt) {
    for (let i = G.timers.length - 1; i >= 0; i--) {
      const t = G.timers[i];
      if ((t.t -= dt) <= 0) {
        G.timers.splice(i, 1);
        t.fn();
      }
    }
    if (G.screen === 'pause' || G.frozen) {
      G.time += dt;
      return;
    }
    if (G.screen === 'select' && G.vsT > 0 && (G.vsT -= dt) <= 0) startFight();
    let scale = 1;
    if (G.slowT > 0) {
      G.slowT -= dt;
      scale = 0.3; // slow motion after a KO
    }
    G.acc += dt * scale;
    let n = 0;
    while (G.acc >= F.DT && n < 10) {
      tick();
      G.acc -= F.DT;
      n++;
    }
    if (n === 10) G.acc = 0;
    G.time += dt;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    advance(dt);
    render(G.screen === 'pause' ? 0 : dt);
  }

  // ---------------------------------------------------------------- events -> effects

  const sound = (fn) => { if (!G.attract) fn(); };

  function handleEvents() {
    for (const e of M.events) {
      switch (e.type) {
        case 'round':
          if (!G.attract) banner(e.final ? 'FINAL ROUND' : `ROUND ${e.round}`, 'round', 1.4);
          sound(() => S.bell(1));
          break;
        case 'fight':
          if (!G.attract) banner('FIGHT!', 'fight', 0.9);
          sound(() => S.fight());
          break;
        case 'swing':
          sound(() => S.whoosh(e.big));
          break;
        case 'hit': {
          FX.pow(e.x, e.y, e.word, e.big);
          const def = fighters[e.side ^ 1];
          if (def) def.squash = 1;
          G.shake = Math.max(G.shake, e.ko ? 0.35 : e.big ? 0.2 : 0.08);
          if (e.big) stage.cheer(e.ko);
          sound(() => (e.ko ? S.bonk() : S.hit(e.big)));
          if (!G.attract && e.combo >= 2) combo(e.side, e.combo);
          break;
        }
        case 'block':
          FX.block(e.x, e.y);
          sound(() => S.block());
          break;
        case 'special':
          if (!G.attract) callout(e.side, e.name);
          sound(() => S.special(e.special));
          break;
        case 'spawn':
          if (e.kind === 'peace' || e.kind === 'bpeace') FX.stars(e.x, e.y + 0.4, e.bud ? 5 : 8);
          if (e.kind === 'ball' || e.kind === 'bball') sound(() => S.whoosh(false));
          if (e.kind === 'bpeace') sound(() => S.special('peace'));
          break;
        case 'buddy': {
          const name = Kit.roster.get(e.id).name;
          if (e.what === 'call') {
            if (!G.attract) callout(e.side, `${name}'S HERE!`);
            sound(() => S.buddy());
          } else if (e.what === 'resting' && !G.attract) nudge(e.side);
          break;
        }
        case 'saved':
          FX.block(e.x, e.y);
          stage.cheer(false);
          if (!G.attract) callout(e.side, e.id === 'tommy' ? 'TOMMY BLOCKED IT!' : `${Kit.roster.get(e.id).name} SAVED YOU!`);
          sound(() => S.block());
          break;
        case 'treat':
          giveTreat(e.side);
          break;
        case 'clash':
          FX.clash(e.x, e.y);
          sound(() => S.clash());
          break;
        case 'jump':
          sound(() => S.boing());
          break;
        case 'land':
          FX.dust(M.f[e.side].x, e.big ? 9 : 3, e.big);
          if (e.big) G.shake = Math.max(G.shake, 0.25);
          sound(() => S.land());
          break;
        case 'down':
          FX.dust(e.x, 8, true);
          G.shake = Math.max(G.shake, 0.12);
          sound(() => S.down());
          break;
        case 'bounce':
          sound(() => S.land());
          break;
        case 'ko':
          G.slowT = 1.1;
          if (!G.attract) banner(e.double ? 'DOUBLE K.O.!' : 'K.O.!', 'ko', 2.2);
          sound(() => S.bell(3));
          break;
        case 'time':
          if (!G.attract) banner(e.winner < 0 ? 'TIME! DRAW' : 'TIME!', 'ko', 2.2);
          sound(() => S.bell(3));
          break;
        case 'win': {
          const f = fighters[e.side];
          if (!G.attract) {
            banner(`${f.entry.name} WINS!`, 'win', 2.2);
            updateWins();
          }
          sound(() => S.cheer());
          break;
        }
        case 'over':
          if (G.attract) later(2.5, startAttract);
          else later(1.6, showResults);
          break;
      }
    }
    M.events.length = 0;
  }

  // ---------------------------------------------------------------- render

  const tmp = new T.Vector3();

  function render(dt) {
    if (M) {
      for (const fv of fighters) {
        const side = fighters.indexOf(fv);
        const f = M.f[side];
        const p = fv.person;
        // face the foe, turning through the camera; celebrate and sit dizzy facing the camera more
        const toCam = f.state === 'win' || f.state === 'ko' ? 0.3 : f.state === 'attack' && f.move.anim === 'peace' ? 0.7 : 1;
        fv.u += (f.facing * toCam - fv.u) * damp(12, dt);
        p.root.rotation.y = -PI + (PI / 2 - 0.3) * fv.u;
        const hello = M.round === 1 && M.phase === 'intro' && M.phaseT < 60 && !G.attract ? fv.hello : null;
        const r = P.apply(p, f, fv.ch, G.time, Math.max(dt, 1e-4), hello);
        p.root.position.set(f.x, f.y + r.hop, 0);
        fv.squash = Math.max(0, fv.squash - dt * 6);
        const s = Math.sin(fv.squash * PI) * 0.13;
        p.root.scale.set(1 + s, 1 - s, 1 + s);
        FX.updateFighterFx(fv.ffx, p, { dizzy: f.state === 'ko' && f.y <= 0.02 && (f.t > 40 || !f.koFall), ball: r.ball }, G.time);
        if (fv.tag) {
          fv.tag.visible = M.phase !== 'over' && f.state !== 'ko' && f.state !== 'knockdown';
          fv.tag.position.set(f.x, f.y + 2.55, 0);
        }
        if (f.state === 'win') celebrate(fv, f, dt);
        renderBud(fv, f, dt);
        if (f.state === 'attack' && f.move.dash && f.mt > f.move.dash[0] && f.mt <= f.move.dash[1] && Math.random() < dt * 30) FX.dust(f.x - f.facing * 0.4, 1);
      }
      FX.syncProjectiles(M.proj, dt, G.time);
      updateCamera(dt);
      if (debugBoxes) drawDebug();
      if (!G.attract && (G.screen === 'fight' || G.screen === 'pause')) updateHud(dt);
    }
    FX.update(dt);
    stage.update(dt, G.time);
    renderer.render(scene, camera);
  }

  // The companion: runs in and out, strikes his signature poses, cheers when he saves his fighter.
  function renderBud(fv, f, dt) {
    const bv = fv.bud, b = f.bud, p = bv.person;
    updateTreat(fv, dt);
    p.root.visible = bv.tag.visible = b.on;
    if (!b.on) return;
    const k = damp(18, dt);
    const moving = b.act === 'enter' || b.act === 'return' || b.act === 'leave';
    let mode = bv.id === 'teddy' ? 'guard' : 'idle', ph = G.time * 6;
    if (moving) {
      mode = 'run';
      ph = G.time * 14;
    } else if (b.act === 'give') mode = 'give';
    else if (b.act === 'move') {
      const mv = F.BUD_MOVES[b.move];
      if (mv.dash) {
        const at = b.arrive < 0 ? -1 : b.actT - b.arrive;
        mode = at < 0 ? 'run' : at < mv.strikes[1].at - 1 ? 'jab' : at < mv.len - 8 ? 'straight' : 'guard';
        ph = G.time * 16;
      } else mode = b.move;
    } else if (b.cheer > 0) {
      mode = Kit.roster.signature(bv.entry, 'hello'); // he just saved you
      ph = G.time * 6;
    }
    Kit.people.pose(p, ph, mode, k);
    const toCam = mode === 'peace' ? 0.6 : 1;
    bv.u += (b.facing * toCam - bv.u) * damp(12, dt);
    p.root.rotation.y = -PI + (PI / 2 - 0.3) * bv.u;
    p.root.position.set(b.x, b.y, -0.9);
    bv.tag.position.set(b.x, b.y + (bv.entry.buddyScale || 0.8) * 2.2 + 0.35, -0.9);
    if (b.act === 'move' && F.BUD_MOVES[b.move].dash && b.arrive < 0 && Math.random() < dt * 25) FX.dust(b.x, 1);
  }

  // Halfway through a visit he tosses his fighter a treat, who holds it for a while (just for fun).
  function giveTreat(side) {
    const fv = fighters[side], bv = fv.bud;
    const [emoji, label] = TREATS[Math.floor(Math.random() * TREATS.length)];
    bv.treat.material.map = Kit.gfx.emojiTexture(emoji);
    bv.treat.material.needsUpdate = true;
    if (bv.treat.parent !== scene) scene.add(bv.treat);
    bv.person.root.updateMatrixWorld(true);
    Kit.people.handWorld(bv.person, 1, bv.from);
    bv.treat.position.copy(bv.from);
    bv.treat.scale.setScalar(0.5);
    bv.treat.visible = true;
    bv.flyT = 0;
    if (!G.attract) {
      callout(side, `${emoji} ${label} FROM ${bv.entry.name}!`);
      Kit.sound.coin(4);
    }
  }

  const handPos = new T.Vector3();
  function updateTreat(fv, dt) {
    const bv = fv.bud;
    if (bv.flyT >= 0) {
      bv.flyT += dt / 0.55;
      fv.person.root.updateMatrixWorld(true);
      fv.person.armR.localToWorld(handPos.set(0, -0.72, 0));
      const u = Math.min(1, bv.flyT);
      bv.treat.position.lerpVectors(bv.from, handPos, u);
      bv.treat.position.y += Math.sin(u * PI) * 1.0;
      if (u >= 1) {
        bv.flyT = -1;
        bv.holdT = 5;
        fv.person.armR.add(bv.treat);
        bv.treat.position.set(0.14, -0.8, 0.22);
        bv.treat.scale.setScalar(0.5);
      }
    } else if (bv.holdT > 0 && (bv.holdT -= dt) <= 0) {
      bv.treat.visible = false;
      scene.add(bv.treat);
    }
  }

  // Teddy's victory jump shots go into his backyard hoop; Tommy's Y throws ✌️ and stars.
  function celebrate(fv, f, dt) {
    if (fv.ch.win === 'jumpshot') {
      const cyc = (f.t / 60) % 3;
      const release = 1.5 + 0.55 * 1.5;
      if (fv.lastCyc < release && cyc >= release) {
        Kit.people.handWorld(fv.person, 1, tmp);
        const fly = 0.9;
        const g = 12;
        FX.toss('🏀', tmp.x, tmp.y + 0.1, (HOOP.x - tmp.x) / fly, (HOOP.y + 0.3 - tmp.y + 0.5 * g * fly * fly) / fly, 0.5, fly);
        later(fly, () => { if (!G.attract) S.swish(); });
      }
      fv.lastCyc = cyc;
    } else if (fv.ch.win === 'peace') {
      if ((fv.confettiT -= dt) <= 0) {
        fv.confettiT = 0.45;
        for (const s of [-1, 1]) FX.toss(Math.random() < 0.5 ? '✌️' : '⭐', f.x + s * 0.6, f.y + 2.4, s * (0.6 + Math.random()), 3 + Math.random() * 2, 0.35, 1);
      }
    }
  }

  function updateCamera(dt) {
    const [a, b] = M.f;
    const mid = (a.x + b.x) / 2, sep = Math.abs(a.x - b.x);
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const vt = Math.tan((camera.fov * PI) / 360);
    const need = Math.max((sep + 4.4) / 2 / (vt * aspect), 5.6 / 2 / vt, 9);
    cam.dist += (Math.min(need, 34) - cam.dist) * damp(3, dt);
    const halfView = cam.dist * vt * aspect;
    const edge = Math.max(0, F.STAGE + 2.2 - halfView);
    cam.x += (clamp(mid, -edge, edge) - cam.x) * damp(5, dt);
    G.shake = Math.max(0, G.shake - dt * 1.4);
    const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
    camera.position.set(cam.x + sx, 1.6 + cam.dist * 0.06 + sy, cam.dist);
    camera.lookAt(cam.x, 1.3 + cam.dist * 0.025, 0);
  }

  // Hit/hurt boxes as wireframes, for testing (kof.debug(true)).
  function drawDebug() {
    const boxes = [];
    for (const f of M.f) {
      const h = F.hurtbox(f);
      if (h) boxes.push([h, '#00ff66']);
      if (f.state === 'attack' && F.moveActive(f)) boxes.push([F.hitboxWorld(f, f.move.hb), '#ff2244']);
    }
    for (const p of M.proj) boxes.push([[p.x - p.def.w, p.x + p.def.w, p.y - p.def.h, p.y + p.def.h], '#ffcc00']);
    debugBoxes.children.forEach((c, i) => { c.visible = i < boxes.length; });
    boxes.forEach(([b, col], i) => {
      let m = debugBoxes.children[i];
      if (!m) {
        m = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({ depthTest: false }));
        m.renderOrder = 30;
        debugBoxes.add(m);
      }
      m.material.color.set(col);
      m.scale.set(b[1] - b[0], b[3] - b[2], 0.6);
      m.position.set((b[0] + b[1]) / 2, (b[2] + b[3]) / 2, 0);
    });
  }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    for (const side of [0, 1]) {
      const f = fighters[side], el = ui.p[side];
      el.face.src = portraits[f.id] || '';
      el.name.textContent = f.entry.name;
      el.lagW = 100;
      el.hp.style.width = '100%';
      el.lag.style.width = '100%';
      el.who.textContent = G.mode === '2p' ? `${side + 1}P` : side === 0 ? '1P' : `CPU · ${G.level.toUpperCase()}`;
      ui.combo[side].classList.remove('show');
      ui.call[side].classList.remove('show');
      const bid = fighters[side].bud.id;
      el.budImg.src = portraits[bid] || '';
      el.budKey.textContent = side === 0 ? 'T' : G.mode === '2p' ? '⏎' : 'CPU';
      el.budWrap.title = `${Kit.roster.get(bid).name}: ${side === 0 ? 'press T' : G.mode === '2p' ? 'press Enter' : 'the computer calls him'}`;
    }
    updateWins();
    ui.touch.classList.toggle('hidden', !(isTouch && G.mode === '1p'));
    const b0 = fighters[0].bud;
    ui.budBtn.querySelector('img').src = portraits[b0.id] || '';
    ui.budBtn.querySelector('small').textContent = b0.entry.name;
  }

  // "He's still resting": a little shake of his HUD bar (and the touch button).
  function nudge(side) {
    const els = [ui.p[side].budWrap].concat(side === 0 ? [ui.budBtn] : []);
    for (const el of els) {
      el.classList.remove('no');
      void el.offsetWidth;
      el.classList.add('no');
    }
  }

  function updateWins() {
    for (const side of [0, 1]) {
      ui.p[side].wins.forEach((w, i) => w.classList.toggle('on', M.wins[side] > i));
    }
  }

  function updateHud(dt) {
    for (const side of [0, 1]) {
      const f = M.f[side], el = ui.p[side];
      const pct = (f.hp / F.HP) * 100;
      el.hp.style.width = pct + '%';
      el.hp.style.background = pct > 50 ? 'linear-gradient(180deg,#9dff6a,#3fc22b)' : pct > 25 ? 'linear-gradient(180deg,#ffe76a,#f2b10f)' : 'linear-gradient(180deg,#ff8a6a,#e8352a)';
      // the white "ouch" bar catches up a moment later
      el.lagW = el.lagW > pct ? Math.max(pct, el.lagW - dt * 40) : pct;
      el.lag.style.width = el.lagW + '%';
      const sp = 1 - f.cd / F.SPECIAL_CD;
      el.sp.style.width = clamp(sp, 0, 1) * 100 + '%';
      el.spWrap.classList.toggle('ready', f.cd === 0 && M.phase === 'fight');
      // companion: time he keeps guarding, or how far he's rested
      const b = f.bud;
      const fill = b.on ? b.guardLeft / F.BUD.GUARD : b.rest > 0 ? 1 - b.rest / b.rest0 : 1;
      el.bud.style.setProperty('--fill', clamp(fill, 0, 1));
      el.budWrap.classList.toggle('on', b.on && b.guardLeft > 0);
      el.budWrap.classList.toggle('rest', !b.on && b.rest > 0);
      if (side === 0) {
        ui.budBtn.classList.toggle('on', b.on && b.guardLeft > 0);
        ui.budBtn.classList.toggle('rest', !b.on && b.rest > 0);
        ui.budBtn.style.setProperty('--fill', clamp(fill, 0, 1));
      }
    }
    const secs = Math.ceil(M.timer / 60);
    if (ui.timer.textContent !== String(secs)) ui.timer.textContent = secs;
    ui.timer.classList.toggle('low', secs <= 10 && M.phase === 'fight');
    ui.round.textContent = `ROUND ${M.round}`;
  }

  function banner(text, kind, secs) {
    const b = ui.banner;
    b.textContent = text;
    b.className = 'banner ' + kind;
    void b.offsetWidth; // restart the animation
    b.classList.add('show');
    clearTimeout(b._t);
    G.timers = G.timers.filter((t) => t.fn !== b._hide);
    b._hide = () => b.classList.remove('show');
    later(secs, b._hide);
  }

  // Pop a side text (combo counter, special name): restart its CSS animation, hide it after `secs`.
  function pop(el, text, secs) {
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    G.timers = G.timers.filter((t) => t.fn !== el._hide);
    el._hide = () => el.classList.remove('show');
    later(secs, el._hide);
  }

  const combo = (side, n) => pop(ui.combo[side], `${n} HITS!`, 1.1);
  const callout = (side, text) => pop(ui.call[side], /[!?]$/.test(text) ? text : text + '!', 1.3);

  // ---------------------------------------------------------------- screens

  function show(name) {
    G.screen = name;
    for (const id of ['title', 'select', 'pause', 'results']) $(id).classList.toggle('hidden', id !== name);
    $('hud').classList.toggle('hidden', !(name === 'fight' || name === 'pause'));
    if (name !== 'fight') ui.touch.classList.add('hidden');
    else ui.touch.classList.toggle('hidden', !(isTouch && G.mode === '1p'));
  }

  function toTitle() {
    show('title');
    Kit.sound.music('title');
    if (!G.attract) startAttract();
    renderLevel();
  }

  function renderLevel() {
    document.querySelectorAll('.lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
  }

  function setLevel(l) {
    G.level = l;
    store.set('level', l);
    renderLevel();
    S.click();
  }

  // ---- character select

  const CARD_IDS = () => ROSTER().map((e) => e.id).concat(['random']);

  function toSelect(mode) {
    G.mode = mode;
    G.picks = [null, null];
    const ids = CARD_IDS();
    const lastPicks = store.get('picks', ['teddy', 'tommy']);
    G.cursor = [Math.max(0, ids.indexOf(lastPicks[0])), Math.max(0, ids.indexOf(lastPicks[1]))];
    G.vsT = 0;
    show('select');
    renderSelect();
  }

  function picker() {
    // in 1P mode one player picks both: themselves, then the CPU
    if (G.mode === '1p') return G.picks[0] === null ? 0 : G.picks[1] === null ? 1 : -1;
    return -1;
  }

  function renderSelect() {
    const ids = CARD_IDS();
    ui.cards.forEach((card, i) => {
      const id = ids[i];
      card.querySelector('.t0').textContent = G.mode === '2p' ? '1P' : 'YOU';
      card.querySelector('.t1').textContent = G.mode === '2p' ? '2P' : 'CPU';
      const on0 = G.cursor[0] === i && (G.mode === '2p' ? G.picks[0] === null : picker() === 0);
      const on1 = G.cursor[1] === i && (G.mode === '2p' ? G.picks[1] === null : picker() === 1);
      card.classList.toggle('c0', on0);
      card.classList.toggle('c1', on1);
      card.classList.toggle('p0', G.picks[0] === id);
      card.classList.toggle('p1', G.picks[1] === id);
    });
    const p = picker();
    const name = (id) => (id ? (Kit.roster.get(id) || { name: '?' }).name : '');
    if (G.mode === '1p') ui.selectTitle.textContent = p === 0 ? 'PICK YOUR FIGHTER' : p === 1 ? 'PICK WHO YOU FIGHT' : 'GET READY!';
    else ui.selectTitle.textContent = G.picks[0] && G.picks[1] ? 'GET READY!' : 'PICK YOUR FIGHTERS';
    for (const side of [0, 1]) {
      const id = G.picks[side] || ids[G.cursor[side]];
      const shown = id === 'random' ? null : id;
      const v = ui.vs[side];
      v.img.src = shown ? portraits[shown] : '';
      v.img.style.visibility = shown ? 'visible' : 'hidden';
      v.name.textContent = shown ? name(shown) : '???';
      v.blurb.textContent = shown ? window.KofChars.get(shown).blurb : 'surprise!';
      v.box.classList.toggle('locked', !!G.picks[side]);
      const pal = shown ? window.KofChars.buddy(shown).id : null;
      v.pal.style.visibility = pal ? 'visible' : 'hidden';
      if (pal) {
        v.palImg.src = portraits[pal];
        v.palName.textContent = Kit.roster.get(pal).name;
      }
      v.who.textContent = G.mode === '2p' ? `${side + 1}P` : side === 0 ? 'YOU' : `CPU · ${G.level.toUpperCase()}`;
    }
    ui.vsMid.classList.toggle('go', !!(G.picks[0] && G.picks[1]));
  }

  function moveCursor(side, d) {
    const n = CARD_IDS().length;
    G.cursor[side] = (G.cursor[side] + d + n) % n;
    S.click();
    renderSelect();
  }

  function confirm(side) {
    if (G.picks[side] !== null) return;
    let id = CARD_IDS()[G.cursor[side]];
    if (id === 'random') {
      const ids = window.KofChars.ids;
      id = ids[Math.floor(Math.random() * ids.length)];
    }
    G.picks[side] = id;
    S.special(id === 'tommy' ? 'peace' : 'jumpshot');
    if (G.mode === '1p' && side === 0) G.cursor[1] = G.cursor[1] === G.cursor[0] ? (G.cursor[0] + 1) % CARD_IDS().length : G.cursor[1];
    if (G.picks[0] && G.picks[1]) {
      store.set('picks', G.picks);
      G.vsT = 1.6;
    }
    renderSelect();
  }

  function unpick(side) {
    G.vsT = 0;
    if (side === undefined) side = G.picks[1] !== null ? 1 : 0;
    if (G.picks[side] === null && side === 0) return toTitle();
    G.picks[side] = null;
    renderSelect();
  }

  function clickCard(i) {
    if (G.mode === '1p') {
      const p = picker();
      if (p < 0) return;
      G.cursor[p] = i;
      confirm(p);
    } else {
      const side = G.picks[0] === null ? 0 : G.picks[1] === null ? 1 : -1;
      if (side < 0) return;
      G.cursor[side] = i;
      confirm(side);
    }
  }

  // ---- pause and results

  function togglePause() {
    G.autoPaused = false;
    if (G.screen === 'fight') {
      show('pause');
      Kit.sound.music('pause');
    } else if (G.screen === 'pause') {
      show('fight');
      Kit.sound.music('play');
      I.clear();
    }
  }

  function showResults() {
    if (G.attract || G.overShown) return;
    G.overShown = true;
    const w = M.winner;
    const p0 = M.f[0];
    if (w < 0) {
      ui.resTitle.textContent = 'DRAW!';
      ui.resFace.src = '';
      ui.resFace.style.visibility = 'hidden';
    } else {
      const f = fighters[w];
      ui.resTitle.textContent = `${f.entry.name} WINS!`;
      ui.resFace.src = portraits[f.id];
      ui.resFace.style.visibility = 'visible';
    }
    const youWon = G.mode === '1p' && w === 0;
    ui.resSub.textContent = G.mode === '2p' ? (w < 0 ? 'What a battle!' : `${w + 1}P is the backyard champion!`) : youWon ? 'You are the backyard champion!' : w < 0 ? 'Nobody won. Again?' : 'So close! Try again?';
    const st = (f) => `${f.stats.hits} hits · best combo ${f.stats.maxCombo} · ${f.stats.specials} specials · ${f.stats.saves} saves by ${Kit.roster.get(f.bud.id).name}`;
    ui.resStats.innerHTML = `<div><b>${fighters[0].entry.name}</b> ${st(p0)}</div><div><b>${fighters[1].entry.name}</b> ${st(M.f[1])}</div>`;
    show('results');
    Kit.sound.music('over');
    if (w >= 0) S.fanfare();
  }

  function rematch() {
    if (!G.lastMatch) return toTitle();
    G.picks = G.lastMatch.chars.slice();
    startFight();
  }

  // ---------------------------------------------------------------- input for menus

  function bindMenus() {
    $('play1').onclick = () => toSelect('1p');
    $('play2').onclick = () => toSelect('2p');
    document.querySelectorAll('.lvl').forEach((b) => { b.onclick = () => setLevel(b.dataset.level); });
    ui.cards.forEach((c, i) => { c.onclick = () => clickCard(i); });
    $('selBack').onclick = () => unpick();
    $('selGo').onclick = () => { if (G.picks[0] && G.picks[1]) startFight(); };
    $('pauseBtn').onclick = togglePause;
    $('resumeBtn').onclick = togglePause;
    $('quitBtn').onclick = toTitle;
    $('againBtn').onclick = rematch;
    $('newBtn').onclick = () => toSelect(G.mode);
    $('menuBtn').onclick = toTitle;
    const mute = () => {
      const m = Kit.sound.toggleMute();
      document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; });
    };
    document.querySelectorAll('.muteBtn').forEach((b) => {
      b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
      b.onclick = mute;
    });

    const wake = () => Kit.sound.init();
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', (e) => {
      wake();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.code;
      if (k === 'KeyM') return mute();
      switch (G.screen) {
        case 'title':
          if (k === 'Enter' || k === 'Space' || k === 'Digit1' || k === 'KeyF' || k === 'KeyJ') toSelect('1p');
          else if (k === 'Digit2') toSelect('2p');
          else if (k === 'KeyE' || k === 'ArrowLeft' || k === 'KeyA') setLevel('easy');
          else if (k === 'KeyN' || k === 'ArrowRight' || k === 'KeyD') setLevel('normal');
          break;
        case 'select': {
          if (k === 'Escape' || k === 'Backspace') return unpick();
          if (G.picks[0] && G.picks[1] && (k === 'Enter' || k === 'Space')) return startFight();
          const P1 = { KeyA: -1, KeyD: 1, KeyW: -4, KeyS: 4 }, P2 = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 };
          if (G.mode === '1p') {
            const p = picker();
            if (p < 0) return;
            const d = P1[k] || P2[k];
            if (d) {
              e.preventDefault();
              return moveCursor(p, d);
            }
            if (k === 'KeyF' || k === 'KeyJ' || k === 'Enter' || k === 'Space') confirm(p);
          } else {
            if (P1[k] && G.picks[0] === null) moveCursor(0, P1[k]);
            else if (P2[k] && G.picks[1] === null) {
              e.preventDefault();
              moveCursor(1, P2[k]);
            } else if (k === 'KeyF') confirm(0);
            else if (k === 'KeyJ' || k === 'Enter') confirm(1);
            else if (k === 'KeyG') unpick(0);
            else if (k === 'KeyK') unpick(1);
          }
          break;
        }
        case 'fight':
          if (k === 'KeyP' || k === 'Escape') togglePause();
          break;
        case 'pause':
          if (k === 'KeyP' || k === 'Escape' || k === 'Space' || k === 'Enter') togglePause();
          else if (k === 'KeyQ') toTitle();
          break;
        case 'results':
          if (k === 'Enter' || k === 'Space' || k === 'KeyF' || k === 'KeyJ') rematch();
          else if (k === 'KeyC') toSelect(G.mode);
          else if (k === 'Escape') toTitle();
          break;
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (G.screen === 'fight' && !G.testing) {
          togglePause();
          G.autoPaused = true;
        }
        Kit.sound.suspend();
      } else Kit.sound.resume();
    });
  }

  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight); // a hidden pane can report 0
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- boot

  function buildDom() {
    ui.p = [0, 1].map((side) => {
      const root = $('p' + side);
      return {
        root, face: root.querySelector('.face img'), name: root.querySelector('.nm'), who: root.querySelector('.who'),
        hp: root.querySelector('.hp .fill'), lag: root.querySelector('.hp .lag'), sp: root.querySelector('.sp b'), spWrap: root.querySelector('.sp'),
        wins: [...root.querySelectorAll('.wins i')], lagW: 100,
        budWrap: root.querySelector('.bud'), bud: root.querySelector('.bud i'), budImg: root.querySelector('.bud img'), budKey: root.querySelector('.bud .k'),
      };
    });
    Object.assign(ui, {
      timer: $('timer'), round: $('roundNo'), banner: $('banner'), combo: [$('combo0'), $('combo1')], call: [$('call0'), $('call1')],
      touch: $('touch'), selectTitle: $('selTitle'), vsMid: $('vsMid'), budBtn: $('budBtn'),
      resTitle: $('resTitle'), resSub: $('resSub'), resFace: $('resFace'), resStats: $('resStats'),
    });
    ui.vs = [0, 1].map((side) => {
      const box = $('vs' + side);
      return {
        box, img: box.querySelector('img'), name: box.querySelector('.nm'), blurb: box.querySelector('.bl'), who: box.querySelector('.who'),
        pal: box.querySelector('.pal'), palImg: box.querySelector('.pal img'), palName: box.querySelector('.pal b'),
      };
    });
    const grid = $('cards');
    for (const e of ROSTER()) {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.id = e.id;
      b.innerHTML = `<img alt="" src="${portraits[e.id] || ''}"><span class="nm">${e.name}</span><span class="tg t0">1P</span><span class="tg t1">2P</span>`;
      grid.appendChild(b);
    }
    const r = document.createElement('button');
    r.className = 'card random';
    r.dataset.id = 'random';
    r.innerHTML = '<span class="q">?</span><span class="nm">RANDOM</span><span class="tg t0">1P</span><span class="tg t1">2P</span>';
    grid.appendChild(r);
    ui.cards = [...grid.querySelectorAll('.card')];
    I.bindTouch($('pad'), [...document.querySelectorAll('#touch .tb'), $('budBtn')]);
  }

  async function boot() {
    // wait for every script (js/zh.js comes after this one), so canvas words are drawn in the right language
    if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
    try {
      await Promise.race([document.fonts.load('64px Bungee'), new Promise((r) => setTimeout(r, 1500))]);
    } catch (e) { /* system fonts it is */ }
    const canvas = $('game');
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      $('loading').textContent = 'This browser can’t run WebGL, so the game can’t start.';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.fog = new T.Fog('#cfeeff', 38, 110);
    camera = new T.PerspectiveCamera(30, 1, 0.1, 300);
    scene.add(new T.HemisphereLight('#dff2ff', '#6f8f4a', 0.8));
    sun = new T.DirectionalLight('#fff1d6', 1.25);
    sun.position.set(-5, 12, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 9, bottom: -6, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    stage = window.KofStage.build(scene);
    FX.init(scene);
    debugBoxes = null;

    portraits = Kit.portraits(ROSTER(), { size: 160 });
    buildDom();
    bindMenus();
    resize();
    window.addEventListener('resize', resize);
    Kit.lang.onChange(relabelTags);
    startAttract();
    toTitle();
    $('loading').remove();
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- console hooks for testing

  window.kof = {
    get state() { return { screen: G.screen, phase: M && M.phase, round: M && M.round, timer: M && Math.ceil(M.timer / 60), hp: M && M.f.map((f) => f.hp), wins: M && M.wins.slice(), states: M && M.f.map((f) => f.state), attract: G.attract }; },
    get M() { return M; },
    get scene() { return scene; },
    get fighters() { return fighters; },
    G,
    // Advance `seconds` of game time right now, drawing every frame (works while the pane's rAF is throttled).
    step(seconds = 1) {
      G.testing = true; // a hidden test pane shouldn't pause the game from now on
      if (G.autoPaused) togglePause();
      for (let t = 0; t < seconds; t += 1 / 60) {
        advance(1 / 60);
        render(1 / 60);
      }
      return this.state;
    },
    // Jump straight into a fight: kof.start({ p1: 'teddy', p2: 'tommy', mode: '1p', level: 'easy' })
    start(o = {}) {
      G.testing = true;
      G.mode = o.mode || '1p';
      if (o.level) G.level = o.level;
      G.picks = [o.p1 || 'teddy', o.p2 || 'tommy'];
      startFight();
      return this.state;
    },
    // Hold keys for a fighter for some frames, e.g. kof.press(0, { p: true }) or kof.press(0, { right: true }, 30)
    press(side, keys, frames = 1) {
      const orig = brains[side];
      let n = frames;
      brains[side] = (m, me, foe) => {
        if (--n <= 0) brains[side] = orig;
        return Object.assign(F.blankInput(), keys);
      };
    },
    // Stop the match clock (poses still animate) and optionally force a fighter's state, to inspect poses:
    // kof.freeze(true); kof.set(1, { state: 'ko', t: 99, koFall: true }); kof.step(1)
    freeze(on = true) { G.frozen = on; return on; },
    set(side, fields) { Object.assign(M.f[side], fields); return M.f[side].state; },
    // Call a side's companion, as if T (P1) or Enter (P2) was pressed.
    buddy(side = 0) { this.press(side, { c: true }); return M.f[side].bud.on; },
    // Let the CPU play a side (e.g. kof.cpu(0, 'normal') to watch two CPUs in a real match).
    cpu(side, level = 'normal') { brains[side] = C.brain(level); },
    debug(on = true) {
      if (on && !debugBoxes) {
        debugBoxes = new T.Group();
        scene.add(debugBoxes);
      } else if (!on && debugBoxes) {
        scene.remove(debugBoxes);
        debugBoxes = null;
      }
      return !!debugBoxes;
    },
    sim: C.sim, soak: C.soak, versus: C.versus,
    toTitle, toSelect, pick: clickCard, showResults,
  };

  boot();
})();
