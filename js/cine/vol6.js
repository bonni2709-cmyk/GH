/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 6 «СОНАР», страницы 51–60
   Глубина отвечает. Снаружи к станции идёт что-то большое.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  const W = 1200, H = 1800;
  Cine.VOL6 = PAGES;

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
      vol: 6, page: 1, title: 'Отметка', place: 'Гидролокатор · вахта',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setSonarRoom(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 300, y: 1700, scale: 1.5, pose: 'stand', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 900, y: 1690, scale: 1.6, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Контакт. Один. Идёт к нам четыре часа.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Размер?' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Больше, чем станция.' }
      ]
    });
    lift(s, 20);
    s.tick = function (t) {
      s.root.opacity(0.96 + Math.abs(Math.sin(t / 1400)) * 0.04);
    };
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 2, title: 'Оно слушает', place: 'Гидролокатор',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setSonarRoom(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 380, y: 1700, scale: 1.58, pose: 'stand', emotion: 'fear', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 880, y: 1690, scale: 1.46, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Оно отвечает на наш сонар. С той же частотой.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Тогда выключи.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Уже поздно. Оно знает, где мы.' }
      ]
    });
    lift(s, 24);
    // круги ответного импульса на экране
    const rings = new (K().Group)();
    for (let i = 0; i < 4; i++) {
      rings.add(new (K().Circle)({
        x: 600, y: 700, radius: 80 + i * 70,
        stroke: 'rgba(255,122,92,0.45)', strokeWidth: 2.4, opacity: 0.8 - i * 0.15
      }));
    }
    s.fxBack.add(rings);
    s.tick = function (t) {
      rings.children.forEach(function (c, i) {
        const phase = ((t / 1600) + i / 4) % 1;
        c.radius(60 + phase * 300);
        c.opacity((1 - phase) * 0.7);
      });
    };
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 3, title: 'Капитан', place: 'Рубка · пульт',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setBridge(root, p); },
      order: ['guard1', 'guard2', 'nullar', 'hunter'],
      figures: {
        guard1: { variant: 'guard', x: 240, y: 1700, scale: 1.5, pose: 'stand', emotion: 'neutral', palette: PAL.guard },
        guard2: { variant: 'guard', x: 420, y: 1710, scale: 1.44, pose: 'stand', emotion: 'neutral', palette: PAL.guard },
        nullar: { x: 700, y: 1600, scale: 1.8, pose: 'stand', emotion: 'smirk', palette: PAL.nullar },
        hunter: { x: 1030, y: 1700, scale: 1.5, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'С этой минуты я капитан. Голосование было.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Я не голосовал.' },
        { slot: 'BR1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Тебя не было. Это считается.' }
      ]
    });
    lift(s, 30);
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 4, title: 'Охота', place: 'Коридор C · без света',
      tone: 'alarm', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setNightCorridor(root, p); },
      order: ['wei', 'hunter', 'turned1'],
      figures: {
        wei: { variant: 'doctor', x: 300, y: 1700, scale: 1.44, pose: 'crouch', emotion: 'fear', palette: PAL.doctor },
        hunter: { x: 560, y: 1690, scale: 1.6, pose: 'aim', emotion: 'focus', rifle: true, aimAngle: -0.02, palette: PAL.hunter },
        turned1: {
          variant: 'turned', x: 1020, y: 1700, scale: 1.54, pose: 'run', emotion: 'angry', flip: true,
          palette: PAL.turned, mutant: { veins: 0.7, tendrils: 2, claw: 0.7, eyeGlow: 0.7 }
        }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'В коридоре — трое. И они не ищут выход.' },
        { slot: 'BL1', kind: 'narration', text: 'Они искали нас.' }
      ]
    });
    lift(s, 26);
    const m = s.figures.hunter.muzzle();
    s.tracer(m, { x: 940, y: 1200 }, { w: 7, seed: 55, wobble: 8 });
    s.impact(940, 1200, 36);
    s.fire = function (engine) {
      const mm = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 160);
      if (engine && engine.particlesHost) {
        Cine.Particles.muzzle(engine.particlesHost, mm.x, mm.y, 0, '#ff9a5c');
        Cine.Particles.sparks(engine.particlesHost, 940, 1200, '#ff5a8f', 32);
      }
      Cine.Shake.kick(22);
    };
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 5, title: 'Внизу кто-то есть', place: 'Коридор C · решётка',
      tone: 'alarm', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setNightCorridor(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 420, y: 1700, scale: 1.66, pose: 'crouch', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 860, y: 1690, scale: 1.5, pose: 'crouch', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Это не шаги. Это дыхание через металл.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Тогда мы тоже подышим тише.' }
      ]
    });
    lift(s, 28);
    // решётка, под ней движение
    const grate = new (K().Group)();
    for (let i = 0; i < 10; i++) {
      grate.add(new (K().Line)({
        points: [280 + i * 64, 1480, 280 + i * 64, 1580],
        stroke: '#1d333a', strokeWidth: 7
      }));
    }
    s.frame.add(grate);
    s.tick = function (t) {
      grate.y(Math.sin(t / 380) * 1.6);
      if (Math.sin(t / 1300) > 0.96) Cine.Shake.kick(3);
    };
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 6, title: 'Контакт', place: 'Обзорный иллюминатор',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setPorthole(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 220, y: 1740, scale: 1.4, pose: 'stand', emotion: 'fear', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 990, y: 1740, scale: 1.34, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Оно смотрит. Смотрит именно на нас.' },
        { slot: 'BL1', kind: 'narration', text: 'В иллюминатор было видно только глаз.' }
      ]
    });
    lift(s, 20);
    // в стекле видно только массу и глаз — иначе тварь кажется внутри станции
    const eye = Cine.eyeAtGlass({ x: 600, y: 820, r: 400, scale: 1.5, glow: '#8affd6', tilt: 6, eyeR: 0.30 });
    s.fxBack.add(eye);
    s.nodes.leviathan = eye;
    s.frame.add(Cine.portholeRim({ x: 600, y: 820, r: 400 }));
    s.tick = function (t) {
      eye.x(Math.sin(t / 3400) * 22);
      eye.y(Math.sin(t / 2700) * 10);
      if (Math.sin(t / 1800) > 0.985) Cine.Shake.kick(6);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(14);
      if (engine && engine.particlesHost) Cine.Particles.embers(engine.particlesHost, 600, 900);
    };
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 7, title: 'Тварь у стекла', place: 'Обзорный иллюминатор',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setPorthole(root, p); },
      order: [],
      figures: {},
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Оно прижалось к стеклу так, будто хотело внутрь.' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Не бойтесь. Оно пришло не за вами.' }
      ]
    });
    lift(s, 14);
    const eye = Cine.eyeAtGlass({ x: 600, y: 820, r: 400, scale: 2.05, glow: '#8affd6', tilt: 10, eyeR: 0.36, dim: 0 });
    s.fxBack.add(eye);
    s.nodes.leviathan = eye;
    s.frame.add(Cine.portholeRim({ x: 600, y: 820, r: 400 }));
    s.tick = function (t) {
      eye.y(Math.sin(t / 2100) * 7);
      eye.rotation(Math.sin(t / 6000) * 1.2);
    };
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 8, title: 'Приказ капитана', place: 'Рубка',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setBridge(root, p); },
      order: ['nullar', 'hunter'],
      figures: {
        nullar: { x: 400, y: 1660, scale: 1.9, pose: 'stand', emotion: 'smirk', palette: PAL.nullar },
        hunter: { x: 940, y: 1700, scale: 1.62, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Мы откроем шлюз и впустим его.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты с ума сошёл.' },
        { slot: 'BR1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Я капитан. Мне можно.' }
      ]
    });
    lift(s, 34);
    s.tick = function (t) {
      s.root.opacity(0.94 + Math.abs(Math.sin(t / 1100)) * 0.06);
    };
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 9, title: 'Шлюз открыт', place: 'Тамбур · наружная створка',
      tone: 'green', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setLockRoom(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 300, y: 1700, scale: 1.6, pose: 'guard', emotion: 'angry', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 900, y: 1700, scale: 1.46, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Створка пошла в сторону. Давление не изменилось — он просто вошёл.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Не стрелять. Пока не пойму, что это.' }
      ]
    });
    lift(s, 24);
    s.tick = function (t) {
      if (Math.sin(t / 900) > 0.97) Cine.Shake.kick(8);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(16);
      if (engine && engine.particlesHost) Cine.Particles.sparks(engine.particlesHost, 600, 1200, '#9df6ff', 40);
      Cine.FX.burst(600, 1200, { n: 12, dir: Math.PI * 1.4, power: 22, size: 12, up: 6, color: '#0a1a1c', edge: '#8affd6' });
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 6, page: 10, title: 'Оно вошло', place: 'Тамбур · внутри',
      tone: 'green', accent: '#8affd6',
      set: function (root, p) { return Cine.setLockRoom(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 200, y: 1700, scale: 1.44, pose: 'aim', emotion: 'fear', rifle: true, aimAngle: -0.06, palette: PAL.hunter },
        wei: { variant: 'doctor', x: 1000, y: 1700, scale: 1.38, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Оно заняло весь проём. И не поместилось в него.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Отойди к стене. Медленно.' }
      ]
    });
    lift(s, 18);
    const arm = Cine.deepArm({
      from: { x: 250, y: 1600 }, to: { x: 1150, y: 1120 },
      width: 150, bow: -170, glow: '#8affd6', opacity: 0.95
    });
    s.fxBack.add(arm);
    s.tick = function (t) {
      arm.y(Math.sin(t / 2400) * 22);
      if (Math.sin(t / 1500) > 0.98) Cine.Shake.kick(5);
    };
    return s;
  });
})(window);
