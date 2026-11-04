/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 3 «ВСПЫШКА», страницы 21–30
   Первые двенадцать часов после взрыва. Люди ещё люди, но уже нет.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  const W = 1200, H = 1800;
  Cine.VOL3 = PAGES;

  const PAL = {
    hunter: { cloth: '#1b2b32', cloth2: '#121b20' },
    guard: { cloth: '#2f3a40', cloth2: '#1a2328' },
    nullar: { cloth: '#2a2340', cloth2: '#171228' },
    doctor: { cloth: '#c9d6d9', cloth2: '#9fb2b8' },
    turned: { cloth: '#33413c', cloth2: '#1b2521' }
  };

  function lift(scene, dy) {
    if (scene && scene.frame) scene.frame.y(scene.frame.y() + dy);
    return scene;
  }

  /* ============================================================== страница 1 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 1, title: 'Пробуждение', place: 'Коридор B · 00:04',
      tone: 'alarm', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setFlash(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        hunter: { x: 430, y: 1640, scale: 1.8, pose: 'crouch', emotion: 'pain', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 830, y: 1660, scale: 1.6, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Первое, что вернулось, — слух. Потом боль.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты цела?' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Я — да. Половина станции — нет.' }
      ]
    });
    lift(s, 40);
    // пыль, оседающая в луче
    const dust = new (K().Group)();
    for (let i = 0; i < 70; i++) {
      dust.add(new (K().Circle)({
        x: 200 + ((i * 137) % 900), y: 300 + ((i * 191) % 1100),
        radius: 1 + (i % 3) * 0.8, fill: '#ffe0c0', opacity: 0.12 + (i % 5) / 30
      }));
    }
    s.frame.add(dust);
    s.tick = function (t) {
      dust.children.forEach(function (c, i) {
        c.y(300 + ((i * 191 + t * 0.012) % 1100));
      });
      dust.opacity(0.6 + Math.sin(t / 700) * 0.2);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(12);
      if (engine && engine.particlesHost) Cine.Particles.embers(engine.particlesHost, 300, 700);
    };
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 2, title: 'Горит крыло', place: 'Жилой сектор',
      tone: 'alarm', accent: '#ff7a2f',
      set: function (root, p) { return Cine.setBurningWing(root, p); },
      order: ['guard', 'hunter'],
      figures: {
        guard: { x: 760, y: 1600, scale: 1.5, pose: 'down', emotion: 'pain', palette: PAL.guard },
        hunter: { x: 360, y: 1640, scale: 1.82, pose: 'crouch', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Вставай. Здесь нельзя лежать.' },
        { slot: 'TR1', who: 'ОХРАННИК', kind: 'speech', text: 'Он меня не отпускает…' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Кто «он»? На станции нет «его». Есть пожар.' }
      ]
    });
    lift(s, 34);
    s.tick = function (t) {
      // огонь дышит
      s.root.opacity(0.92 + Math.abs(Math.sin(t / 260)) * 0.08);
      if (Math.sin(t / 900) > 0.98) Cine.Shake.kick(5);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(14);
      Cine.FX.burst(700, 1200, { n: 6, dir: Math.PI * 1.5, power: 18, size: 9, up: 6, color: '#2a1a12', edge: '#ff9a5c' });
    };
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 3, title: 'Полсекунды', place: 'Медотсек',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setMedbay(root, p); },
      order: ['wei', 'turned1'],
      figures: {
        wei: { variant: 'doctor', x: 360, y: 1600, scale: 1.62, pose: 'lean', emotion: 'focus', palette: PAL.doctor },
        // первый обращённый на койке: кожа пепельная, зрачки светятся
        turned1: {
          variant: 'turned', x: 820, y: 1560, scale: 1.5, pose: 'crouch', emotion: 'neutral', flip: true,
          palette: PAL.turned, mutant: { veins: 0.25, eyeGlow: 0.35, glow: '#8affd6' }
        }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Посмотри на зрачки. Он реагирует на свет.' },
        { slot: 'TR1', who: 'ВЭЙ', kind: 'speech', text: 'Только с задержкой в полсекунды.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Полсекунды — это не человек.' }
      ]
    });
    lift(s, 44);
    s.tick = function (t) {
      // зрачки вспыхивают на долю секунды позже, чем надо
      const k = Math.sin(t / 520);
      if (s.figures.turned1) {
        s.figures.turned1.mutant({ veins: 0.25, eyeGlow: 0.2 + Math.max(0, k) * 0.6, glow: '#8affd6' });
      }
    };
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 4, title: 'Он не помнит имени', place: 'Медотсек · койка 4',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setMedbay(root, p); },
      order: ['turned1', 'hunter'],
      figures: {
        hunter: { x: 400, y: 1600, scale: 1.72, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        turned1: {
          variant: 'turned', x: 850, y: 1580, scale: 1.62, pose: 'stand', emotion: 'neutral', flip: true,
          palette: PAL.turned, mutant: { veins: 0.45, tendrils: 0, eyeGlow: 0.5, claw: 0.2, glow: '#8affd6' }
        }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Назови себя.' },
        { slot: 'TR1', who: 'ОБРАЩЁННЫЙ', kind: 'speech', text: '…' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Его звали Ортега. Он был моим сержантом.' }
      ]
    });
    lift(s, 46);
    s.tick = function (t) {
      // он «слушает» внутренний звук — голова медленно наклоняется
      if (s.figures.turned1) {
        s.figures.turned1.set({ headTilt: 0.18 + Math.sin(t / 1600) * 0.08, lean: 0.04 });
      }
    };
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 5, title: 'Тише некуда', place: 'Архивное ядро',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setArchive(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        hunter: { x: 380, y: 1620, scale: 1.66, pose: 'crouch', emotion: 'fear', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 860, y: 1640, scale: 1.54, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Внутри станции стало тише на девять децибел.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'И что это значит?' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Что кричать больше некому.' }
      ]
    });
    lift(s, 42);
    s.tick = function (t) {
      s.root.opacity(0.82 + Math.abs(Math.sin(t / 1300)) * 0.18);
    };
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    // ПЕРВЫЙ БОЙ: Хантер против обращённого. Мутация в полную силу.
    const s = Cine.scene({
      vol: 3, page: 6, title: 'Первый по-настоящему', place: 'Техническая палуба',
      tone: 'green', accent: '#8affd6',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['turned1', 'hunter'],
      figures: {
        hunter: { x: 340, y: 1650, scale: 1.84, pose: 'aim', emotion: 'angry', rifle: true, aimAngle: 0.02, palette: PAL.hunter },
        turned1: {
          variant: 'turned', x: 860, y: 1620, scale: 1.86, pose: 'hit', emotion: 'pain', flip: true,
          palette: PAL.turned,
          mutant: { veins: 0.85, tendrils: 4, claw: 0.9, eyeGlow: 0.9, glow: '#8affd6' }
        }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ортега. Стой.' },
        { slot: 'TR1', who: 'ОБРАЩЁННЫЙ', kind: 'speech', text: 'Ор-те-га… Ор-те-га…' },
        { slot: 'BL1', kind: 'narration', text: 'Он повторил имя так, как повторяют незнакомое слово.' }
      ]
    });
    lift(s, 30);

    const muzzle = s.figures.hunter.muzzle();
    s.tracer(muzzle, { x: 900, y: 1140 }, { w: 6, seed: 33, wobble: 6 });
    s.impact(900, 1140, 34);
    s.flash(muzzle.x, muzzle.y, 18, s.figures.hunter.aimAt(900, 1140));

    s.fire = function (engine) {
      const m = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil').emotion('angry');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 170);
      if (engine && engine.particlesHost) {
        Cine.Particles.muzzle(engine.particlesHost, m.x, m.y, 0, '#ff9a5c');
        Cine.Particles.sparks(engine.particlesHost, 900, 1140, '#8affd6', 40);
      }
      Cine.FX.burst(900, 1140, { n: 12, dir: Math.PI * 0.4, power: 26, size: 12, up: 7, color: '#2a3a30', edge: '#bfffe8' });
      s.figures.turned1.mutant({ veins: 1, tendrils: 4, claw: 1, eyeGlow: 0.4, glow: '#ff5a3d' });
      Cine.Shake.kick(20);
    };
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 7, title: 'Шлюз', place: 'Тамбур',
      tone: 'steel', accent: '#7fd8de',
      set: function (root, p) { return Cine.setLockRoom(root, p); },
      order: ['hunter', 'nullar'],
      figures: {
        hunter: { x: 340, y: 1640, scale: 1.8, pose: 'stand', emotion: 'angry', rifle: true, aimAngle: -0.08, palette: PAL.hunter },
        nullar: { x: 830, y: 1580, scale: 1.74, pose: 'stand', emotion: 'smirk', flip: true, palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Мы уходим. Все, кто ещё умеет идти.' },
        { slot: 'TR1', who: 'НУЛЛАР', kind: 'speech', text: 'Шлюз заперт. Мой приказ.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Тогда малый шлюз. Тот, который ты считаешь мусорным.' }
      ]
    });
    lift(s, 36);
    s.tick = function (t) {
      // вода у порога медленно поднимается
      const k = (Math.sin(t / 3000) + 1) / 2;
      s.root.opacity(1);
      if (s.nodes.via) s.nodes.via.y(1400 - k * 60);
    };
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 8, title: 'Малый шлюз', place: 'Тамбур · дверь 3',
      tone: 'steel', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setLockRoom(root, p); },
      order: ['wei', 'turned2', 'turned1', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 250, y: 1620, scale: 1.5, pose: 'crouch', emotion: 'fear', palette: PAL.doctor },
        hunter: { x: 470, y: 1660, scale: 1.8, pose: 'aim', emotion: 'angry', rifle: true, aimAngle: -0.26, palette: PAL.hunter },
        turned1: { variant: 'turned', x: 780, y: 1660, scale: 1.5, pose: 'run', emotion: 'angry', flip: true, palette: PAL.turned, mutant: { veins: 0.7, claw: 0.7, eyeGlow: 0.6 } },
        turned2: { variant: 'turnedDeep', x: 1030, y: 1640, scale: 1.36, pose: 'run', emotion: 'angry', flip: true, palette: PAL.turned, mutant: { veins: 0.55, tendrils: 2, eyeGlow: 0.5 } }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Их двое. Было трое.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Считай патроны, не их.' }
      ]
    });
    lift(s, 26);
    const m = s.figures.hunter.muzzle();
    s.tracer(m, { x: 800, y: 1120 }, { w: 7, seed: 71, wobble: 8 });
    s.flash(m.x, m.y, 20, s.figures.hunter.aimAt(800, 1120));

    s.tick = function (t) {
      // обращённые дёргаются рывками
      [s.figures.turned1, s.figures.turned2].forEach(function (f, i) {
        if (f) f.group.x((i ? 1030 : 780) + Math.sin(t / (140 + i * 40)) * 10);
      });
    };
    s.fire = function (engine) {
      const mm = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 160);
      if (engine && engine.particlesHost) {
        Cine.Particles.muzzle(engine.particlesHost, mm.x, mm.y, 0, '#ff9a5c');
        Cine.Particles.blood(engine.particlesHost, 800, 1100, Math.PI * 0.9, 22);
      }
      Cine.FX.burst(800, 1120, { n: 10, dir: Math.PI * 0.3, power: 24, size: 10, up: 6, color: '#22302a', edge: '#8affd6' });
      Cine.Shake.kick(22);
    };
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 9, title: 'Он был моим сержантом', place: 'Техническая палуба',
      tone: 'green', accent: '#ff5a3d',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['turned1', 'hunter'],
      figures: {
        // сержант лежит на боку — поворот группы, а не поза «down»
        turned1: {
          variant: 'turnedDeep', x: 1040, y: 1636, scale: 1.44, pose: 'down', emotion: 'pain',
          rotation: -90, flip: true, palette: PAL.turned,
          mutant: { veins: 0.45, tendrils: 1, claw: 0.6, eyeGlow: 0.12 }
        },
        // винтовка опущена: он держит сержанта, а не целится
        hunter: { x: 250, y: 1660, scale: 1.78, pose: 'crouch', emotion: 'pain', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Прости, сержант.' },
        { slot: 'BL1', kind: 'narration', text: 'Он не выстрелил. Он просто держал его, пока тот не затих.' }
      ]
    });
    lift(s, 24);
    // кровь под обращённым
    const blood = new (K().Group)();
    for (let i = 0; i < 9; i++) {
      blood.add(new (K().Ellipse)({
        x: 640 + i * 30 + Math.sin(i) * 16, y: 1652 + (i % 3) * 20,
        radiusX: 14 + (i % 4) * 9, radiusY: 5 + (i % 3) * 3, fill: 'rgba(120,20,20,0.45)'
      }));
    }
    s.frame.add(blood);
    s.tick = function (t) {
      if (s.figures.turned1) {
        // дыхание умирает
        s.figures.turned1.mutant({ veins: Math.max(0, 0.45 - (t % 6000) / 12000), tendrils: 1, claw: 0.4, eyeGlow: Math.max(0, 0.12 - (t % 9000) / 60000) });
      }
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 3, page: 10, title: 'Станция перестала быть станцией', place: 'Обзорный коридор',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['hunter', 'nullar', 'turned1', 'turned2'],
      figures: {
        hunter: { x: 230, y: 1650, scale: 1.66, pose: 'aim', emotion: 'fear', rifle: true, aimAngle: -0.1, palette: PAL.hunter },
        nullar: { x: 520, y: 1600, scale: 1.72, pose: 'stand', emotion: 'smirk', palette: PAL.nullar },
        turned1: { variant: 'turned', x: 800, y: 1670, scale: 1.4, pose: 'crouch', emotion: 'neutral', flip: true, palette: PAL.turned, mutant: { veins: 0.55, tendrils: 1, eyeGlow: 0.5 } },
        turned2: { variant: 'turnedDeep', x: 1030, y: 1640, scale: 1.5, pose: 'stand', emotion: 'neutral', flip: true, palette: PAL.turned, mutant: { veins: 0.8, tendrils: 2, eyeGlow: 0.7 } }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Сколько их?' },
        { slot: 'TR1', who: 'НУЛЛАР', kind: 'speech', text: 'Достаточно, чтобы ты больше не был начальником охраны.' },
        { slot: 'BL1', kind: 'narration', text: 'Станция перестала быть станцией. Теперь это было что-то другое.' }
      ]
    });
    lift(s, 30);
    s.tick = function (t) {
      // обращённые стоят неподвижно, но по очереди поворачивают голову
      [s.figures.turned1, s.figures.turned2].forEach(function (f, i) {
        if (!f) return;
        const ph = (t / 2600 + i * 0.33) % 1;
        f.set({ headTilt: Math.sin(ph * Math.PI * 2) * 0.2 });
      });
    };
    s.fire = function (engine) {
      const m = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 170);
      if (engine && engine.particlesHost) Cine.Particles.muzzle(engine.particlesHost, m.x, m.y, 0, '#ff5a8f');
      Cine.Shake.kick(16);
    };
    return s;
  });
})(window);
