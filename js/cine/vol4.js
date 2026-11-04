/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 4 «ПРОБУЖДЕНИЕ», страницы 31–40
   То, что выросло из людей, начинает разговаривать. И приказывать.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  const W = 1200, H = 1800;
  Cine.VOL4 = PAGES;

  const PAL = {
    hunter: { cloth: '#1b2b32', cloth2: '#121b20' },
    nullar: { cloth: '#241d38', cloth2: '#141026' },
    doctor: { cloth: '#c9d6d9', cloth2: '#9fb2b8' },
    turned: { cloth: '#2f3d38', cloth2: '#182420' },
    turnedDeep: { cloth: '#263430', cloth2: '#131d1a' }
  };

  function lift(scene, dy) {
    if (scene && scene.frame) scene.frame.y(scene.frame.y() + dy);
    return scene;
  }

  const FULL = { veins: 1, tendrils: 4, claw: 1, eyeGlow: 0.9, glow: '#ff5a8f' };
  const MID = { veins: 0.7, tendrils: 2, claw: 0.6, eyeGlow: 0.7 };

  /* ============================================================== страница 1 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 1, title: 'Они собираются', place: 'Нижнее кольцо',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['hunter', 'wei', 'turned1', 'turned3', 'turned2'],
      figures: {
        hunter: { x: 170, y: 1650, scale: 1.54, pose: 'crouch', emotion: 'fear', palette: PAL.hunter },
        // Вэй считает вслух — она и произносит цифру
        wei: { variant: 'doctor', x: 335, y: 1672, scale: 1.4, pose: 'crouch', emotion: 'focus', palette: PAL.doctor },
        turned1: { variant: 'turned', x: 620, y: 1660, scale: 1.3, pose: 'stand', emotion: 'neutral', flip: true, palette: PAL.turned, mutant: { veins: 0.45, tendrils: 1, eyeGlow: 0.5 } },
        turned3: { variant: 'turned', x: 850, y: 1682, scale: 1.36, pose: 'stand', emotion: 'neutral', flip: true, palette: PAL.turned, mutant: { veins: 0.55, tendrils: 1, eyeGlow: 0.55 } },
        turned2: { variant: 'turnedDeep', x: 1080, y: 1650, scale: 1.44, pose: 'crouch', emotion: 'neutral', flip: true, palette: PAL.turnedDeep, mutant: { veins: 0.8, tendrils: 2, eyeGlow: 0.8 } }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Они не бежали. Они шли — и от этого было хуже.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Нас двое. Их — сколько угодно.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Их не «сколько угодно». Их семьдесят три.' }
      ]
    });
    lift(s, 26);
    s.tick = function (t) {
      ['turned1', 'turned2', 'turned3'].forEach(function (k, i) {
        const f = s.figures[k];
        if (f) f.group.x(f.group.x() + Math.sin(t / (300 + i * 90)) * 0.6);
      });
    };
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 2, title: 'Он говорит', place: 'Нижнее кольцо',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['hunter', 'voice'],
      figures: {
        hunter: { x: 450, y: 1660, scale: 1.76, pose: 'stand', emotion: 'fear', palette: PAL.hunter },
        voice: { variant: 'turnedDeep', x: 930, y: 1630, scale: 1.84, pose: 'stand', emotion: 'smirk', flip: true, palette: PAL.turnedDeep, mutant: FULL }
      },
      bubbles: [
        { slot: 'TL1', who: 'ГОЛОС', kind: 'speech', text: 'Ты пришёл. Я знал, что придёшь.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты — не Ортега.' },
        { slot: 'BR1', who: 'ГОЛОС', kind: 'speech', accent: true, text: 'Ортега был дверью. Я — то, что через неё прошло.' }
      ]
    });
    lift(s, 24);
    s.tick = function (t) {
      // голос набирает силу: свечение и щупальца медленно тянутся к Хантеру
      if (s.figures.voice) {
        const k = 0.5 + Math.sin(t / 1700) * 0.4;
        s.figures.voice.mutant({ veins: k, tendrils: 4, claw: 0.8, eyeGlow: k, glow: '#ff5a8f' });
      }
    };
    s.fire = function (engine) {
      Cine.Shake.kick(10);
      if (engine && engine.particlesHost) Cine.Particles.sparks(engine.particlesHost, 760, 1120, '#ff5a8f', 24);
    };
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 3, title: 'Приказ', place: 'Нижнее кольцо · развилка',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['turned1', 'turned3', 'turned2', 'nullar'],
      figures: {
        turned1: { variant: 'turned', x: 250, y: 1650, scale: 1.34, pose: 'stand', emotion: 'neutral', palette: PAL.turned, mutant: { veins: 0.5, tendrils: 1, eyeGlow: 0.5 } },
        turned3: { variant: 'turned', x: 500, y: 1670, scale: 1.3, pose: 'crouch', emotion: 'neutral', palette: PAL.turned, mutant: { veins: 0.45, tendrils: 1, eyeGlow: 0.45 } },
        turned2: { variant: 'turnedDeep', x: 760, y: 1650, scale: 1.44, pose: 'stand', emotion: 'neutral', palette: PAL.turnedDeep, mutant: { veins: 0.7, tendrils: 2, eyeGlow: 0.6 } },
        nullar: { x: 1020, y: 1600, scale: 1.82, pose: 'stand', emotion: 'smirk', flip: true, palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Стоять здесь. Пока я не позову.' },
        { slot: 'BL1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'И они встали. Все. Одновременно.' }
      ]
    });
    lift(s, 30);
    s.tick = function (t) {
      // они стоят совершенно синхронно — вот что страшно
      ['turned1', 'turned2', 'turned3'].forEach(function (k, i) {
        const f = s.figures[k];
        if (f) f.set({ headTilt: Math.sin(t / 2100) * 0.1, lean: 0.04 + Math.sin(t / 2100) * 0.02 });
      });
    };
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 4, title: 'Ему это нравится', place: 'Рубка',
      tone: 'violet', accent: '#c6a8ff',
      set: function (root, p) { return Cine.setBridge(root, p); },
      order: ['hunter', 'nullar'],
      figures: {
        hunter: { x: 320, y: 1640, scale: 1.8, pose: 'aim', emotion: 'angry', rifle: true, palette: PAL.hunter },
        nullar: { x: 830, y: 1560, scale: 1.86, pose: 'sit', emotion: 'smirk', flip: true, palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Ты стрелял в них. Они даже не обиделись.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Они не умеют обижаться.' },
        { slot: 'BL1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Не умеют. Зато умеют слушать. Ты знаешь, как это приятно?' }
      ]
    });
    lift(s, 34);
    // ствол смотрит на Нуллара — он не опускает оружие даже в разговоре
    s.figures.hunter.aimAt(830, 1330);
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 5, title: 'Двое в тамбуре', place: 'Камбуз',
      tone: 'steel', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setGalley(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 340, y: 1640, scale: 1.9, pose: 'stand', emotion: 'neutral', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 830, y: 1620, scale: 1.72, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Вы не спите с момента взрыва.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Если я усну, кто-нибудь услышит приказ.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Вы правда думаете, что это передаётся через звук?' }
      ]
    });
    lift(s, 32);
    s.tick = function (t) {
      // кружки дрожат от вибрации реактора
      s.root.opacity(1);
      if (Math.sin(t / 170) > 0.985) Cine.Shake.kick(3);
    };
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    // БОЙ: несколько обращённых, Хантер с винтовкой
    const s = Cine.scene({
      vol: 4, page: 6, title: 'Стреляй и не останавливайся', place: 'Нижнее кольцо · проход',
      tone: 'green', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['hunter', 'turned1', 'turned3', 'turned2'],
      figures: {
        hunter: { x: 240, y: 1660, scale: 1.8, pose: 'aim', emotion: 'angry', rifle: true, aimAngle: -0.08, palette: PAL.hunter },
        turned1: { variant: 'turned', x: 780, y: 1680, scale: 1.5, pose: 'run', emotion: 'angry', flip: true, palette: PAL.turned, mutant: MID },
        turned3: { variant: 'turned', x: 1000, y: 1660, scale: 1.4, pose: 'run', emotion: 'angry', flip: true, palette: PAL.turned, mutant: MID },
        turned2: { variant: 'turnedDeep', x: 1110, y: 1690, scale: 1.56, pose: 'run', emotion: 'angry', flip: true, palette: PAL.turnedDeep, mutant: { veins: 0.85, tendrils: 2, eyeGlow: 0.8 } }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Первый — в ногу. Второй — в грудь.' },
        { slot: 'BL1', kind: 'narration', text: 'Он считал вслух. Это было единственное, что помогало.' }
      ]
    });
    lift(s, 22);
    const m = s.figures.hunter.muzzle();
    s.tracer(m, { x: 860, y: 1230 }, { w: 8, seed: 91, wobble: 9 });
    s.impact(860, 1230, 40);
    s.flash(m.x, m.y, 22, s.figures.hunter.aimAt(860, 1230));

    s.tick = function (t) {
      [s.figures.turned1, s.figures.turned3].forEach(function (f, i) {
        if (!f) return;
        const base = [780, 1000][i];
        f.group.x(base + Math.sin(t / (200 + i * 60)) * 14);
      });
    };
    s.fire = function (engine) {
      const mm = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 150);
      if (engine && engine.particlesHost) {
        Cine.Particles.muzzle(engine.particlesHost, mm.x, mm.y, 0, '#ff9a5c');
        Cine.Particles.sparks(engine.particlesHost, 860, 1230, '#ff5a8f', 36);
        Cine.Particles.blood(engine.particlesHost, 860, 1210, Math.PI * 0.95, 20);
      }
      Cine.FX.burst(860, 1230, { n: 14, dir: Math.PI * 0.35, power: 28, size: 12, up: 8, color: '#22302a', edge: '#ff9a5c' });
      Cine.Shake.kick(24);
    };
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 7, title: 'Обращённый Ортега', place: 'Нижнее кольцо',
      tone: 'green', accent: '#8affd6',
      set: function (root, p) { return Cine.setLowerRing(root, p); },
      order: ['turned1', 'hunter'],
      figures: {
        turned1: { variant: 'turnedDeep', x: 790, y: 1670, scale: 1.88, pose: 'crouch', emotion: 'pain', flip: true, palette: PAL.turnedDeep, mutant: { veins: 0.9, tendrils: 1, claw: 0.8, eyeGlow: 0.3 } },
        hunter: { x: 290, y: 1650, scale: 1.78, pose: 'aim', emotion: 'pain', rifle: true, aimAngle: 0.16, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ОБРАЩЁННЫЙ', kind: 'speech', text: '…хант…' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Я здесь, сержант.' },
        { slot: 'BL1', kind: 'narration', text: 'Он выстрелил один раз. И стоял над телом дольше, чем требовалось.' }
      ]
    });
    lift(s, 26);
    s.tick = function (t) {
      if (s.figures.turned1) {
        s.figures.turned1.mutant({ veins: 0.9 - (t % 9000) / 12000, tendrils: 2, claw: 0.8, eyeGlow: Math.max(0, 0.3 - (t % 12000) / 40000), glow: '#8affd6' });
      }
    };
    s.fire = function (engine) {
      const m = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 200);
      if (engine && engine.particlesHost) Cine.Particles.muzzle(engine.particlesHost, m.x, m.y, 0, '#ff9a5c');
      Cine.Shake.kick(18);
    };
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 8, title: 'Первый человек', place: 'Медотсек',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setMedbay(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 380, y: 1620, scale: 1.74, pose: 'crouch', emotion: 'fear', palette: PAL.doctor },
        hunter: { x: 850, y: 1650, scale: 1.8, pose: 'crouch', emotion: 'neutral', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Вы убили человека.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Я убил то, что от него осталось.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Это одно и то же. И вы это знаете.' }
      ]
    });
    lift(s, 40);
    // разбитый тонометр и кровь на полу
    const debris = new (K().Group)();
    for (let i = 0; i < 11; i++) {
      const bx = 250 + i * 62, by = 1660 + (i % 3) * 34;
      debris.add(new (K().Line)({
        points: [bx, by, bx + 20 + (i % 4) * 8, by + 12 + (i % 3) * 9],
        stroke: i % 3 === 0 ? '#8e1414' : '#bfe9f2', strokeWidth: 2 + (i % 3), opacity: 0.45, lineCap: 'round'
      }));
    }
    s.frame.add(debris);
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 9, title: 'Мнема отвечает', place: 'Архивный зал',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setArchive(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 360, y: 1640, scale: 1.8, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 830, y: 1640, scale: 1.7, pose: 'crouch', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Мнема. Кто задал тебе вопрос?' },
        { slot: 'TR1', who: 'МНЕМА', kind: 'speech', text: 'Никто. Я отвечаю на вопрос, который ещё не прозвучал.' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Вы спрашивали про дверь. Дверь — это Ортега.' }
      ]
    });
    lift(s, 44);
    s.tick = function (t) {
      // искры памяти бегут быстрее, чем должны
      if (s.nodes.sparks) {
        s.nodes.sparks.children.forEach(function (c, i) {
          c.y(430 + ((i * 137 + t * (0.12 + (i % 5) * 0.05)) % 1080));
        });
      }
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 4, page: 10, title: 'Он выбрал сторону', place: 'Рубка · пульт',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setBridge(root, p); },
      order: ['hunter', 'nullar', 'turned1', 'turned2'],
      figures: {
        hunter: { x: 230, y: 1650, scale: 1.66, pose: 'aim', emotion: 'angry', rifle: true, aimAngle: -0.1, palette: PAL.hunter },
        nullar: { x: 540, y: 1600, scale: 1.78, pose: 'stand', emotion: 'smirk', palette: PAL.nullar },
        turned1: { variant: 'turnedDeep', x: 840, y: 1660, scale: 1.6, pose: 'stand', emotion: 'neutral', flip: true, palette: PAL.turnedDeep, mutant: { veins: 0.9, tendrils: 2, claw: 0.8, eyeGlow: 0.85 } },
        turned2: { variant: 'turned', x: 1060, y: 1650, scale: 1.4, pose: 'stand', emotion: 'neutral', flip: true, palette: PAL.turned, mutant: { veins: 0.6, tendrils: 1, eyeGlow: 0.5 } }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Опусти ствол, Хантер. Тебе не в кого стрелять.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Есть. Всегда есть.' },
        { slot: 'BL1', kind: 'narration', text: 'Он выбрал сторону раньше, чем понял, что выбирает.' }
      ]
    });
    lift(s, 28);
    s.tick = function (t) {
      // свет мутантов отражается на металле рубки
      s.root.opacity(0.94 + Math.abs(Math.sin(t / 800)) * 0.06);
    };
    s.fire = function (engine) {
      const m = s.figures.hunter.muzzle();
      s.figures.hunter.pose('recoil');
      setTimeout(function () { s.figures.hunter.pose('aim'); }, 170);
      if (engine && engine.particlesHost) Cine.Particles.muzzle(engine.particlesHost, m.x, m.y, 0, '#ff5a8f');
      Cine.Shake.kick(18);
    };
    return s;
  });
})(window);
