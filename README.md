# King of Bonk

A King of Fighters-style cartoon fighting game starring Teddy and Tommy, in their backyard. It's built with Claude Code from plain JavaScript and Three.js, on the shared Claude Games kit.
There are no image, model or audio files: the fighters are the kit's blocky characters, every texture is painted on a canvas, and every sound is synthesised.
It's silly, not violent. Hits make comic POW! bursts and a bonk, a knocked-out fighter sits down dizzy under circling stars, and the winner does their signature pose.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/kof-teddy.html` is the whole game inlined, about 720 KB. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name kof-teddy`

**1 PLAYER** is you against the computer, and **2 PLAYERS** is two kids on one keyboard. Pick the CPU level on the title screen:

- **🐣 EASY**, for little fighters like Tommy (5): it's slow to react, blocks now and then, never strings punches together, and hits for 65%.
- **🔥 NORMAL**, for big kids like Teddy (8): it reacts faster, guards, hits back when you miss, uses punch strings and specials, and hits at full strength.

## Controls

| | Player 1 | Player 2 | Touch (1 player) |
|---|---|---|---|
| walk | A D | ← → | pad left / right |
| jump | W | ↑ | pad up (hold left/right too to jump forward or back) |
| crouch | S | ↓ | pad down |
| punch | F | J | 👊 |
| kick | G | K | 🦶 |
| special | H | L | ⭐ |
| block | T, or hold away from your opponent | I, or hold away | 🛡️ |

- In 1-player mode both key sets control you, so arrows + J K L work too. Player 2 can also use numpad 1 2 3 0.
- **P** or Esc pauses, and **M** turns the sound on or off. The ❚❚ and 🔊 buttons under the timer do the same.
- **Menus:** on the title screen, Enter starts 1 player, 2 starts 2 players, and ← → pick the CPU level. On character select, tap a card, or use A D + F (player 1) and ← → + J (player 2). Esc goes back.

## Moves

Everyone can do these:

| Move | How | |
|---|---|---|
| Punch string | punch, punch, punch... | jab, straight. Pressing again in time chains the next blow. |
| Kick | kick | longer reach than a punch |
| Low punch / sweep | crouch + punch / kick | the sweep knocks down |
| Jump punch / kick | punch / kick in the air | one per jump |
| Block | hold back or the block key | blocks everything, and there's no chip damage (kid rules). Holding back when a blow is coming guards on the spot instead of walking away. |
| Special | special | one button with a 3.5 s cooldown. The bar under your health glows when it's ready. |

The signature moves:

- **TEDDY** fights like Mike Tyson. His stance is the peek-a-boo guard (fists by the chin, bobbing and weaving), and his punch string is a 4-hit **Tyson combo**: jab, straight, jab, then a power straight that knocks the opponent down. His special is the **🏀 JUMP SHOT**: he jumps and shoots a basketball that arcs onto his opponent. When he wins, he shadow-boxes and sinks jump shots into his backyard hoop.
- **TOMMY**'s special is his favourite **Y pose (比耶)**: both arms up with peace fingers. It sends out a **✌️ PEACE WAVE** with stars spinning around it. When he wins, he does the Y and ✌️ and ⭐ rain down.
- **ZOOM**: 💨 zoom dash, a running punch across the yard.
- **LUNA**: 🌙 moon boomerang, which flies out and comes back.
- **BOLT** (the robot): ⚡ zap beam. It's fast but flies high, so crouching ducks under it.
- **BRUNO** (the bear): 💥 bear slam. He jumps, lands with a THUD and sends a shockwave along the ground, which you can jump over.
- **ZOMBIE**: 👻 BOO!, a short-range scare that knocks you over.

When two projectiles meet, they cancel each other out with a POP.

## Rounds

- Each round lasts 60 seconds, and the match is best of 3. Rounds open with ROUND 1 / FIGHT!, and the final round is called FINAL ROUND.
- A round ends with **K.O.!**: the loser sits down dizzy with stars and a chick circling their head, and the winner does their pose. Or it ends with **TIME!**, and whoever has more health wins.
- A double KO, or a time-out with equal health, is a draw, and nobody scores. After 5 rounds the match ends anyway.
- The HUD shows each fighter's portrait, name, health bar (with a white "ouch" bar that catches up), round wins ★, special meter, the timer, the combo counter ("3 HITS!") and the special's name when someone uses it.

## Make it yours

