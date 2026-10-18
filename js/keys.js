/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "King of Bonk!",
  cols: ["Player 1", "Player 2"],
  keys: [
    ["walk", "A D", "← →"],
    ["jump · crouch", "W S", "↑ ↓"],
    ["punch · kick · special", "F G H", "J K L"],
    ["block (or hold back)", "R", "I"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work.",
  touch: "The pad on the left and 👊 🦶 ⭐ 🛡️ on the right. Tap your brother's face (above the buttons) to call him.",
});
