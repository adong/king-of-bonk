/* King of Bonk — fight poses, on top of the kit's Kit.people.pose.
   The kit already has Teddy's boxing (guard, jab, straight), his jump shot and Tommy's peace Y. Everything else a
   fighter needs is here: stance, crouch, kick, sweep, air attacks, hit, block, knocked down, dizzy sit, the specials.
   Remember the kit's conventions: rotation.x swings a limb forward, rotation.z swings it out (negative for the left
   side), hips.rotation.x leans (negative = forward) and carries the legs with it. */
(function () {
  'use strict';

  const KIT = { guard: 1, jab: 1, straight: 1, jumpshot: 1, peace: 1, wave: 1, grab: 1, boxing: 1 };
  const PI = Math.PI;

  // Every channel this file drives, at rest.
  const base = () => ({
    ll: 0, rl: 0, llz: 0, rlz: 0, la: 0, ra: 0, laz: 0, raz: 0, lean: -0.12, twist: 0,
    head: 0, headZ: 0, bob: 0, rigY: 0.55, rigX: 0, rigZ: 0, fingers: false,
  });

  function drive(p, T, k) {
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'x', T.ll);
    to(p.legR.rotation, 'x', T.rl);
    to(p.legL.rotation, 'z', T.llz);
    to(p.legR.rotation, 'z', T.rlz);
    to(p.armL.rotation, 'x', T.la);
    to(p.armR.rotation, 'x', T.ra);
    to(p.armL.rotation, 'z', T.laz);
    to(p.armR.rotation, 'z', T.raz);
    to(p.hips.rotation, 'x', T.lean);
    to(p.hips.rotation, 'y', T.twist);
    to(p.head.rotation, 'x', T.head);
    to(p.head.rotation, 'z', T.headZ);
    to(p.hips.position, 'y', p.hipY + T.bob);
    to(p.rig.position, 'y', T.rigY);
    to(p.rig.rotation, 'x', T.rigX);
    to(p.rig.rotation, 'z', T.rigZ);
    if (p.fingers) for (const f of p.fingers) f.visible = T.fingers;
  }

  // A kit pose, plus easing the channels the kit doesn't touch back to rest.
  function kit(p, ph, mode, k, extra) {
    window.Kit.people.pose(p, ph, mode, k);
    const T = Object.assign(base(), extra);
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * k; };
    to(p.legL.rotation, 'z', T.llz);
    to(p.legR.rotation, 'z', T.rlz);
    to(p.head.rotation, 'z', T.headZ);
    to(p.rig.position, 'y', T.rigY);
    to(p.rig.rotation, 'x', T.rigX);
    to(p.rig.rotation, 'z', T.rigZ);
  }

  // ---------------------------------------------------------------- building blocks

  // Teddy's peek-a-boo (same numbers as the kit's 'guard', bobbing and weaving) or everyone else's fists-up stance.
  function stance(T, ch, p, time) {
    const br = Math.sin(time * 4);
    if (ch.idle === 'guard') Object.assign(T, { ll: 0.45, rl: -0.25, la: 2.15, ra: 2.15, laz: 0.38, raz: -0.38, lean: -0.28, head: 0.15, bob: Math.abs(br) * 0.04 - 0.06, rigZ: Math.sin(time * 2.6) * 0.07 });
    else Object.assign(T, { ll: 0.35, rl: -0.25, la: 1.85, ra: 1.5, laz: 0.32, raz: -0.3, lean: -0.15, twist: -0.25, head: 0.05, bob: br * 0.02 - 0.03 });
    if (p.zombie) Object.assign(T, { la: 1.5 + br * 0.08, ra: 1.38 - br * 0.08, laz: 0, raz: 0, twist: 0, head: 0.15 + br * 0.06 });
  }

  function blockArms(T, ch, p) {
    if (ch.idle === 'guard') Object.assign(T, { la: 2.3, ra: 2.3, laz: 0.45, raz: -0.45, lean: -0.1, head: 0.3 }); // gloves up, chin down
    else Object.assign(T, { la: 2.55, ra: 2.45, laz: 0.62, raz: -0.62, lean: 0.12, head: 0.25, twist: 0 }); // arms crossed over the face
    if (p.zombie) Object.assign(T, { la: 2.4, ra: 2.3, laz: 0.5, raz: -0.5 });
  }

  // Squat with the legs split; leg angles allow for the lean, since the hips carry the legs.
  function crouch(T, low) {
    const lean = -0.3;
    Object.assign(T, { rigY: low ? 0.1 : 0.17, ll: 0.95 - lean, rl: -0.9 - lean, llz: -0.25, rlz: 0.25, lean });
  }

  function walkLegs(T, time, dir) {
    const s = Math.sin(time * 9 * dir);
    T.ll += s * 0.4;
    T.rl -= s * 0.4;
    T.bob += Math.abs(Math.cos(time * 9)) * 0.04;
  }

  // Where we are in a move: 0..1 through startup, active, recovery.
  function phase(f) {
    const m = f.move;
    const s = m.s !== undefined ? m.s : m.spawnAt || 8;
    const a = m.a || 4;
    if (f.mt <= s) return { part: 'start', u: f.mt / Math.max(1, s) };
    if (f.mt <= s + a) return { part: 'active', u: (f.mt - s) / a };
    const r = (m.len || s + a + (m.r || 10)) - s - a;
    return { part: 'rec', u: Math.min(1, (f.mt - s - a) / Math.max(1, r)) };
  }

  // ---------------------------------------------------------------- attacks

  function attack(p, f, ch, time, T, K) {
    const m = f.move;
    const ph = phase(f);
    const hit = ph.part === 'active' || (ph.part === 'rec' && ph.u < 0.45);
    switch (m.anim) {
      case 'jab': case 'straight': {
        if (p.zombie) {
          stance(T, ch, p, time);
          const right = m.anim === 'straight';
          if (ph.part === 'start') Object.assign(T, right ? { ra: 2.3 } : { la: 2.3 }, { lean: 0.05 });
          else if (hit) Object.assign(T, right ? { ra: 1.15, raz: 0.15 } : { la: 1.15, laz: -0.15 }, { lean: -0.4, twist: right ? 0.3 : -0.3 });
          return { k: K.fast };
        }
        if (hit) {
          if (m.name === 'power') {
            Object.assign(T, { ll: 0.7, rl: -0.5, la: 2.2, laz: 0.4, ra: 1.58, raz: -0.05, lean: -0.45, twist: 0.6, head: 0.2, bob: -0.08 });
            return { k: K.fast };
          }
          return { kitMode: m.anim, k: K.fast };
        }
        stance(T, ch, p, time);
        return { k: K.fast };
      }
      case 'kick': {
        stance(T, ch, p, time);
        if (ph.part === 'start') Object.assign(T, { ll: 0.9, rl: -0.25, lean: 0.15 });
        else if (hit) Object.assign(T, { ll: 1.25, rl: -0.3, lean: 0.3, twist: -0.15 });
        return { k: K.fast };
      }
      case 'lowjab':
        crouch(T);
        Object.assign(T, { la: 2.0, ra: 1.9, laz: 0.35, raz: -0.35 });
        if (hit) Object.assign(T, { la: 1.5, laz: 0.05, twist: -0.35 });
        return { k: K.fast };
      case 'sweep':
        crouch(T, true);
        Object.assign(T, { la: 0.9, ra: 0.6, laz: -0.2, raz: 0.2 });
        if (hit) Object.assign(T, { ll: 1.9, rl: -0.6, llz: 0, lean: -0.35, twist: -0.3 });
        return { k: K.fast };
      case 'jpunch':
        Object.assign(T, { ll: 1.0, rl: 0.3, la: 2.1, ra: 2.1, laz: 0.3, raz: -0.35, lean: -0.25 });
        if (ph.part !== 'start') Object.assign(T, { la: 1.15, laz: 0.1, twist: -0.3 });
        return { k: K.fast };
      case 'jkick':
        Object.assign(T, { ll: 1.2, rl: 0.6, la: 2.3, ra: 0.5, laz: 0.3, raz: 0.3, lean: 0.1 });
        if (ph.part !== 'start') Object.assign(T, { ll: 1.55, rl: -0.5, lean: 0.25 });
        return { k: K.fast };

      // ---- specials
      case 'jumpshot': {
        const air = f.y > 0.02;
        if (!air && f.mt < m.jumpAt) {
          // dip with the ball at the chest
          Object.assign(T, { rigY: 0.36, ll: 0.6, rl: -0.2, la: 1.35, ra: 1.35, laz: 0.4, raz: -0.4, lean: -0.2, head: -0.1 });
          return { k: K.fast, ball: true };
        }
        if (f.mt < m.spawnAt) return { kitMode: 'jumpshot', k: K.fast, ball: true };
        if (air) {
          Object.assign(T, { ll: 0.25, rl: 0.25, la: 2.55, ra: 2.55, laz: 0.1, raz: -0.1, lean: -0.05, head: -0.2 }); // follow through, wrists flicked
          return { k: K.fast };
        }
        stance(T, ch, p, time);
        T.rigY = 0.42; // soft landing
        return { k: K.med };
      }
      case 'peace':
        if (f.mt < 9) {
          Object.assign(T, { la: 0.6, ra: 0.6, laz: 0.55, raz: -0.55, lean: -0.25, rigY: 0.45, head: 0.2 }); // scrunch up...
          return { k: K.fast };
        }
        return { kitMode: 'peace', k: K.fast, extra: { rigY: 0.55 } }; // ...and Y!
      case 'dash':
        if (f.mt <= m.dash[0]) {
          Object.assign(T, { lean: -0.45, rigY: 0.42, ll: 0.8, rl: -0.6, la: -0.5, ra: 1.0 });
          return { k: K.fast };
        }
        if (f.mt <= m.dash[1]) {
          const s = Math.sin(time * 24);
          Object.assign(T, { lean: -0.55, ll: 0.55 + s * 1.0, rl: 0.55 - s * 1.0, la: -0.8, ra: 1.65, raz: -0.1, twist: 0.4, head: 0.35 });
          return { k: K.fast };
        }
        stance(T, ch, p, time);
        return { k: K.med };
      case 'throw':
        stance(T, ch, p, time);
        if (f.mt < m.spawnAt) Object.assign(T, { ra: -1.2, raz: 0.3, twist: -0.5, lean: 0.1 });
        else if (f.mt < m.spawnAt + 12) Object.assign(T, { ra: 1.9, raz: -0.1, twist: 0.5, lean: -0.3 });
        return { k: K.fast };
      case 'zap':
        stance(T, ch, p, time);
        if (f.mt < m.spawnAt) Object.assign(T, { la: 1.55, ra: 1.55, laz: 0.22, raz: -0.22, twist: 0, rigZ: Math.sin(time * 70) * 0.04 });
        else if (f.mt < m.spawnAt + 14) Object.assign(T, { la: 1.62, ra: 1.62, laz: 0.2, raz: -0.2, twist: 0, lean: 0.15 });
        return { k: K.fast };
      case 'slam':
        if (f.landedAt < 0 && f.mt < m.jumpAt) {
          Object.assign(T, { rigY: 0.35, ll: 0.6, rl: -0.3, la: 2.6, ra: 2.6, laz: -0.3, raz: 0.3, lean: -0.15 });
          return { k: K.fast };
        }
        if (f.landedAt < 0) {
          Object.assign(T, { ll: 0.9, rl: 0.9, la: 3.0, ra: 3.0, laz: -0.3, raz: 0.3, lean: -0.1, head: -0.2 }); // arms overhead
          return { k: K.fast };
        }
        Object.assign(T, { rigY: 0.25, ll: 1.1, rl: -0.6, llz: -0.3, rlz: 0.3, la: 1.0, ra: 1.0, lean: -0.45 }); // THUD
        return { k: K.fast };
      case 'boo':
        if (f.mt < m.spawnAt) Object.assign(T, { la: 2.9, ra: 2.9, laz: -0.7, raz: 0.7, lean: 0.3, head: -0.3, ll: 0.3, rl: -0.3 }); // rear up...
        else Object.assign(T, { la: 1.7, ra: 1.7, laz: -0.45, raz: 0.45, lean: -0.45, head: 0.1, ll: 0.6, rl: -0.4 }); // ...BOO!
        return { k: K.fast };
    }
    stance(T, ch, p, time);
    return { k: K.med };
  }

  // ---------------------------------------------------------------- the whole fighter

  // Poses a kit person from a fighter's engine state. Returns { hop, ball } for the renderer: extra height for
  // celebration bounces, and whether a basketball should sit in the hands.
  // hello: a kit pose to strike during the round-one intro (Teddy shadow-boxes, Tommy does his Y).
  function apply(p, f, ch, time, dt, hello) {
    const K = { fast: 1 - Math.exp(-30 * dt), med: 1 - Math.exp(-16 * dt), slow: 1 - Math.exp(-7 * dt) };
    const T = base();
    let k = K.med, kitMode = null, extra = null, ball = false, hop = 0;
    const t = f.t / 60;

    switch (f.state) {
      case 'intro': case 'idle': case 'land': case 'getup':
        if (f.state === 'intro' && hello && KIT[hello]) {
          kitMode = hello;
          break;
        }
        stance(T, ch, p, time);
        if (f.guard) blockArms(T, ch, p);
        if (f.state === 'land') T.rigY = 0.45;
        if (f.state === 'getup') k = K.slow;
        break;
      case 'walk': {
        stance(T, ch, p, time);
        walkLegs(T, time, Math.sign(f.vx) * f.facing || 1);
        break;
      }
      case 'crouch':
        stance(T, ch, p, time);
        crouch(T);
        if (f.guard) blockArms(T, ch, p);
        break;
      case 'blockstun':
        stance(T, ch, p, time);
        if (f.crouchBlock) crouch(T);
        blockArms(T, ch, p);
        T.rigZ = Math.sin(f.t * 1.7) * 0.04;
        k = K.fast;
        break;
      case 'jump':
        Object.assign(T, { ll: 1.2, rl: 0.4, la: 2.1, ra: 1.9, laz: 0.3, raz: -0.3, lean: -0.1 });
        if (ch.idle === 'guard') Object.assign(T, { la: 2.2, ra: 2.2, laz: 0.4, raz: -0.4 });
        break;
      case 'attack': {
        const r = attack(p, f, ch, time, T, K);
        k = r.k;
        kitMode = r.kitMode || null;
        extra = r.extra || null;
        ball = !!r.ball;
        break;
      }
      case 'hitstun':
        Object.assign(T, { lean: 0.4, head: -0.35, la: 0.4, ra: 0.2, laz: -0.8, raz: 0.8, ll: 0.35, rl: -0.4, rigZ: Math.sin(f.t * 1.9) * 0.08 });
        k = K.fast;
        break;
      case 'airhit':
        Object.assign(T, { lean: 0.5, ll: 1.0, rl: 0.5, la: 2.7, ra: 2.6, laz: -0.5, raz: 0.5, head: -0.4, rigX: Math.min(1.1, f.t * 0.05) });
        k = K.fast;
        break;
      case 'knockdown':
        lying(T, f.t);
        k = f.t < 6 ? K.fast : K.med;
        break;
      case 'ko':
        if (f.y > 0.02) {
          Object.assign(T, { lean: 0.5, ll: 1.0, rl: 0.5, la: 2.7, ra: 2.6, laz: -0.5, raz: 0.5, head: -0.4, rigX: Math.min(1.1, f.t * 0.05) });
          k = K.fast;
        } else if (f.t < 40 && f.koFall) {
          lying(T, f.t);
        } else {
          dizzySit(T, time);
          k = K.slow;
        }
        break;
      case 'win': {
        const w = ch.win;
        const cyc = t % 3;
        if (w === 'jumpshot') {
          // shadow-box, then a jump shot, over and over
          if (cyc < 1.5) kitMode = 'boxing';
          else {
            const u = (cyc - 1.5) / 1.5;
            hop = Math.max(0, Math.sin(u * PI)) * 0.9;
            kitMode = u < 0.55 ? 'jumpshot' : null;
            if (!kitMode) Object.assign(T, { ll: 0.25, rl: 0.25, la: 2.55, ra: 2.55, laz: 0.1, raz: -0.1, head: -0.2 });
            ball = u < 0.55;
          }
        } else {
          kitMode = w;
          hop = Math.abs(Math.sin(t * 5)) * 0.18;
        }
        k = K.med;
        break;
      }
      default:
        stance(T, ch, p, time);
    }

    if (kitMode && KIT[kitMode]) {
      const ph = kitMode === 'boxing' ? time * 7 : time * 4;
      kit(p, ph, kitMode, k, extra);
      // the kit's peace and wave poses step in place; keep feet planted when attacking
      if (f.state === 'attack') {
        p.legL.rotation.x += (0.35 - p.legL.rotation.x) * k;
        p.legR.rotation.x += (-0.25 - p.legR.rotation.x) * k;
      }
    } else drive(p, T, k);
    return { hop, ball };
  }

  // Flat on their back, arms flopped overhead, with a little bounce as they land.
  function lying(T, t) {
    const bounce = t < 10 ? Math.sin((t / 10) * PI) * 0.15 : 0;
    Object.assign(T, { rigX: PI / 2, rigY: 0.2 + bounce, lean: 0, ll: 0.3, rl: 0.12, llz: -0.15, rlz: 0.15, la: 2.9, ra: 2.6, laz: -0.4, raz: 0.4, head: 0 });
  }

  // KO'd: sitting on the ground, legs out, propped on their hands, head wobbling under circling stars.
  function dizzySit(T, time) {
    const lean = 0.15;
    Object.assign(T, {
      rigY: -0.18, lean, ll: 1.57 - lean, rl: 1.5 - lean, llz: -0.18, rlz: 0.18,
      la: -0.5 - lean, ra: -0.45 - lean, laz: -0.35, raz: 0.35,
      head: 0.1 + Math.sin(time * 2.1) * 0.18, headZ: Math.sin(time * 3) * 0.3, twist: Math.sin(time * 1.7) * 0.25, rigZ: Math.sin(time * 2.4) * 0.06,
    });
  }

  window.KofPoses = { apply, drive, base };
})();
