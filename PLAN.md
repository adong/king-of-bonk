# King of Bonk: plan

A King of Fighters-style cartoon fighter for Teddy (8) and Tommy (5). Side view, 3D blocky fighters from the shared
kit, one HTML page, no asset files. Silly, not violent: POW stars, bonk sounds, dizzy KOs, signature-pose wins.

## Files

```
index.html       page, HUD, menus, touch buttons (CSS inline)
js/chars.js      fighter table: walk speed, idle stance, punch string, special, win pose (edit to tune)
js/fight.js      the engine, no Three.js: input buffer, state machine, frame data, hitboxes/hurtboxes,
                 projectiles, health, timer, rounds. Fixed 60 Hz frames, emits events for the renderer.
js/cpu.js        CPU brains (easy / normal) + a button-masher bot used only to tune difficulty
js/input.js      keyboard (P1 + P2) and touch buttons -> per-frame input snapshots with latched presses
js/poses.js      fight poses on top of Kit.people.pose: stance, kick, crouch, hit, block, knockdown, dizzy sit, ...
js/stage.js      the backyard stage (grass, fence, house, tree, hoop, spectators)
js/fx.js         POW bursts, stars, dust, emoji projectiles, dizzy stars, shadows
js/sfx.js        fight sounds on top of Kit.sound (bonk, whoosh, block, bell, fanfare)
js/game.js       scene, camera, screens, HUD, main loop, window.kof test hooks
kit/             synced copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .); never edited here
dist/kof-teddy.html   single-page build (python3 kit/tools/bundle.py .)
```

## Engine

- Fixed 60 Hz frames. `Fight.create(opts)` returns a match; `match.step(in1, in2)` advances one frame.
  `in` = held { left, right, up, down, block } + latched presses { p, k, s }.
- Input buffer: each button press is remembered for 8 frames and fires as soon as the fighter can act, so a
  press slightly early during recovery still comes out. Punch strings chain inside a window (jab -> straight ...).
- States: intro, idle, walk, crouch, jump, land, attack, hitstun, blockstun, airhit, knockdown, getup, ko, win.
- Moves have startup / active / recovery frames, a hitbox (relative to facing), damage, hitstun, blockstun,
  pushback, knockdown flag. Hurtbox depends on state (standing, crouching, airborne; none while down).
- Block: hold away from the foe (or the block key) while grounded and free. Blocks everything (kid rules), no
  chip damage. Holding back while a threat is near shows the guard pose instead of walking away.
- Hits: hitstop freeze, pushback (attacker is pushed instead when the defender is cornered), combo counter with
  damage scaling, POW event with a word. Projectiles cancel each other.
- Specials (one button, cooldown ~3.5 s, shown as a meter):
  Teddy jump shot (jumps, 🏀 arcs onto the foe), Tommy peace wave (Y pose, ✌️⭐ wave along the ground),
  Zoom dash punch, Luna 🌙 boomerang, Bolt ⚡ zap, Bruno ground pound shockwave, Zombie "BOO!" scare.
- Teddy's punch string is a Tyson combo: peek-a-boo guard stance, jab, straight, jab, straight (last one knocks down).
- Rounds: 60 s timer, best of 3, ROUND N / FIGHT! intro, K.O.! or TIME!, double KO / equal time-out = draw
  (nobody scores; at most 5 rounds, then the match is a draw). KO'd fighter sits down dizzy with circling stars;
  the winner does their signature pose.

## Companions (added later, Alan's request)

- The other brother (Kit.roster.buddyFor) is each fighter's striker: called with T / Enter / a touch button.
- One visit is about 6.5 s: run in, hello move, treat at the halfway point, goodbye move, run off. He guards his fighter for 5 s,
  then rests 4 s (0.5 s for a player against Easy). Engine-side, so it's in the headless tests.

## CPU

- Reads only the public match state, re-decides every N frames (reaction time), keeps a short plan
  (approach, poke, block, jump in, retreat, special, wait).
- Easy (for Tommy, 5): slow reactions, rarely blocks, single hits, pauses to let you in, deals 55% damage.
- Normal (for Teddy, 8): faster, blocks ~40%, chains strings, uses specials, deals 85% damage.
- Tuning check: a headless button-masher should beat Easy most of the time and Normal sometimes.

## Testing hooks (window.kof)

- `kof.step(seconds)` ticks and renders synchronously (rAF is throttled in a hidden pane).
- `kof.sim({ c1, c2, p1, p2 })` runs a whole headless match (cpu-easy / cpu-normal / masher brains) and returns
  rounds, how each ended (ko / time / draw), frames, hits and any error.
- `kof.soak(n)` runs n random matches and asserts every round ended by KO or the timer with no exception.

## Phases

1. Engine + placeholder box fighters (Three.js from ../metro-surfer/vendor while the kit is being extracted).
2. Kit lands: sync, load kit scripts, Kit.people / Kit.roster / Kit.portraits / Kit.sound; fighters become the
   real blocky Teddy and Tommy and friends.
3. Signature moves, HUD, touch buttons, polish, README, dist build, screenshots, local commit.
