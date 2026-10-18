/* 中文 for King of Bonk: the words on the page, the banners and callouts, the ? panel, and the canvas words
   (POW bursts, name tags, the banner's subtitle) through Kit.lang (kit/lang.js).
   The kids' names, the fighters' names, the logo (KING OF BONK!) and the kids' painted BONK-OFF! sheet stay in
   English on purpose. K.O.! stays too: it's what every fighting game shouts. */
(function () {
  const L = Kit.lang;
  L.keep([
    'KING OF', 'NK!', 'King of Bonk!', 'King of Bonk', 'Claude Code',
    'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'VS', 'Esc',
  ]);

  L.add({
    // title screen
    "Teddy & Tommy's backyard cartoon brawl": 'Teddy 和 Tommy 的后院卡通大乱斗',
    '▶ 1 PLAYER': '▶ 单人', 'you vs the computer': '你和电脑对打',
    '👫 2 PLAYERS': '👫 双人', 'one keyboard, two kids': '一个键盘，两个小朋友',
    'CPU': '电脑', 'Computer difficulty': '电脑难度', 'for little fighters': '给小小斗士', 'for big kids': '给大孩子',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    'jump · crouch': '跳 · 蹲下', 'punch · kick · special': '出拳 · 踢腿 · 必杀技', 'block (or hold back)': '格挡（或按住后退）',
    "Thumb on the pad to walk, jump and crouch. 👊 punch, 🦶 kick, ⭐ special, 🛡️ block, and tap your brother's face to call him in. Two players need a keyboard.":
      '拇指放在圆盘上走、跳、蹲。👊 出拳，🦶 踢腿，⭐ 必杀技，🛡️ 格挡，点兄弟的头像叫他来帮忙。双人要用键盘。',
    '↻ Turn sideways for a bigger fight!': '↻ 把手机横过来，画面更大！',
    'LOADING…': '加载中…',
    'This browser can’t run WebGL, so the game can’t start.': '这个浏览器跑不了 WebGL，游戏开不了。',

    // character select
    'PICK YOUR FIGHTER': '选择你的斗士', 'PICK WHO YOU FIGHT': '选择你的对手', 'PICK YOUR FIGHTERS': '选择斗士',
    'GET READY!': '准备好！', 'YOU': '你', '+ buddy': '+ 帮手', 'surprise!': '惊喜！', 'RANDOM': '随机', 'ZOMBIE': '僵尸',
    'Fighters': '斗士', '◀ BACK': '◀ 返回', 'FIGHT!': '开打！', 'Tap a fighter · keys: 1P': '点一个斗士 · 按键：1P', 'back': '返回',
    'Tyson combo · 🏀 jump shot': '泰森连击 · 🏀 跳投', '✌️ peace wave': '✌️ 比耶冲击波', '💨 zoom dash': '💨 疾风冲刺',
    '🌙 moon boomerang': '🌙 月亮回旋镖', '⚡ zap beam': '⚡ 电光射线', '💥 bear slam': '💥 大熊砸地', '👻 BOO! scare': '👻 哇呜吓一跳',

    // the fight: HUD, banners, callouts
    'SPECIAL': '必杀技', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'FINAL ROUND': '决胜回合', 'DOUBLE K.O.!': '双双 K.O.！', 'TIME!': '时间到！', 'TIME! DRAW': '时间到！平局',
    'JUMP SHOT!': '跳投！', 'PEACE WAVE!': '比耶冲击波！', 'ZOOM DASH!': '疾风冲刺！', 'MOON BOOMERANG!': '月亮回旋镖！',
    'ZAP BEAM!': '电光射线！', 'BEAR SLAM!': '大熊砸地！', 'BOO!': '哇呜！',
    'TOMMY BLOCKED IT!': 'TOMMY 挡住了！',
    // touch buttons
    'PUNCH': '出拳', 'KICK': '踢腿', 'BLOCK': '格挡',

    // pause and results
    'P · Esc · Space to resume · Q for the menu · M sound · T / Enter call your brother': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音 · T / 回车 叫兄弟来帮忙',
    'DRAW!': '平局！', 'What a battle!': '好精彩的对决！', 'You are the backyard champion!': '你是后院冠军！',
    'Nobody won. Again?': '没人赢，再来一局？', 'So close! Try again?': '就差一点！再试一次？',
    '↻ REMATCH': '↻ 再打一场', 'NEW FIGHTERS': '换斗士', 'Enter rematch · C new fighters · Esc menu': '回车 再打一场 · C 换斗士 · Esc 菜单',

    // the ? panel (js/keys.js)
    'P or Esc · M': 'P 或 Esc · M',
    "The pad on the left and 👊 🦶 ⭐ 🛡️ on the right. Tap your brother's face (above the buttons) to call him.":
      '左边是方向圆盘，右边是 👊 🦶 ⭐ 🛡️。点兄弟的头像（按钮上方）叫他来帮忙。',

    // canvas words: the comic bursts, and the subtitle on the kids' banner
    'POW!': '砰！', 'BAM!': '嘭！', 'WHAM!': '咣！', 'BOP!': '啪！', 'BIP!': '哒！', 'BONK!': '咚！', 'KAPOW!': '轰！',
    'ZAP!': '滋啦！', 'SWISH!': '唰！', 'PEACE!': '耶！', 'THUD!': '咕咚！', 'ZOOM!': '嗖！', 'POP!': '啵！', 'BLOCK!': '挡住！',
    '★ BACKYARD CHAMPIONSHIP ★': '★ 后院冠军赛 ★',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const LEVEL = { EASY: '简单', NORMAL: '普通' };
  L.rule(/^ROUND (\d+)$/, '第 $1 回合');
  L.rule(/^(\d+) HITS!$/, '$1 连击！');
  L.rule(/^(.+) WINS!$/, (m, who) => `${L.t(who)} 赢了！`);
  L.rule(/^CPU · (EASY|NORMAL)$/, (m, lv) => `电脑 · ${LEVEL[lv]}`);
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(\d)P is the backyard champion!$/, '$1P 是后院冠军！');
  L.rule(/^(\d+) hits · best combo (\d+) · (\d+) specials · (\d+) saves by (.+)$/, '$1 次命中 · 最多 $2 连击 · $3 次必杀技 · $5 挡了 $4 次');
  L.rule(/^(.+): press T$/, '$1：按 T 叫他');
  L.rule(/^(.+): press Enter$/, '$1：按回车叫他');
  L.rule(/^(.+): the computer calls him$/, '$1：电脑会叫他');
})();