- `js/chars.js` holds each fighter's walk speed, power, punch string, special and victory pose. The looks come from the kit roster, so a new kit character (say, Dad) needs one line here.
- `js/fight.js` has the frame data at the top: startup, active and recovery frames, damage, hitstun and pushback for every move, special and projectile.
- `js/cpu.js` has the two CPU levels at the top.

## How it works, and how it's tested

- The engine (`js/fight.js`) has no Three.js in it. A match is plain state stepped at a fixed 60 frames a second, and the same code runs the browser game and the headless tests.
  - Each fighter is a state machine: idle, walk, crouch, jump, attack, hitstun, blockstun, knocked down, getting up, KO, win.
  - Moves have startup, active and recovery frames, with hitboxes and hurtboxes, an 8-frame input buffer and chain windows for punch strings.
  - There's hitstop on impact, pushback (an attacker bounces off a cornered opponent instead), combo damage scaling, projectiles and rounds.
- The renderer (`js/game.js`) only reads match state, and it turns the engine's events into effects, sounds, banners and camera shake. A CPU-vs-CPU demo plays behind the menus.
- Console hooks (`window.kof`):

```js
kof.soak(100)                      // 100 random headless matches: every round must end by KO or timer, no errors
kof.soak(3, { maxFrames: 600 })    // proves the check can fail: matches cut short are reported
kof.versus('masher', 'easy', 100)  // win counts: a button-masher bot vs the Easy CPU
kof.sim({ c1: 'teddy', c2: 'tommy', p1: 'normal', p2: 'easy' })  // one match, round by round
kof.start({ p1: 'teddy', p2: 'tommy', level: 'easy' })           // jump straight into a fight
kof.step(5)                        // advance 5 s and draw (when the tab's animation is throttled)
kof.debug(true)                    // show hitboxes (red), hurtboxes (green), projectiles (yellow)
```

- At the last check:
  - 200 random headless matches all finished, with every round ended by a KO or the timer.
  - A button-masher bot (presses something every 0.1–0.25 s, never blocks) beat Easy in 100 of 100 matches, and beat Normal in 149 of 300.
  - A "little kid" bot (wanders, jumps a lot, presses a button every 0.25–0.75 s) beat Easy in 295 of 300, and lost to Normal every time.
  - Rounds last about 20–30 s.

## Files

```
index.html       page, HUD, menus, touch buttons (CSS inline)
js/chars.js      fighter table: speed, power, punch string, special, victory pose
js/fight.js      the engine: frame data, input buffer, state machine, hitboxes, projectiles, rounds
js/cpu.js        CPU brains (easy, normal), test bots, headless sim / soak / versus
js/input.js      keyboard for two players, touch pad and buttons
js/poses.js      fight poses on top of Kit.people.pose
js/stage.js      the backyard: lawn, picket fence, bunting, banner, hoop, doghouse and dog, tree, house
js/fx.js         POW bursts, stars, dust, block shields, projectile sprites, dizzy stars, Teddy's ball
js/sfx.js        fight sounds on top of Kit.sound
js/game.js       scene, camera, screens, HUD, main loop, window.kof hooks
kit/             copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .), never edited here
dist/kof-teddy.html   the single-page build
PLAN.md          the build plan
```

## Kit candidates

These live in this game's own JS for now. They could move into `~/claude-games/kit` if another game wants them:

- **Fight poses** (`js/poses.js`):
  - `stance`, `crouch`, `kick`, `sweep`, jump punch and kick, `hitstun`, `block` (arms crossed, or Teddy's gloves up), `lying` (flat on the back) and `dizzySit` (sitting, legs out, head wobbling).
  - A `drive(p, targets, k)` helper that eases every channel, including leg spread, head tilt, rig height and rig tilt, which the kit's `pose` doesn't touch.
- **Sounds** (`js/sfx.js`): `bonk` (wooden KO bonk plus tweets), boxing-ring `bell`, `whoosh`, `block`, `boing`, `fanfare`, `cheer`.
- **Effects** (`js/fx.js`): the comic starburst texture with a word in it (`POW!`, `BONK!`...), and the circling dizzy stars.

## Not verified

- **Sound**: the synth code runs without errors, but nobody listened to it.
- **Real touch devices**: the touch pad and buttons were tested in the browser's phone emulation (740×360) with mouse and synthetic pointer events, not on a real phone or iPad. Two thumbs at once (pad and button) is untested.
- **Double-click from Finder (`file://`)**: the page only uses classic `<script src>` tags and no network requests, but it was tested over `http://localhost`, because the test browser can't drive `file://` pages.
