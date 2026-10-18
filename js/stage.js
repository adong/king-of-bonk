/* King of Bonk — the backyard stage, all boxes and canvas paintings.
   Fighters stand on the z = 0 line between x = ±6.6; the camera looks at them from +z. Behind them: a picket fence
   with bunting and a bedsheet banner, a basketball hoop (Teddy's), a doghouse with a dog who cheers, a tree,
   the house, the sky. Kit.gfx supplies the canvas and material helpers. */
(function () {
  'use strict';
  const T = THREE;

  function build(scene) {
    const { makeCanvas, toTexture, std, mesh, roundRect, FONT } = window.Kit.gfx;
    const root = new T.Group();
    scene.add(root);
    const box = (w, h, d, mat, x, y, z, parent = root, shadow = true) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, parent, shadow);

    // ---- sky
    {
      const [c, g] = makeCanvas(4, 256);
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#3d9cf0');
      gr.addColorStop(0.6, '#8fd0ff');
      gr.addColorStop(1, '#d9f2ff');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 256);
      scene.background = toTexture(c);
    }
    const sun = new T.Sprite(new T.SpriteMaterial({ map: window.Kit.gfx.glowTexture(), color: '#fff3b0', depthWrite: false, fog: false }));
    sun.scale.set(16, 16, 1);
    sun.position.set(-22, 19, -60);
    root.add(sun);
    const sunCore = new T.Mesh(new T.CircleGeometry(2.2, 32), new T.MeshBasicMaterial({ color: '#fff6c8', fog: false }));
    sunCore.position.set(-22, 19, -59.5);
    root.add(sunCore);

    const clouds = [];
    {
      const [c, g] = makeCanvas(256, 128);
      g.fillStyle = '#ffffff';
      for (const [x, y, r] of [[70, 80, 38], [120, 60, 50], [175, 78, 40], [100, 92, 30], [150, 95, 32]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      const tex = toTexture(c);
      for (let i = 0; i < 7; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false, fog: false }));
        const w = 9 + Math.random() * 8;
        s.scale.set(w, w / 2, 1);
        s.position.set(-50 + i * 16 + Math.random() * 6, 12 + Math.random() * 7, -55 - Math.random() * 10);
        s.userData.v = 0.3 + Math.random() * 0.4;
        root.add(s);
        clouds.push(s);
      }
    }

    // ---- lawn: mowing stripes, specks and clover flowers
    {
      const [c, g] = makeCanvas(512, 512);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#5fbf45' : '#6ccb50';
        g.fillRect(0, i * 64, 512, 64);
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(40,120,30,0.35)' : 'rgba(150,230,110,0.35)';
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 5);
      }
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * 512, y = Math.random() * 512;
        g.fillStyle = Math.random() < 0.7 ? '#ffffff' : '#ffe14d';
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(x + Math.cos(k * 1.26) * 3, y + Math.sin(k * 1.26) * 3, 2.4, 0, Math.PI * 2);
          g.fill();
        }
      }
      const tex = toTexture(c, true);
      tex.repeat.set(10, 5);
      const ground = new T.Mesh(new T.PlaneGeometry(80, 40), std('#ffffff', { map: tex, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.z = -8;
      ground.receiveShadow = true;
      root.add(ground);
    }
    // worn patch where the kids play
    {
      const [c, g] = makeCanvas(512, 128);
      const gr = g.createRadialGradient(256, 64, 10, 256, 64, 256);
      gr.addColorStop(0, 'rgba(196,160,98,0.75)');
      gr.addColorStop(0.55, 'rgba(176,150,90,0.45)');
      gr.addColorStop(1, 'rgba(160,140,80,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 128);
      const patch = new T.Mesh(new T.PlaneGeometry(19, 4.6), new T.MeshStandardMaterial({ map: toTexture(c), transparent: true, depthWrite: false, roughness: 1 }));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(0, 0.01, 0.1);
      patch.receiveShadow = true;
      root.add(patch);
    }

    // ---- picket fence, bunting and the banner
    const FENCE_Z = -4.6;
    {
      const [c, g] = makeCanvas(1024, 160);
      g.fillStyle = '#fbf3e4';
      g.strokeStyle = '#c9b796';
      g.lineWidth = 3;
      g.fillRect(0, 54, 1024, 16);
      g.fillRect(0, 118, 1024, 16);
      for (let x = 6; x < 1024; x += 36) {
        g.beginPath();
        g.moveTo(x, 160);
        g.lineTo(x, 26);
        g.lineTo(x + 12, 8);
        g.lineTo(x + 24, 26);
        g.lineTo(x + 24, 160);
        g.closePath();
        g.fill();
        g.stroke();
      }
      const tex = toTexture(c, true);
      tex.repeat.set(5, 1);
      const fence = new T.Mesh(new T.PlaneGeometry(44, 1.6), new T.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.9 }));
      fence.position.set(0, 0.8, FENCE_Z);
      fence.receiveShadow = true;
      root.add(fence);
    }
    {
      const [c, g] = makeCanvas(1024, 96);
      const cols = ['#ff3d7f', '#ffd400', '#18b4ff', '#7ed957', '#b45cff', '#ff8a1f'];
      g.strokeStyle = '#5a4a3a';
      g.lineWidth = 3;
      let n = 0;
      for (let a = 0; a < 1024; a += 256) {
        g.beginPath();
        for (let x = 0; x <= 256; x += 4) g.lineTo(a + x, 10 + Math.sin((x / 256) * Math.PI) * 30);
        g.stroke();
        for (let x = 10; x < 250; x += 26) {
          const y = 10 + Math.sin((x / 256) * Math.PI) * 30;
          const y2 = 10 + Math.sin(((x + 18) / 256) * Math.PI) * 30;
          g.fillStyle = cols[n++ % cols.length];
          g.beginPath();
          g.moveTo(a + x, y);
          g.lineTo(a + x + 18, y2);
          g.lineTo(a + x + 9, (y + y2) / 2 + 30);
          g.closePath();
          g.fill();
        }
      }
      const tex = toTexture(c, true);
      tex.repeat.set(4, 1);
      const bunting = new T.Mesh(new T.PlaneGeometry(44, 1.1), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: T.DoubleSide }));
      bunting.position.set(0, 2.15, FENCE_Z + 0.05);
      root.add(bunting);
    }
    {
      // a bedsheet hung on the fence, painted by the kids
      const [c, g] = makeCanvas(512, 200);
      g.fillStyle = '#fffdf6';
      g.beginPath();
      g.moveTo(8, 6);
      g.lineTo(504, 6);
      for (let x = 504; x >= 8; x -= 24) g.lineTo(x, 188 + Math.sin(x * 0.05) * 6);
      g.closePath();
      g.fill();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `52px ${FONT}`;
      const word = 'BONK-OFF!';
      const cols = ['#ff3d7f', '#18b4ff', '#ff8a1f', '#7ed957', '#b45cff', '#ffcc00', '#ff3d7f', '#18b4ff', '#ff8a1f'];
      let x = 70;
      for (let i = 0; i < word.length; i++) {
        g.save();
        g.translate(x, 72 + (i % 2 ? 6 : -4));
        g.rotate((i % 3 - 1) * 0.08);
        g.fillStyle = cols[i];
        g.fillText(word[i], 0, 0);
        g.restore();
        x += word[i] === '-' ? 34 : 48;
      }
      // the subtitle speaks the player's language (BONK-OFF! is the kids' painting and stays as it is)
      const sub = () => {
        const text = window.Kit.lang ? window.Kit.lang.t('★ BACKYARD CHAMPIONSHIP ★') : '★ BACKYARD CHAMPIONSHIP ★';
        g.fillStyle = '#fffdf6';
        g.fillRect(20, 118, 472, 50);
        g.font = `26px ${FONT}`;
        g.fillStyle = '#4a86cf';
        g.fillText(text, 256, 142);
      };
      sub();
      const tex = toTexture(c);
      if (window.Kit.lang) window.Kit.lang.onChange(() => { sub(); tex.needsUpdate = true; });
      const sheet = new T.Mesh(new T.PlaneGeometry(3.4, 1.33), new T.MeshStandardMaterial({ map: tex, transparent: true, side: T.DoubleSide, roughness: 1 }));
      sheet.position.set(0.6, 1.0, FENCE_Z + 0.08);
      sheet.rotation.z = 0.015;
      root.add(sheet);
      for (const px of [-1.0, 2.2]) box(0.07, 0.14, 0.05, std('#ff6fa0'), px, 1.64, FENCE_Z + 0.1); // clothes pegs
    }

    // ---- Teddy's basketball hoop
    {
      const metal = std('#8d95a3', { metalness: 0.4, roughness: 0.5 });
      const hx = -8.6, hz = -3.2;
      mesh(new T.CylinderGeometry(0.08, 0.1, 3.3, 10), metal, hx, 1.65, hz - 0.2, root);
      box(0.08, 0.08, 0.5, metal, hx, 3.05, hz + 0.05);
      const [c, g] = makeCanvas(256, 170);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 256, 170);
      g.strokeStyle = '#ff6a00';
      g.lineWidth = 10;
      g.strokeRect(6, 6, 244, 158);
      g.strokeRect(84, 70, 88, 64);
      const board = box(1.5, 1.0, 0.06, [std('#eee'), std('#eee'), std('#eee'), std('#eee'), std('#ffffff', { map: toTexture(c) }), std('#eee')], hx, 3.35, hz + 0.32);
      board.castShadow = true;
      const rim = new T.Mesh(new T.TorusGeometry(0.24, 0.025, 8, 24), std('#ff5a00', { metalness: 0.3 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(hx, 3.0, hz + 0.6);
      root.add(rim);
      const [nc, ng] = makeCanvas(64, 64);
      ng.strokeStyle = '#ffffff';
      ng.lineWidth = 3;
      for (let i = -64; i < 128; i += 12) {
        ng.beginPath();
        ng.moveTo(i, 0);
        ng.lineTo(i + 64, 64);
        ng.moveTo(i + 64, 0);
        ng.lineTo(i, 64);
        ng.stroke();
      }
      const net = new T.Mesh(new T.CylinderGeometry(0.24, 0.15, 0.42, 14, 1, true), new T.MeshBasicMaterial({ map: toTexture(nc), transparent: true, side: T.DoubleSide, depthWrite: false }));
      net.position.set(hx, 2.78, hz + 0.6);
      root.add(net);
      // a spare ball on the grass
      const ball = new T.Sprite(new T.SpriteMaterial({ map: window.Kit.gfx.emojiTexture('🏀') }));
      ball.scale.set(0.5, 0.5, 1);
      ball.position.set(hx + 0.7, 0.24, hz + 0.4);
      root.add(ball);
    }

    // ---- doghouse and the dog who cheers on every big hit
    const dog = new T.Group();
    let dogHop = 0, dogT = 0;
    {
      const red = std('#d8443a'), roof = std('#5a3b2a'), dark = std('#2a1c16');
      const dx = 8.4, dz = -3.6;
      box(1.6, 1.2, 1.4, red, dx, 0.6, dz);
      const r1 = box(1.15, 0.12, 1.6, roof, dx - 0.42, 1.42, dz);
      r1.rotation.z = 0.68;
      const r2 = box(1.15, 0.12, 1.6, roof, dx + 0.42, 1.42, dz);
      r2.rotation.z = -0.68;
      box(0.6, 0.75, 0.04, dark, dx, 0.42, dz + 0.71, root, false);
      // the dog: blocky, sitting in front of his house
      const fur = std('#e8c18a'), spot = std('#8a5a32'), black = std('#1b1a22');
      dog.position.set(dx - 1.4, 0, dz + 1.0);
      dog.rotation.y = -0.5;
      root.add(dog);
      box(0.5, 0.45, 0.75, fur, 0, 0.42, 0.05, dog);
      box(0.5, 0.5, 0.5, fur, 0, 0.82, -0.32, dog);
      box(0.3, 0.22, 0.24, fur, 0, 0.74, -0.65, dog);
      box(0.12, 0.09, 0.06, black, 0, 0.82, -0.78, dog);
      for (const s of [-1, 1]) {
        box(0.07, 0.08, 0.04, black, s * 0.12, 0.96, -0.58, dog);
        const ear = box(0.12, 0.3, 0.2, spot, s * 0.28, 0.9, -0.3, dog);
        ear.rotation.z = s * 0.25;
        box(0.13, 0.32, 0.14, fur, s * 0.15, 0.16, -0.25, dog);
      }
      box(0.22, 0.16, 0.24, spot, 0.12, 0.6, 0.15, dog);
      const tail = new T.Group();
      tail.position.set(0, 0.55, 0.42);
      dog.add(tail);
      box(0.08, 0.08, 0.36, fur, 0, 0.1, 0.12, tail);
      tail.rotation.x = 0.7;
      dog.userData.tail = tail;
    }

    // ---- tree, bushes, flowers
    {
      const trunk = std('#7a5134'), leafs = ['#3f9e3a', '#4fb447', '#369032'].map((c) => std(c, { flatShading: true }));
      const tx = -11, tz = -9;
      box(0.8, 4.4, 0.8, trunk, tx, 2.2, tz);
      for (const [x, y, z, r, i] of [[0, 5.2, 0, 2.4, 0], [-1.5, 4.4, 0.5, 1.7, 1], [1.5, 4.6, -0.3, 1.8, 2], [0.3, 6.6, 0, 1.6, 1]]) {
        mesh(new T.IcosahedronGeometry(r, 0), leafs[i], tx + x, y, tz + z, root);
      }
      for (let i = 0; i < 9; i++) {
        const x = -13 + i * 3.4 + Math.random();
        if (Math.abs(x) < 2.5) continue;
        mesh(new T.IcosahedronGeometry(0.55 + Math.random() * 0.3, 0), leafs[i % 3], x, 0.45, FENCE_Z - 0.6, root);
      }
      const petals = ['#ff3d7f', '#ffd400', '#ffffff', '#b45cff', '#ff8a1f'].map((c) => std(c));
      const stem = std('#2f8f2a');
      for (let i = 0; i < 40; i++) {
        const x = -16 + i * 0.8 + Math.random() * 0.3;
        if (x > -9.4 && x < -7.6) continue;
        const h = 0.25 + Math.random() * 0.25;
        box(0.03, h, 0.03, stem, x, h / 2, FENCE_Z + 0.35, root, false);
        mesh(new T.IcosahedronGeometry(0.09, 0), petals[i % 5], x, h + 0.04, FENCE_Z + 0.35, root, false);
      }
    }

    // ---- the house
    {
      const [c, g] = makeCanvas(256, 256);
      g.fillStyle = '#a9d8f5';
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(60,110,150,0.35)';
      g.lineWidth = 2;
      for (let y = 0; y < 256; y += 16) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(256, y);
        g.stroke();
      }
      const siding = toTexture(c, true);
      siding.repeat.set(4, 2);
      const wall = std('#ffffff', { map: siding });
      const hx = 9, hz = -30;
      box(18, 7, 8, wall, hx, 3.5, hz);
      const roofM = std('#d8443a', { flatShading: true });
      const roof = new T.Mesh(new T.CylinderGeometry(5.4, 5.4, 18.6, 3, 1), roofM);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.x = Math.PI / 2;
      roof.scale.set(1, 1, 0.5);
      roof.position.set(hx, 8.5, hz);
      root.add(roof);
      box(1.2, 2.6, 1.2, std('#c8b6a0'), hx + 6, 10, hz - 1); // chimney
      const [wc, wg] = makeCanvas(128, 128);
      wg.fillStyle = '#ffffff';
      wg.fillRect(0, 0, 128, 128);
      wg.fillStyle = '#ffe9a8';
      wg.fillRect(10, 10, 108, 108);
      wg.fillStyle = '#ffffff';
      wg.fillRect(60, 10, 8, 108);
      wg.fillRect(10, 60, 108, 8);
      const winM = new T.MeshBasicMaterial({ map: toTexture(wc) });
      for (const [x, y] of [[-4.5, 4.7], [-0.5, 4.7], [7.5, 4.7], [7.5, 1.9], [-4.5, 1.9]]) {
        const w = new T.Mesh(new T.PlaneGeometry(1.6, 1.6), winM);
        w.position.set(hx + x, y, hz + 4.01);
        root.add(w);
      }
      box(1.6, 2.8, 0.1, std('#ff8a1f'), hx + 3, 1.4, hz + 4.02, root, false);
    }

    // ---- update: clouds drift, the dog wags and hops
    function update(dt, time) {
      for (const s of clouds) {
        s.position.x += s.userData.v * dt;
        if (s.position.x > 60) s.position.x = -60;
      }
      dogT += dt;
      dog.userData.tail.rotation.y = Math.sin(time * (dogHop > 0 ? 22 : 8)) * 0.6;
      if (dogHop > 0) {
        dogHop = Math.max(0, dogHop - dt);
        dog.position.y = Math.abs(Math.sin(dogHop * 12)) * 0.35;
      } else dog.position.y = 0;
    }
    function cheer(big) {
      dogHop = Math.max(dogHop, big ? 0.9 : 0.5);
    }

    return { root, update, cheer };
  }

  window.KofStage = { build };
})();
