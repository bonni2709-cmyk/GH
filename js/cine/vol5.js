/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 5 «НИЖНИЕ ЯРУСЫ», страницы 41–50
   Вниз, туда, где станция перестаёт быть построенной людьми.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  const W = 1200, H = 1800;
  Cine.VOL5 = PAGES;

  const PAL = {
    hunter: { cloth: '#1b2b32', cloth2: '#121b20' },
    doctor: { cloth: '#c9d6d9', cloth2: '#9fb2b8' },
    nullar: { cloth: '#241d38', cloth2: '#141026' },
    guard: { cloth: '#2f3a40', cloth2: '#1a2328' },
    turned: { cloth: '#2f3d38', cloth2: '#182420' },
    turnedDeep: { cloth: '#263430', cloth2: '#131d1a' }
  };

  function lift(scene, dy) {
    if (scene && scene.frame) scene.frame.y(scene.frame.y() + dy);
    return scene;
  }

  /* ============================================================== страница 1 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 1, title: 'Вниз', place: 'Шахта 4 · −9-й ярус',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setShaft(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 300, y: 1720, scale: 1.42, pose: 'stand', emotion: 'fear', palette: PAL.doctor },
        hunter: { x: 860, y: 1730, scale: 1.62, pose: 'crouch', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Ниже восьмого яруса станция перестаёт быть станцией.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Свет держится ещё метров сорок. Потом — только мы.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Значит, сорок метров — это далеко.' }
      ]
    });
    lift(s, 30);
    // капли по трапе
    const drops = new (K().Group)();
    for (let i = 0; i < 24; i++) {
      drops.add(new (K().Circle)({
        x: 430 + ((i * 79) % 340), y: 300 + ((i * 131) % 1200),
        radius: 1.4 + (i % 3) * 1.2, fill: '#bfe9f2', opacity: 0.2 + (i % 4) * 0.1
      }));
    }
    s.frame.add(drops);
    s.tick = function (t) {
      drops.children.forEach(function (c, i) {
        c.y(300 + ((i * 131 + t * (0.05 + (i % 4) * 0.01)) % 1300));
      });
    };
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 2, title: 'Вода по грудь', place: 'Затопленная палуба',
      tone: 'green', accent: '#8affd6',
      set: function (root, p) { return Cine.setFloodedDeck(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 400, y: 1700, scale: 1.7, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 830, y: 1690, scale: 1.56, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Не двигайтесь. Вода реагирует на движение.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Тогда мы уже трупы.' },
        { slot: 'BL1', kind: 'narration', text: 'Свет под водой шёл волнами — будто дышал.' }
      ]
    });
    lift(s, 40);
    // светящиеся разводы на воде
    const glow = new (K().Group)();
    for (let i = 0; i < 9; i++) {
      glow.add(new (K().Ellipse)({
        x: 120 + i * 130, y: 1300 + (i % 3) * 90, radiusX: 90 + (i % 4) * 40, radiusY: 14,
        stroke: 'rgba(150,255,225,0.28)', strokeWidth: 2
      }));
    }
    s.frame.add(glow);
    s.tick = function (t) {
      glow.children.forEach(function (c, i) {
        c.radiusX(90 + (i % 4) * 40 + Math.sin(t / 900 + i) * 14);
        c.opacity(0.5 + Math.sin(t / 700 + i) * 0.3);
      });
    };
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 3, title: 'Что-то в воде', place: 'Затопленная палуба · провал',
      tone: 'green', accent: '#8affd6',
      set: function (root, p) { return Cine.setFloodedDeck(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 320, y: 1690, scale: 1.72, pose: 'aim', emotion: 'fear', rifle: true, aimAngle: 0.12, palette: PAL.hunter },
        wei: { variant: 'doctor', x: 760, y: 1700, scale: 1.5, pose: 'crouch', emotion: 'fear', palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Оно не охотится. Оно просто идёт мимо.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'И это хуже всего.' }
      ]
    });
    lift(s, 44);
    // щупальце проходит через кадр за фигурами — уходит в воду, а не по воздуху
    const arm = Cine.deepArm({
      from: { x: -220, y: 1170 }, to: { x: 1420, y: 1230 },
      width: 128, bow: -150, glow: '#8affd6', opacity: 0.95
    });
    s.fxBack.add(arm);
    const arm2 = Cine.deepArm({
      from: { x: -160, y: 1420 }, to: { x: 1380, y: 1500 },
      width: 70, bow: 90, glow: '#8affd6', opacity: 0.5
    });
    s.fxBack.add(arm2);

    s.tick = function (t) {
      arm.y(Math.sin(t / 2600) * 26);
      arm2.y(Math.sin(t / 3100 + 1.4) * 20);
      if (Math.sin(t / 1100) > 0.97) Cine.Shake.kick(2);
    };
    s.fire = function (engine) {
      const m = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 170);
      if (engine && engine.particlesHost) {
        Cine.Particles.muzzle(engine.particlesHost, m.x, m.y, 0.12, '#9df6ff');
        Cine.Particles.sparks(engine.particlesHost, 820, 1210, '#8affd6', 44);
      }
      Cine.FX.burst(820, 1210, { n: 10, dir: Math.PI * 0.6, power: 22, size: 11, up: 4, color: '#0b201d', edge: '#bfffe8' });
      Cine.Shake.kick(20);
    };
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 4, title: 'Вторая капсула', place: 'Отсек K · выемка в бетоне',
      tone: 'depth', accent: '#ffd166',
      set: function (root, p) { return Cine.setCapsuleBay(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 250, y: 1700, scale: 1.62, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 950, y: 1690, scale: 1.5, pose: 'crouch', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Это не наш корпус. И не наша сварка.' },
        { slot: 'TR1', who: 'ВЭЙ', kind: 'speech', text: 'Ей больше лет, чем станции.' },
        { slot: 'BL1', kind: 'narration', text: 'Капсула была вскрыта изнутри.' }
      ]
    });
    lift(s, 26);
    s.tick = function (t) {
      // свечение из щели дышит
      s.root.opacity(0.96 + Math.abs(Math.sin(t / 1500)) * 0.04);
    };
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 5, title: 'Она не с Земли', place: 'Отсек K · у капсулы',
      tone: 'depth', accent: '#ffd166',
      set: function (root, p) { return Cine.setCapsuleBay(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 360, y: 1700, scale: 1.56, pose: 'crouch', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 800, y: 1680, scale: 1.66, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Смотрите на гравировку. Это не язык. Это схема.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Схема чего?' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', text: 'Схема нас.' }
      ]
    });
    lift(s, 34);
    // символы на корпусе капсулы
    const marks = new (K().Group)();
    for (let i = 0; i < 9; i++) {
      const x = 300 + (i % 3) * 300, y = 560 + Math.floor(i / 3) * 170;
      marks.add(new (K().Circle)({ x: x, y: y, radius: 46, stroke: 'rgba(255,210,120,0.35)', strokeWidth: 2 }));
      marks.add(new (K().Line)({
        points: [x - 30, y + 20, x, y - 30, x + 28, y + 14],
        stroke: 'rgba(255,210,120,0.45)', strokeWidth: 2.4, closed: true
      }));
    }
    s.frame.add(marks);
    s.tick = function (t) {
      marks.opacity(0.6 + Math.abs(Math.sin(t / 1400)) * 0.4);
    };
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 6, title: 'Оно было человеком', place: 'Затопленная палуба · провал',
      tone: 'green', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setFloodedDeck(root, p); },
      order: ['wei', 'turned1', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 210, y: 1700, scale: 1.44, pose: 'crouch', emotion: 'fear', palette: PAL.doctor },
        turned1: {
          variant: 'turnedDeep', x: 660, y: 1690, scale: 1.62, pose: 'stand', emotion: 'neutral', flip: true,
          palette: PAL.turnedDeep, mutant: { veins: 0.85, tendrils: 2, claw: 0.9, eyeGlow: 0.8, glow: '#ff5a8f' }
        },
        hunter: { x: 1030, y: 1680, scale: 1.6, pose: 'aim', emotion: 'angry', rifle: true, aimAngle: 0.16, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Оно вылезло из провала мокрым и очень спокойным.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'У него нашивка. Четвёртый ярус, техслужба.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Теперь это не важно.' }
      ]
    });
    lift(s, 28);
    s.tick = function (t) {
      s.figures.turned1.set({ headTilt: Math.sin(t / 1900) * 0.16 });
      if (Math.sin(t / 700) > 0.98) Cine.Shake.kick(4);
    };
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 7, title: 'Бой в воде', place: 'Затопленная палуба',
      tone: 'green', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setFloodedDeck(root, p); },
      order: ['hunter', 'turned1'],
      figures: {
        hunter: { x: 280, y: 1690, scale: 1.74, pose: 'hit', emotion: 'pain', palette: PAL.hunter },
        turned1: {
          variant: 'turnedDeep', x: 820, y: 1700, scale: 1.68, pose: 'run', emotion: 'angry', flip: true,
          palette: PAL.turnedDeep, mutant: { veins: 1, tendrils: 3, claw: 1, eyeGlow: 0.9, glow: '#ff5a8f' }
        }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Вэй! Не смотри!' },
        { slot: 'BL1', kind: 'narration', text: 'В воде удар идёт медленнее — и от этого больнее.' }
      ]
    });
    lift(s, 24);
    const hx = 560, hy = 1240;
    s.impact(hx, hy, 44);
    // брызги
    for (let i = 0; i < 14; i++) {
      s.frame.add(new (K().Line)({
        points: [hx + (i - 7) * 16, hy, hx + (i - 7) * 30, hy - 70 - (i % 4) * 30],
        stroke: 'rgba(200,255,240,0.5)', strokeWidth: 2.4, lineCap: 'round'
      }));
    }
    s.tick = function (t) {
      s.root.opacity(0.9 + Math.abs(Math.sin(t / 260)) * 0.1);
    };
    s.fire = function (engine) {
      s.figures.hunter.pose('hit');
      if (engine && engine.particlesHost) {
        Cine.Particles.blood(engine.particlesHost, hx, hy, Math.PI * 0.9, 30);
        Cine.Particles.sparks(engine.particlesHost, hx, hy, '#8affd6', 30);
      }
      Cine.FX.burst(hx, hy, { n: 16, dir: Math.PI * 0.5, power: 30, size: 13, up: 10, color: '#0b201d', edge: '#ff9ac0' });
      Cine.Shake.kick(26);
    };
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 8, title: 'Мнема слышит', place: 'Затопленная палуба · терминал',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setFloodedDeck(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 420, y: 1690, scale: 1.66, pose: 'lean', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 880, y: 1700, scale: 1.5, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Я зафиксировала вторую капсулу двести лет назад.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты знала и молчала.' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Я не молчала. Меня не спрашивали.' }
      ]
    });
    lift(s, 36);
    // пульсирующее свечение терминала
    const term = new (K().Group)();
    term.add(new (K().Circle)({
      x: 600, y: 1010, radius: 120,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 120,
      fillRadialGradientColorStops: [0, 'rgba(157,246,255,0.28)', 1, 'rgba(157,246,255,0)']
    }));
    term.add(new (K().Circle)({ x: 600, y: 1010, radius: 26, fill: '#9df6ff', opacity: 0.7, shadowColor: '#9df6ff', shadowBlur: 40 }));
    s.frame.add(term);
    s.tick = function (t) {
      term.opacity(0.55 + Math.abs(Math.sin(t / 620)) * 0.45);
    };
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 9, title: 'Наверх', place: 'Шахта 4 · подъём',
      tone: 'depth', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setShaft(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 300, y: 1720, scale: 1.62, pose: 'crouch', emotion: 'pain', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 850, y: 1730, scale: 1.44, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Оно шло за нами шесть ярусов и не тронуло.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Значит, ему сказали не трогать.' }
      ]
    });
    lift(s, 30);
    s.tick = function (t) {
      // далёкий свет снизу пульсирует
      s.root.opacity(0.94 + Math.abs(Math.sin(t / 900)) * 0.06);
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 5, page: 10, title: 'Станция не первая', place: 'Отсек K · срез',
      tone: 'green', accent: '#8affd6',
      set: function (root, p) { return Cine.setCapsuleBay(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 200, y: 1700, scale: 1.5, pose: 'stand', emotion: 'fear', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 1020, y: 1690, scale: 1.42, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Сколько таких капсул было до нас?' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Три. Вы — четвёртая станция на этом месте.' },
        { slot: 'BL3', kind: 'narration', text: 'Станция не первая. И, судя по всему, не последняя.' }
      ]
    });
    lift(s, 40);
    // на стене — схема из четырёх отметок
    const marks = new (K().Group)();
    for (let i = 0; i < 4; i++) {
      const x = 240 + i * 240;
      marks.add(new (K().Circle)({
        x: x, y: 470, radius: 34,
        stroke: i === 3 ? '#8affd6' : 'rgba(140,255,220,0.35)', strokeWidth: i === 3 ? 5 : 2.4,
        shadowColor: i === 3 ? '#8affd6' : null, shadowBlur: i === 3 ? 30 : 0
      }));
      if (i < 3) {
        marks.add(new (K().Line)({
          points: [x - 26, 446, x + 26, 494],
          stroke: 'rgba(255,120,120,0.45)', strokeWidth: 3
        }));
      }
    }
    s.frame.add(marks);
    s.tick = function (t) {
      marks.children.forEach(function (c, i) {
        if (c.className === 'Circle') c.opacity(0.5 + Math.abs(Math.sin(t / 1200 + i)) * 0.5);
      });
    };
    return s;
  });
})(window);
