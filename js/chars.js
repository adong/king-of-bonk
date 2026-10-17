/* King of Bonk — the fighters.
   Ids match Kit.roster, which supplies the looks. Everything here is gameplay: tweak a number to make someone faster,
   stronger or give them a different special. Specials and moves are defined in js/fight.js. */
(function () {
  'use strict';

  const BASE = {
    walk: 1, // walk speed multiplier
    power: 1, // damage multiplier
    idle: 'stance', // fighting stance (see js/poses.js); Teddy uses the kit's peek-a-boo 'guard'
    string: ['jab', 'straight'], // what pressing punch again and again does
    special: 'peace',
    win: 'wave', // victory pose
  };

  const CHARS = {
    // Mike Tyson-style boxer: peek-a-boo guard, jab, straight, jab, power straight. Special: basketball jump shot.
    teddy: { walk: 1.05, idle: 'guard', string: ['jab', 'straight', 'jab', 'power'], special: 'jumpshot', specialName: 'JUMP SHOT', win: 'jumpshot', blurb: 'Tyson combo · 🏀 jump shot' },
    // Tommy's Y pose (比耶): both arms up with peace fingers, sending out a wave of ✌️ and stars.
    tommy: { walk: 1.1, special: 'peace', specialName: 'PEACE WAVE', win: 'peace', blurb: '✌️ peace wave' },
    zoom: { walk: 1.25, power: 0.9, special: 'dash', specialName: 'ZOOM DASH', win: 'wave', blurb: '💨 zoom dash' },
    luna: { walk: 1.05, special: 'moon', specialName: 'MOON BOOMERANG', win: 'wave', blurb: '🌙 moon boomerang' },
    bolt: { walk: 0.85, power: 1.1, special: 'zap', specialName: 'ZAP BEAM', win: 'wave', blurb: '⚡ zap beam' },
    bruno: { walk: 0.8, power: 1.2, special: 'slam', specialName: 'BEAR SLAM', win: 'wave', blurb: '💥 bear slam' },
    zombie: { walk: 0.75, power: 1.1, special: 'boo', specialName: 'BOO!', win: 'grab', blurb: '👻 BOO! scare' },
  };

  // Each fighter's companion is the other brother (Kit.roster.buddyFor), with his signature moves for saying hello
  // and goodbye (Kit.roster.signature). The fallbacks let the engine run headless without the kit.
  const SIGNATURE = { teddy: ['boxing', 'jumpshot'], tommy: ['peace', 'peace'] };
  function buddy(id) {
    const R = window.Kit && window.Kit.roster;
    const bid = R ? R.buddyFor(id) : id === 'tommy' ? 'teddy' : 'tommy';
    const e = R && R.get(bid);
    const sig = SIGNATURE[bid] || ['peace', 'peace'];
    return { id: bid, hello: e ? R.signature(e, 'hello') : sig[0], bye: e ? R.signature(e, 'goodbye') : sig[1] };
  }

  window.KofChars = {
    ids: Object.keys(CHARS),
    get(id) {
      return Object.assign({ id }, BASE, CHARS[id] || {});
    },
    buddy,
  };
})();
