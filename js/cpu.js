/* King of Bonk — computer opponents, plus the headless match runner used for testing.
   A brain is a function (match, me, foe) -> input snapshot, the same shape the keyboard produces. It only reads
   public match state, re-decides every `react` frames (its reaction time) and follows a short plan in between. */
(function () {
  'use strict';
  const F = window.KofFight;

  // react: frames between plan decisions. see: frames before it notices a blow or projectile coming, then
  // block: chance to guard against it. punish: chance to hit back when you miss. aggro: chance to attack when close.
  // chain: chance to keep pressing punch for a full string. special / jump / wait: chances per decision.
  // dmg and walk are multipliers the game applies to the CPU fighter.
  const LEVELS = {
    // for Tommy (5): slow to react, blocks now and then, never strings punches, hits for 65%
    easy: { react: 20, see: 12, block: 0.3, punish: 0.4, aggro: 0.6, chain: 0, special: 0.2, jump: 0.05, wait: 0.2, dmg: 0.65, walk: 0.85, range: 1.05 },
    // for Teddy (8): quicker, guards and hits back when you miss, uses strings and specials, full damage
    normal: { react: 15, see: 5, block: 0.4, punish: 0.5, aggro: 0.6, chain: 0.5, special: 0.3, jump: 0.12, wait: 0.12, dmg: 1, walk: 1, range: 1.2 },
  };

  const rnd = Math.random;
  const blank = F.blankInput;

  // Range at which each special is worth throwing.
  const SPECIAL_RANGE = { jumpshot: [2, 7], peace: [1.8, 7], moon: [2, 7], zap: [2, 8], dash: [1.8, 6], slam: [1.4, 3.6], boo: [0.6, 2.4] };

  // The foe has thrown their blow (hit, blocked or missed) and can't do anything else for a moment.
  function recovering(f) {
    if (f.state !== 'attack') return f.state === 'land';
    const m = f.move;
    if (m.spawnAt) return f.mt > m.spawnAt + 2;
    return m.s !== undefined && f.mt > m.s + (m.a || 0);
  }

  function brain(level) {
    if (level === 'masher') return masher();
    if (level === 'kid') return kid();
    if (level === 'idle') return () => blank();
    const L = LEVELS[level] || LEVELS.easy;
    let plan = 'wait', planT = 0, next = 20, presses = [], seenMove = null, seenProj = 0, punished = null;

    function setPlan(p, t) {
      plan = p;
      planT = t || 0;
    }

    function decide(M, me, foe, dist) {
      const incoming = M.proj.find((p) => p.owner !== me.side && !p.spent && Math.abs(p.x - me.x) < 4.5 && Math.sign(me.x - p.x) === Math.sign(p.vx));
      if (incoming) {
        const r = rnd();
        if (r < L.block) return setPlan('block', 30);
        if (r < L.block + L.jump * 2) return incoming.kind === 'zap' ? setPlan('duck', 24) : setPlan('hop', 2);
        return setPlan('wait', 10);
      }
      if (foe.state === 'attack' && dist < 2.6 && rnd() < L.block) return setPlan('block', 22);
      const sr = SPECIAL_RANGE[me.char.special] || [2, 7];
      if (me.cd === 0 && dist >= sr[0] && dist <= sr[1] && rnd() < L.special) return setPlan('special');
      if (rnd() < L.wait) return setPlan('wait', 18 + rnd() * 30);
      if (dist > L.range + 0.25) {
        if (dist < 4 && rnd() < L.jump) return setPlan('jumpin', 3);
        return setPlan('approach', 40);
      }
      if (rnd() < L.aggro) return setPlan('poke');
      if (rnd() < L.block) return setPlan('block', 16 + rnd() * 14); // guard and wait for a miss to punish
      return setPlan(rnd() < 0.5 ? 'retreat' : 'wait', 12 + rnd() * 16);
    }

    return function think(M, me, foe) {
      const inp = blank();
      if (M.phase !== 'fight') {
        presses = [];
        next = 10 + rnd() * 20;
        setPlan('wait');
        return inp;
      }
      const dist = Math.abs(foe.x - me.x);
      const fwd = foe.x > me.x ? 'right' : 'left', back = fwd === 'right' ? 'left' : 'right';
      if (--next <= 0) {
        next = L.react * (0.7 + rnd() * 0.6);
        decide(M, me, foe, dist);
      }
      // reflexes: a moment after it notices a blow coming it may guard; when you whiff it may hit back
      if (foe.state === 'attack' && foe.move !== seenMove && foe.mt >= L.see) {
        seenMove = foe.move;
        const m = foe.move;
        if (dist < 3 && rnd() < L.block) setPlan('block', (m.len || m.s + m.a + m.r) - foe.mt + 4);
      }
      const p = M.proj.find((q) => q.owner !== me.side && q.id > seenProj && q.t >= L.see);
      if (p) {
        seenProj = p.id;
        const r = rnd();
        if (r < L.block) setPlan('block', 40);
        else if (r < L.block + L.jump * 2) setPlan(p.kind === 'zap' ? 'duck' : 'hop', p.kind === 'zap' ? 24 : 2);
      }
      if (me.state === 'blockstun' && plan !== 'block' && rnd() < L.block) setPlan('block', 20); // keep guarding a string
      if (recovering(foe) && foe.move !== punished && (me.state === 'idle' || me.state === 'walk' || me.state === 'crouch') && dist < L.range + 0.25) {
        punished = foe.move;
        if (rnd() < L.punish) {
          presses = [];
          setPlan('poke');
        }
      }
      switch (plan) {
        case 'approach':
          inp[fwd] = true;
          if (dist < L.range) {
            next = Math.min(next, L.react * 0.3);
            setPlan('wait');
          }
          break;
        case 'poke':
          if (dist > 1.25 || rnd() < 0.2) presses.push({ in: 0, b: 'k' }); // a jab reaches about 1.3 m, a kick 1.65
          else {
            presses.push({ in: 0, b: 'p' });
            const n = rnd() < L.chain ? me.char.string.length - 1 : 0;
            for (let i = 1; i <= n; i++) presses.push({ in: i * 9, b: 'p' });
          }
          setPlan('wait');
          break;
        case 'special':
          presses.push({ in: 0, b: 's' });
          setPlan('wait');
          break;
        case 'jumpin':
          inp.up = true;
          inp[fwd] = true;
          if (--planT <= 0) setPlan('airkick');
          break;
        case 'hop':
          inp.up = true;
          if (--planT <= 0) setPlan('wait');
          break;
        case 'airkick':
          if (me.y > 0.2 && me.vy < 2 && dist < 1.7) {
            presses.push({ in: 0, b: 'k' });
            setPlan('wait');
          } else if (me.y <= 0 && me.state !== 'jump') setPlan('wait');
          break;
        case 'duck':
          inp.down = true;
          if (--planT <= 0) setPlan('wait');
          break;
        case 'block':
          inp[back] = true;
          if (--planT <= 0) setPlan('wait');
          break;
        case 'retreat':
          inp[back] = true;
          if (--planT <= 0) setPlan('wait');
          break;
      }
      for (const pr of presses) if (pr.in-- === 0) inp[pr.b] = true;
      presses = presses.filter((pr) => pr.in >= 0);
      return inp;
    };
  }

  // A button-masher, like a small kid hammering keys: walks in and presses random buttons, never blocks.
  // Only used to tune the CPU levels: it should beat Easy most of the time.
  function masher() {
    let next = 0, walking = true;
    return function think(M, me, foe) {
      const inp = blank();
      if (M.phase !== 'fight') return inp;
      const fwd = foe.x > me.x ? 'right' : 'left';
      if (rnd() < 0.02) walking = !walking;
      if (walking && Math.abs(foe.x - me.x) > 1) inp[fwd] = true;
      if (--next <= 0) {
        next = 5 + rnd() * 9;
        const r = rnd();
        inp[r < 0.55 ? 'p' : r < 0.88 ? 'k' : 's'] = true;
        if (rnd() < 0.04) inp.up = true;
      }
      return inp;
    };
  }

  // A small kid at the keys: slow, wanders back and forth, jumps a lot, presses now and then. Also only for tuning.
  function kid() {
    let next = 0, dir = 1, dirT = 0;
    return function think(M, me, foe) {
      const inp = blank();
      if (M.phase !== 'fight') return inp;
      const fwd = foe.x > me.x ? 'right' : 'left', back = fwd === 'right' ? 'left' : 'right';
      if (--dirT <= 0) {
        dirT = 30 + rnd() * 60;
        dir = rnd() < 0.6 ? 1 : rnd() < 0.5 ? -1 : 0;
      }
      if (dir > 0 && Math.abs(foe.x - me.x) > 1) inp[fwd] = true;
      if (dir < 0) inp[back] = true;
      if (--next <= 0) {
        next = 15 + rnd() * 30;
        const r = rnd();
        inp[r < 0.5 ? 'p' : r < 0.8 ? 'k' : 's'] = true;
        if (rnd() < 0.15) inp.up = true;
      }
      return inp;
    };
  }

  function modsFor(level) {
    const L = LEVELS[level];
    return L ? { dmg: L.dmg, walk: L.walk } : { dmg: 1, walk: 1 };
  }

  // ---------------------------------------------------------------- headless matches

  // Plays a whole match with no rendering. p1/p2: 'easy' | 'normal' | 'masher' | 'idle'.
  function sim(o = {}) {
    const ids = window.KofChars.ids;
    const c1 = o.c1 || ids[Math.floor(rnd() * ids.length)], c2 = o.c2 || ids[Math.floor(rnd() * ids.length)];
    const p1 = o.p1 || 'normal', p2 = o.p2 || 'easy';
    const cap = o.maxFrames || 60 * 60 * 8;
    const M = F.create({ chars: [c1, c2], mods: [modsFor(p1), modsFor(p2)] });
    const b = [brain(p1), brain(p2)];
    let frames = 0, error = null, hits = 0, blocks = 0, specials = 0;
    try {
      while (M.phase !== 'over' && frames < cap) {
        M.step(b[0](M, M.f[0], M.f[1]), b[1](M, M.f[1], M.f[0]));
        for (const e of M.events) {
          if (e.type === 'hit') hits++;
          else if (e.type === 'block') blocks++;
          else if (e.type === 'special') specials++;
        }
        M.events.length = 0;
        frames++;
      }
    } catch (e) {
      error = String(e && e.stack || e);
    }
    return {
      c1, c2, p1, p2, finished: M.phase === 'over', winner: M.winner, wins: M.wins.slice(), rounds: M.results,
      seconds: +(frames / 60).toFixed(1), hits, blocks, specials, error,
    };
  }

  // n random matches. Every round must end by a KO or the timer, every match must finish, nothing may throw.
  function soak(n = 20, o = {}) {
    const brains = o.brains || ['easy', 'normal', 'masher'];
    const problems = [], ends = { ko: 0, time: 0 }, draws = { rounds: 0, matches: 0 };
    let rounds = 0;
    const started = Date.now();
    for (let i = 0; i < n; i++) {
      const r = sim(Object.assign({ p1: brains[i % brains.length], p2: brains[Math.floor(i / brains.length) % brains.length] }, o));
      if (r.error) problems.push({ match: i, c: [r.c1, r.c2], error: r.error });
      else if (!r.finished) problems.push({ match: i, c: [r.c1, r.c2], p: [r.p1, r.p2], error: 'did not finish', rounds: r.rounds });
      for (const rd of r.rounds) {
        rounds++;
        if (rd.how !== 'ko' && rd.how !== 'time') problems.push({ match: i, error: 'round ended by ' + rd.how });
        else ends[rd.how]++;
        if (rd.winner < 0) draws.rounds++;
      }
      if (r.finished && r.winner < 0) draws.matches++;
    }
    return { matches: n, rounds, ends, draws, problems, ok: problems.length === 0, wallMs: Date.now() - started };
  }

  // Win rate of brain a (as P1) against brain b over n matches, characters random unless given.
  function versus(a, b, n = 40, o = {}) {
    let w = 0, l = 0, d = 0, secs = 0;
    for (let i = 0; i < n; i++) {
      const r = sim(Object.assign({ p1: a, p2: b }, o));
      if (r.winner === 0) w++;
      else if (r.winner === 1) l++;
      else d++;
      secs += r.rounds.reduce((s, rd) => s + rd.seconds, 0) / Math.max(1, r.rounds.length);
    }
    return { [a]: w, [b]: l, draws: d, avgRoundSeconds: +(secs / n).toFixed(1) };
  }

  window.KofCPU = { brain, modsFor, LEVELS, sim, soak, versus };
})();
