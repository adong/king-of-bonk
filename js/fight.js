/* King of Bonk — the fight engine.
   No Three.js in here: a match is plain state stepped at a fixed 60 frames a second, so the browser game and the
   headless match runner (kof.sim) play by exactly the same rules.
   x runs along the stage in metres (+ is right) and y is height. A move's hitbox is written relative to the fighter,
   [front0, front1, bottom, top], where + means "in front of them"; it is flipped by their facing.
   The renderer reads match state and drains match.events (hits, blocks, banners) to play effects and sounds. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- tuning
  const FPS = 60, DT = 1 / FPS;
  const HP = 100;
  const ROUND_TIME = 60; // seconds
  const ROUNDS_TO_WIN = 2, MAX_ROUNDS = 5;
  const STAGE = 6.6; // fighters stay within ±STAGE
  const MAX_SEP = 8; // ...and never further apart than this, so the camera keeps both in frame
  const PUSH_W = 0.36; // half-width of a body for pushing
  const GRAVITY = 26;
  const JUMP_VY = 8.8, JUMP_VX = 3; // apex ≈ 1.5 m, about 0.68 s in the air
  const WALK_F = 2.6, WALK_B = 2;
  const BUFFER = 8; // a button press is remembered this many frames, so slightly early presses still come out
  const SPECIAL_CD = 210; // 3.5 s between specials
  const DECAY = 0.88; // per-frame slowdown of pushback
  const START_X = 2;
  const INTRO = 100, // frames of ROUND N / FIGHT! before control
    WIN_AT = 80, // frames after a KO before the winner celebrates
    NEXT_AT = 260; // frames after a KO before the next round

  const STAND = [-0.36, 0.36, 0, 1.85], CROUCH = [-0.38, 0.38, 0, 1.2], AIR = [-0.34, 0.34, 0.1, 1.7];

  // s = startup frames, a = active frames, r = recovery frames. hs / bs = hitstun / blockstun frames.
  // push = pushback speed (m/s), kd = knocks down, launch = upward speed when knocked down.
  const MOVES = {
    jab: { anim: 'jab', s: 4, a: 3, r: 9, dmg: 4, hs: 16, bs: 7, push: 2.2, hb: [0.2, 0.95, 1.2, 1.6], lunge: 1.8, word: 'BOP!' },
    straight: { anim: 'straight', s: 6, a: 3, r: 14, dmg: 6, hs: 20, bs: 9, push: 3.2, hb: [0.2, 1.1, 1.2, 1.6], lunge: 2.6, word: 'POW!' },
    power: { anim: 'straight', s: 7, a: 4, r: 20, dmg: 9, hs: 24, bs: 11, push: 6, kd: true, launch: 5.5, hb: [0.2, 1.15, 1.15, 1.65], lunge: 3, word: 'KAPOW!', big: true },
    kick: { anim: 'kick', s: 7, a: 4, r: 15, dmg: 7, hs: 18, bs: 9, push: 4.5, hb: [0.25, 1.3, 0.55, 1.15], word: 'WHAM!' },
    lowjab: { anim: 'lowjab', crouch: true, s: 4, a: 3, r: 9, dmg: 3, hs: 14, bs: 6, push: 2.8, hb: [0.2, 0.95, 0.55, 1.0], word: 'BIP!' },
    sweep: { anim: 'sweep', crouch: true, s: 8, a: 4, r: 20, dmg: 6, hs: 20, bs: 10, push: 3, kd: true, launch: 3.5, hb: [0.25, 1.35, 0, 0.4], word: 'BONK!' },
    jpunch: { anim: 'jpunch', air: true, s: 4, a: 9, r: 6, dmg: 6, hs: 18, bs: 10, push: 3.5, hb: [0.1, 0.9, 0.6, 1.3], word: 'BOP!' },
    jkick: { anim: 'jkick', air: true, s: 5, a: 11, r: 6, dmg: 8, hs: 20, bs: 11, push: 4, hb: [0.1, 1.15, 0.15, 0.85], word: 'WHAM!' },
  };

  // One button each, with a cooldown. len = frames on the ground; a special that leaves the ground holds its last
  // frame until landing, then has landLag frames of recovery. spawnAt fires a projectile, jumpAt hops,
  // dash = [from, to, speed] slides forward, and s/a/hb make the special itself hit (dash, slam landing).
  const SPECIALS = {
    jumpshot: { anim: 'jumpshot', len: 30, jumpAt: 7, jumpVy: 8.4, spawnAt: 24, proj: 'ball', landLag: 8 },
    peace: { anim: 'peace', len: 46, spawnAt: 14, proj: 'peace' },
    dash: { anim: 'dash', len: 36, dash: [6, 22, 10.5], s: 6, a: 16, dmg: 10, hs: 24, bs: 14, push: 6, kd: true, launch: 5, hb: [0.1, 0.95, 0.9, 1.6], word: 'ZOOM!', big: true, stopOnHit: true },
    moon: { anim: 'throw', len: 36, spawnAt: 12, proj: 'moon' },
    zap: { anim: 'zap', len: 40, spawnAt: 16, proj: 'zap' },
    slam: { anim: 'slam', len: 34, jumpAt: 8, jumpVy: 9.4, jumpVx: 2.6, landProj: 'shock', landLag: 18, landHit: { dmg: 10, hs: 22, bs: 12, push: 5, kd: true, launch: 5, hb: [-0.6, 1.1, 0, 0.9], word: 'THUD!', big: true } },
    boo: { anim: 'boo', len: 44, spawnAt: 16, proj: 'boo' },
  };

  // Projectiles: half-sizes w/h, start height y, speed vx (m/s, forward), ax = forward acceleration (the boomerang
  // comes back), g = gravity (the basketball arcs), life in frames.
  const PROJ = {
    ball: { emoji: '🏀', w: 0.24, h: 0.24, g: 15, life: 160, dmg: 10, hs: 22, bs: 12, push: 4.5, kd: true, launch: 4.5, word: 'SWISH!', big: true },
    peace: { emoji: '✌️', w: 0.36, h: 0.75, y: 0.95, vx: 5.5, life: 110, dmg: 10, hs: 24, bs: 12, push: 5, kd: true, launch: 4, word: 'PEACE!', big: true },
    moon: { emoji: '🌙', w: 0.28, h: 0.28, y: 1.35, vx: 8.5, ax: -9, life: 140, dmg: 9, hs: 22, bs: 12, push: 4.5, word: 'BONK!', boomerang: true },
    zap: { emoji: '⚡', w: 0.32, h: 0.16, y: 1.48, vx: 10, life: 90, dmg: 9, hs: 20, bs: 12, push: 4.5, word: 'ZAP!' },
    shock: { emoji: '💥', w: 0.42, h: 0.3, y: 0.25, vx: 6.5, life: 55, dmg: 10, hs: 22, bs: 12, push: 5, kd: true, launch: 4.5, word: 'THUD!', big: true },
    boo: { emoji: '👻', w: 0.45, h: 0.6, y: 1.2, vx: 4.5, life: 34, dmg: 9, hs: 30, bs: 12, push: 4, kd: true, launch: 6, word: 'BOO!', big: true },
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const overlap = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
  const blankInput = () => ({ left: false, right: false, up: false, down: false, block: false, p: false, k: false, s: false });

  // ---------------------------------------------------------------- fighters

  function newFighter(side, char, mods) {
    return {
      side, char, id: char.id,
      x: 0, y: 0, vx: 0, vy: 0, px: 0, facing: side === 0 ? 1 : -1,
      hp: HP, state: 'intro', t: 0,
      move: null, mt: 0, hasHit: false, strIdx: 0, queued: false, landedAt: -1, airUsed: false,
      stun: 0, cd: 0, inv: 0, combo: 0, guard: false, threat: false,
      buf: { p: 99, k: 99, s: 99 }, held: blankInput(),
      dmgMult: (mods && mods.dmg) || 1, speedMult: (mods && mods.walk) || 1,
      stats: { hits: 0, blocks: 0, specials: 0, maxCombo: 0, dealt: 0 },
    };
  }

  function resetFighter(f) {
    Object.assign(f, {
      x: f.side === 0 ? -START_X : START_X, y: 0, vx: 0, vy: 0, px: 0, facing: f.side === 0 ? 1 : -1,
      hp: HP, state: 'intro', t: 0, move: null, mt: 0, hasHit: false, strIdx: 0, queued: false, landedAt: -1,
      airUsed: false, stun: 0, cd: 60, inv: 0, combo: 0, guard: false, threat: false, koFall: false, crouchBlock: false,
    });
    f.px = f.x;
    f.buf.p = f.buf.k = f.buf.s = 99;
  }

  function setState(f, s) {
    f.state = s;
    f.t = 0;
  }

  // Hurtbox in world space, or null while untouchable (down, getting up, KO'd, celebrating).
  function hurtbox(f) {
    if (f.inv > 0) return null;
    let b;
    switch (f.state) {
      case 'idle': case 'walk': case 'land': case 'hitstun':
        b = STAND;
        break;
      case 'blockstun':
        b = f.crouchBlock ? CROUCH : STAND;
        break;
      case 'crouch':
        b = CROUCH;
        break;
      case 'jump':
        b = AIR;
        break;
      case 'attack':
        b = f.y > 0.05 ? AIR : f.move.crouch ? CROUCH : STAND;
        break;
      default:
        return null; // intro, airhit, knockdown, getup, ko, win
    }
    return [f.x + b[0], f.x + b[1], f.y + b[2], f.y + b[3]];
  }

  function hitboxWorld(f, hb) {
    const x0 = f.facing > 0 ? f.x + hb[0] : f.x - hb[1];
    const x1 = f.facing > 0 ? f.x + hb[1] : f.x - hb[0];
    return [x0, x1, f.y + hb[2], f.y + hb[3]];
  }

  const grounded = (f) => f.y <= 0 && f.vy <= 0;
  const free = (f) => f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';

  function startMove(M, f, name, def, special) {
    setState(f, 'attack');
    f.move = Object.assign({ name, special: !!special }, def);
    f.mt = 0;
    f.hasHit = false;
    f.queued = false;
    f.landedAt = -1;
    if (special) {
      f.cd = SPECIAL_CD;
      f.stats.specials++;
      M.events.push({ type: 'special', side: f.side, name: f.char.specialName || name, special: name });
    }
  }

  function moveActive(f) {
    const m = f.move;
    if (!m || !m.hb) return false;
    if (m.dash && f.hasHit && m.stopOnHit) return false;
    return f.mt > m.s && f.mt <= m.s + m.a;
  }

  function moveDone(f) {
    const m = f.move;
    if (f.landedAt >= 0) return f.mt >= f.landedAt + (m.landLag || 6);
    if (f.y > 0.001) return false; // airborne specials hold until they land
    const len = m.len || m.s + m.a + m.r;
    return f.mt >= len;
  }

  // ---------------------------------------------------------------- one fighter, one frame

  function fighterStep(M, f, foe, inp, canAct) {
    f.t++;
    if (f.cd > 0) f.cd--;
    if (f.inv > 0) f.inv--;
    f.held = inp;
    for (const b of ['p', 'k', 's']) f.buf[b] = inp[b] ? 0 : f.buf[b] + 1;
    const fwd = f.facing > 0 ? inp.right : inp.left;
    const back = f.facing > 0 ? inp.left : inp.right;
    const walk = f.char.walk * f.speedMult;
    f.guard = false;

    switch (f.state) {
      case 'blockstun':
        f.vx *= DECAY;
        f.guard = true;
        if (--f.stun > 0) break;
        f.guard = false;
        setState(f, inp.down ? 'crouch' : 'idle');
      // falls through: act on the same frame the stun ends
      case 'idle': case 'walk': case 'crouch': case 'intro': {
        if (f.state === 'intro' && !canAct) {
          f.vx = 0;
          break;
        }
        if (!canAct) {
          if (f.state !== 'idle') setState(f, 'idle');
          f.vx = 0;
          break;
        }
        const crouching = inp.down;
        if (f.buf.s <= BUFFER && f.cd === 0) {
          f.buf.s = 99;
          startMove(M, f, f.char.special, SPECIALS[f.char.special], true);
          break;
        }
        if (f.buf.k <= BUFFER) {
          f.buf.k = 99;
          startMove(M, f, crouching ? 'sweep' : 'kick', MOVES[crouching ? 'sweep' : 'kick']);
          M.events.push({ type: 'swing', side: f.side });
          break;
        }
        if (f.buf.p <= BUFFER) {
          f.buf.p = 99;
          f.strIdx = 0;
          const name = crouching ? 'lowjab' : f.char.string[0];
          startMove(M, f, name, MOVES[name]);
          M.events.push({ type: 'swing', side: f.side });
          break;
        }
        if (inp.up) {
          setState(f, 'jump');
          f.vy = JUMP_VY;
          f.vx = (fwd ? 1 : back ? -1 : 0) * JUMP_VX * f.facing;
          f.airUsed = false;
          M.events.push({ type: 'jump', side: f.side });
          break;
        }
        if (crouching) {
          if (f.state !== 'crouch') setState(f, 'crouch');
          f.vx = 0;
          f.guard = back || inp.block;
          break;
        }
        if (inp.block || (back && f.threat)) {
          // standing guard: the block button, or holding back while something is coming
          if (f.state !== 'idle') setState(f, 'idle');
          f.vx = 0;
          f.guard = true;
          break;
        }
        if (fwd || back) {
          if (f.state !== 'walk') setState(f, 'walk');
          f.vx = (fwd ? WALK_F : -WALK_B) * walk * f.facing;
          break;
        }
        if (f.state !== 'idle') setState(f, 'idle');
        f.vx = 0;
        break;
      }
      case 'jump':
        if (canAct && !f.airUsed && (f.buf.k <= BUFFER || f.buf.p <= BUFFER)) {
          const name = f.buf.k <= BUFFER ? 'jkick' : 'jpunch';
          f.buf.k = f.buf.p = 99;
          f.airUsed = true;
          startMove(M, f, name, MOVES[name]);
          M.events.push({ type: 'swing', side: f.side });
        }
        break;
      case 'attack':
        attackStep(M, f, foe, inp, canAct);
        break;
      case 'land':
        f.vx *= DECAY;
        if (f.t >= 5) setState(f, 'idle');
        break;
      case 'hitstun':
        f.vx *= DECAY;
        if (--f.stun <= 0) {
          setState(f, 'idle');
          f.combo = 0;
        }
        break;
      case 'knockdown':
        f.vx *= DECAY;
        if (f.t >= 38) setState(f, 'getup');
        break;
      case 'getup':
        f.vx = 0;
        if (f.t >= 20) {
          setState(f, 'idle');
          f.inv = 10;
          f.combo = 0;
        }
        break;
      case 'ko': case 'win':
        if (grounded(f)) f.vx *= DECAY;
        break;
      // 'airhit' is all physics
    }
    physics(M, f);
  }

  function attackStep(M, f, foe, inp, canAct) {
    const m = f.move;
    f.mt++;
    // punch strings: press punch again to chain the next blow (Teddy's jab, straight, jab, power straight)
    if (canAct && m.name === f.char.string[f.strIdx] && f.strIdx + 1 < f.char.string.length && !m.air &&
      f.buf.p <= BUFFER && f.mt >= m.s - 2) {
      f.buf.p = 99;
      f.queued = true;
    }
    if (f.queued && f.mt >= m.s + m.a) {
      f.strIdx++;
      const name = f.char.string[f.strIdx];
      startMove(M, f, name, MOVES[name]);
      M.events.push({ type: 'swing', side: f.side });
      return;
    }
    if (f.y <= 0) {
      if (m.dash && f.mt > m.dash[0] && f.mt <= m.dash[1] && !(f.hasHit && m.stopOnHit)) f.vx = m.dash[2] * f.facing;
      else if (m.lunge && f.mt <= m.s + m.a) f.vx = m.lunge * f.facing;
      else if (!m.jumpAt || f.mt < m.jumpAt) f.vx *= 0.7;
    }
    if (m.jumpAt && f.mt === m.jumpAt) {
      f.vy = m.jumpVy;
      f.vx = (m.jumpVx || 0) * f.facing;
      M.events.push({ type: 'jump', side: f.side });
    }
    if (m.spawnAt && f.mt === m.spawnAt) spawn(M, f, foe, m.proj);
    if (m.dash && f.mt === m.dash[0] + 1) M.events.push({ type: 'swing', side: f.side, big: true });
    if (moveDone(f)) {
      f.move = null;
      if (f.y > 0.001) {
        setState(f, 'jump');
        f.airUsed = true;
      } else setState(f, 'idle');
    }
  }

  function physics(M, f) {
    f.px = f.x;
    const airborne = f.y > 0 || f.vy > 0;
    if (airborne) {
      f.vy -= GRAVITY * DT;
      f.y += f.vy * DT;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        onLand(M, f);
      }
    }
    f.x += f.vx * DT;
  }

  function onLand(M, f) {
    switch (f.state) {
      case 'jump':
        setState(f, 'land');
        f.vx = 0;
        M.events.push({ type: 'land', side: f.side });
        break;
      case 'attack': {
        const m = f.move;
        if (m.air) {
          f.move = null;
          setState(f, 'land');
          f.vx = 0;
        } else if (f.landedAt < 0) {
          f.landedAt = f.mt;
          f.vx = 0;
          if (m.landProj) {
            spawn(M, f, null, m.landProj);
            f.move = Object.assign({}, m, m.landHit, { s: f.mt, a: 4 }); // the landing itself hits next to Bruno
            f.hasHit = false;
          }
        }
        M.events.push({ type: 'land', side: f.side, big: !!m.landProj });
        break;
      }
      case 'airhit':
        f.vx *= 0.4;
        if (f.hp <= 0) {
          setState(f, 'ko');
          f.koFall = true; // lands flat, then sits up dizzy
        } else setState(f, 'knockdown');
        M.events.push({ type: 'down', side: f.side, x: f.x });
        break;
      case 'ko':
        M.events.push({ type: 'down', side: f.side, x: f.x });
        break;
      default:
        M.events.push({ type: 'land', side: f.side });
    }
  }

  // ---------------------------------------------------------------- projectiles

  let projId = 0;

  function spawn(M, f, foe, kind) {
    const d = PROJ[kind];
    const p = {
      id: ++projId, kind, emoji: d.emoji, owner: f.side, def: d, t: 0, spent: false, dead: false,
      x: f.x + 0.55 * f.facing, y: d.y !== undefined ? d.y : f.y + 2.25, vx: (d.vx || 0) * f.facing, vy: 0,
      ax: (d.ax || 0) * f.facing, dir: f.facing,
    };
    if (kind === 'ball') {
      // a jump shot: aim the arc so it drops onto the foe's chest
      p.x = f.x + 0.2 * f.facing;
      const tx = foe.x, ty = foe.y + 1.25;
      const dx = tx - p.x;
      const T = clamp(Math.abs(dx) / 7, 0.4, 0.9);
      p.vx = dx / T;
      p.vy = (ty - p.y + 0.5 * d.g * T * T) / T;
      p.dir = sgn(dx) || f.facing;
    }
    M.proj.push(p);
    M.events.push({ type: 'spawn', side: f.side, kind, x: p.x, y: p.y });
  }

  function projStep(M) {
    for (const p of M.proj) {
      const d = p.def;
      p.t++;
      p.vx += p.ax * DT;
      if (d.g) p.vy -= d.g * DT;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      if (d.g && p.y < d.h) {
        // the basketball bounces once and is then just a ball
        p.y = d.h;
        p.vy = Math.abs(p.vy) * 0.5;
        p.vx *= 0.6;
        if (!p.spent) M.events.push({ type: 'bounce', x: p.x });
        p.spent = true;
      }
      if (d.boomerang && p.t > 20) {
        const owner = M.f[p.owner];
        if (sgn(p.vx) === -p.dir && Math.abs(p.x - owner.x) < 0.5) p.dead = true; // caught it
      }
      if (p.t >= d.life || Math.abs(p.x) > STAGE + 3) p.dead = true;
    }
  }

  const projBox = (p) => [p.x - p.def.w, p.x + p.def.w, p.y - p.def.h, p.y + p.def.h];

  // ---------------------------------------------------------------- hits

  function canBlock(def, dir) {
    if (!grounded(def)) return false;
    if (!(free(def) || def.state === 'blockstun')) return false;
    const away = dir > 0 ? def.held.right : def.held.left;
    return away || def.held.block;
  }

  function applyHit(M, att, def, m, dir, at) {
    if (canBlock(def, dir)) {
      setState(def, def.held.down ? 'crouch' : 'idle'); // stays crouched while blocking low
      def.state = 'blockstun';
      def.crouchBlock = def.held.down;
      def.stun = m.bs;
      def.vx = m.push * 0.75 * dir;
      def.stats.blocks++;
      M.hitstop = Math.max(M.hitstop, 4);
      M.events.push({ type: 'block', side: def.side, x: at[0], y: at[1] });
      pushOffWall(att, def, m, dir);
      return;
    }
    const comboing = def.state === 'hitstun' || def.state === 'airhit';
    def.combo = comboing ? def.combo + 1 : 1;
    const scale = Math.max(0.5, 1 - 0.12 * (def.combo - 1));
    const dmg = Math.max(1, Math.round(m.dmg * att.char.power * att.dmgMult * scale));
    def.hp = Math.max(0, def.hp - dmg);
    att.stats.hits++;
    att.stats.dealt += dmg;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, def.combo);
    def.move = null;
    if (m.kd || def.y > 0.05 || def.hp <= 0) {
      setState(def, 'airhit');
      def.vy = Math.max(m.launch || 4, def.hp <= 0 ? 6 : 0);
      def.vx = (m.push * 0.55 + (def.hp <= 0 ? 1.5 : 0)) * dir;
    } else {
      setState(def, 'hitstun');
      def.stun = m.hs;
      def.vx = m.push * dir;
    }
    const ko = def.hp <= 0;
    M.hitstop = Math.max(M.hitstop, ko ? 22 : m.big ? 9 : 6);
    M.events.push({ type: 'hit', side: att.side, x: at[0], y: at[1], dmg, word: ko ? 'BONK!' : m.word, big: !!m.big || ko, combo: def.combo, ko });
    pushOffWall(att, def, m, dir);
  }

  // A cornered defender can't slide back, so the attacker bounces off instead.
  function pushOffWall(att, def, m, dir) {
    if (Math.abs(def.x) > STAGE - 0.15 && sgn(def.x) === dir && grounded(att) && att.state === 'attack') att.vx = -m.push * 0.7 * dir;
  }

  function resolveHits(M) {
    const pending = [];
    for (const att of M.f) {
      const def = M.f[att.side ^ 1];
      if (att.state !== 'attack' || att.hasHit || !moveActive(att)) continue;
      const hb = hitboxWorld(att, att.move.hb);
      const hu = hurtbox(def);
      if (hu && overlap(hb, hu)) {
        const at = [(Math.max(hb[0], hu[0]) + Math.min(hb[1], hu[1])) / 2, (Math.max(hb[2], hu[2]) + Math.min(hb[3], hu[3])) / 2];
        pending.push([att, def, att.move, att.facing, at]);
      }
    }
    // projectiles cancel each other out
    for (const a of M.proj) {
      if (a.dead || a.spent) continue;
      for (const b of M.proj) {
        if (b === a || b.dead || b.spent || b.owner === a.owner) continue;
        if (overlap(projBox(a), projBox(b))) {
          a.dead = b.dead = true;
          M.events.push({ type: 'clash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
      }
    }
    for (const p of M.proj) {
      if (p.dead || p.spent) continue;
      const def = M.f[p.owner ^ 1];
      const hu = hurtbox(def);
      if (hu && overlap(projBox(p), hu)) {
        p.dead = true;
        pending.push([M.f[p.owner], def, p.def, sgn(p.vx) || p.dir, [p.x, p.y]]);
      }
    }
    // everything decided above happens together, so two blows on the same frame trade
    for (const [att, def, m, dir, at] of pending) {
      if (att.move === m) att.hasHit = true;
      applyHit(M, att, def, m, dir, at);
    }
    M.proj = M.proj.filter((p) => !p.dead);
  }

  // ---------------------------------------------------------------- spacing

  function separate(M) {
    const [a, b] = M.f;
    // bodies push each other apart (unless one is jumping over the other's head)
    const dx = b.x - a.x;
    if (Math.abs(dx) < PUSH_W * 2 && Math.abs(a.y - b.y) < 1.5 && a.state !== 'ko' && b.state !== 'ko') {
      const dir = sgn(dx) || (a.facing > 0 ? 1 : -1);
      const push = (PUSH_W * 2 - Math.abs(dx)) / 2;
      a.x -= push * dir;
      b.x += push * dir;
    }
    // never further apart than the camera can show: undo whoever walked away
    let sep = Math.abs(b.x - a.x);
    if (sep > MAX_SEP) {
      let ex = sep - MAX_SEP;
      for (const f of M.f) {
        const o = M.f[f.side ^ 1];
        const out = sgn(f.x - o.x);
        const away = (f.x - f.px) * out;
        if (away > 0 && ex > 0) {
          const k = Math.min(away, ex);
          f.x -= k * out;
          ex -= k;
        }
      }
      if (ex > 0) {
        const out = sgn(b.x - a.x) || 1;
        a.x += (ex / 2) * out;
        b.x -= (ex / 2) * out;
      }
    }
    // walls; whoever is pinned pushes the other one out
    for (const f of M.f) {
      if (Math.abs(f.x) > STAGE) {
        f.x = clamp(f.x, -STAGE, STAGE);
        const o = M.f[f.side ^ 1];
        if (Math.abs(o.x - f.x) < PUSH_W * 2 && Math.abs(a.y - b.y) < 1.5) o.x = f.x - sgn(f.x) * PUSH_W * 2;
      }
    }
  }

  function updateFacing(M) {
    for (const f of M.f) {
      const o = M.f[f.side ^ 1];
      const turnable = free(f) || f.state === 'intro' || f.state === 'land' || f.state === 'getup';
      if (turnable && Math.abs(o.x - f.x) > 0.05) f.facing = sgn(o.x - f.x);
    }
  }

  // Something is about to hit you: the foe is winding up nearby, or one of their projectiles is on the way.
  // Holding back then guards on the spot instead of walking away.
  function updateThreat(M) {
    for (const f of M.f) {
      const o = M.f[f.side ^ 1];
      const near = Math.abs(o.x - f.x);
      let threat = o.state === 'attack' && near < (o.move.dash ? 6 : 2.8);
      for (const p of M.proj) if (p.owner !== f.side && !p.spent && Math.abs(p.x - f.x) < 3.2 && sgn(f.x - p.x) === sgn(p.vx)) threat = true;
      f.threat = threat;
    }
  }

  // ---------------------------------------------------------------- rounds

  function startRound(M) {
    M.round++;
    M.phase = 'intro';
    M.phaseT = 0;
    M.timer = ROUND_TIME * FPS;
    M.proj = [];
    M.hitstop = 0;
    M.roundStart = M.frame;
    for (const f of M.f) resetFighter(f);
  }

  function endRound(M, winner, how) {
    M.phase = how; // 'ko' | 'time'
    M.phaseT = 0;
    M.roundWinner = winner;
    if (winner >= 0) M.wins[winner]++;
    M.results.push({ round: M.round, winner, how, seconds: +((M.frame - M.roundStart - INTRO) / FPS).toFixed(1), hp: M.f.map((f) => f.hp) });
    if (how === 'time') {
      for (const f of M.f) {
        if (winner >= 0 && f.side !== winner) {
          setState(f, 'ko');
          f.koFall = false; // just plops down
          f.move = null;
        }
      }
    }
    M.events.push({ type: how, winner, double: winner < 0 && how === 'ko' });
  }

  function roundAftermath(M) {
    M.phaseT++;
    const w = M.roundWinner;
    if (M.phaseT === WIN_AT && w >= 0) {
      const f = M.f[w];
      M.proj = [];
      if (grounded(f)) {
        setState(f, 'win');
        f.move = null;
        f.vx = 0;
        M.events.push({ type: 'win', side: w });
      } else M.phaseT--; // wait for them to land
    }
    if (M.phaseT >= NEXT_AT) {
      const over = M.wins[0] >= ROUNDS_TO_WIN || M.wins[1] >= ROUNDS_TO_WIN || M.round >= MAX_ROUNDS;
      if (over) {
        M.phase = 'over';
        M.winner = M.wins[0] === M.wins[1] ? -1 : M.wins[0] > M.wins[1] ? 0 : 1;
        M.events.push({ type: 'over', winner: M.winner });
      } else {
        startRound(M);
      }
    }
  }

  // ---------------------------------------------------------------- the frame

  function step(M, inputs) {
    M.frame++;
    if (M.phase === 'over') return;
    if (M.hitstop > 0) {
      // frozen for a beat on impact; presses made now are still buffered
      M.hitstop--;
      for (const f of M.f) {
        const inp = inputs[f.side] || blankInput();
        for (const b of ['p', 'k', 's']) if (inp[b]) f.buf[b] = 0;
        f.held = inp;
      }
      return;
    }
    if (M.phase === 'intro') {
      M.phaseT++;
      if (M.phaseT === 1) M.events.push({ type: 'round', round: M.round, final: M.wins[0] === ROUNDS_TO_WIN - 1 && M.wins[1] === ROUNDS_TO_WIN - 1 });
      if (M.phaseT >= INTRO) {
        M.phase = 'fight';
        M.events.push({ type: 'fight' });
        for (const f of M.f) setState(f, 'idle');
      }
    } else if (M.phase === 'fight') {
      if (--M.timer <= 0) {
        const [a, b] = M.f;
        endRound(M, a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1, 'time');
      }
    } else roundAftermath(M);
    if (M.phase === 'over') return;

    const canAct = M.phase === 'fight';
    updateThreat(M);
    for (const f of M.f) fighterStep(M, f, M.f[f.side ^ 1], canAct ? inputs[f.side] || blankInput() : blankInput(), canAct);
    projStep(M);
    if (M.phase === 'fight') resolveHits(M);
    else M.proj = M.proj.filter((p) => !p.dead);
    separate(M);
    updateFacing(M);

    if (M.phase === 'fight') {
      const down = M.f.filter((f) => f.hp <= 0);
      if (down.length) endRound(M, down.length === 2 ? -1 : down[0].side ^ 1, 'ko');
    }
  }

  function create(opts) {
    const M = {
      opts, f: [], proj: [], events: [], wins: [0, 0], round: 0, phase: 'intro', phaseT: 0,
      timer: ROUND_TIME * FPS, hitstop: 0, frame: 0, results: [], winner: null, roundWinner: -1, roundStart: 0,
    };
    M.f = [0, 1].map((side) => newFighter(side, window.KofChars.get(opts.chars[side]), (opts.mods || [])[side]));
    startRound(M);
    M.step = (i1, i2) => step(M, [i1, i2]);
    return M;
  }

  window.KofFight = {
    create, blankInput, hurtbox, hitboxWorld, moveActive,
    FPS, DT, HP, ROUND_TIME, STAGE, MAX_SEP, BUFFER, SPECIAL_CD, INTRO, MOVES, SPECIALS, PROJ,
  };
})();
