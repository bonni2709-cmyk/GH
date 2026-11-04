/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 2 «ТИШИНА», страницы 11–20
   Восемь дней до запуска. Ни одного сверхъестественного кадра — до последнего.
   Страница 9 — драка на руках, страница 10 — взрыв и первая мутация.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  Cine.VOL2 = PAGES;
  const W = 1200, H = 1800;

  const PAL = {
    hunter: { cloth: '#1b2b32', cloth2: '#121b20' },
    guard: { cloth: '#2a3a44', cloth2: '#18242b' },
    guardB: { cloth: '#22313a', cloth2: '#141f25' },
    nullar: { cloth: '#2a2340', cloth2: '#171228' },
    doctor: { cloth: '#c9d6d9', cloth2: '#9fb2b8' },
    tech: { cloth: '#2a3238', cloth2: '#1a2226' },
    kraken: { cloth: '#3a3f33', cloth2: '#24271f' }
  };

  function lift(scene, dy) {
    if (scene && scene.frame) scene.frame.y(scene.frame.y() + dy);
    return scene;
  }

  /* ============================================================== страница 1 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 1, tone: 'depth', accent: '#7dfbd0',
      title: 'Контакт', place: 'Вахтенный пост · 06:20',
      set: function (root, p) { return Cine.setWatch(root, p); },
      order: ['wei', 'kraken', 'hunter'],
      figures: {
        // Вэй спит в кресле, свернувшись
        wei: { variant: 'doctor', x: 260, y: 1560, scale: 1.3, pose: 'crouch', emotion: 'neutral', palette: PAL.doctor },
        kraken: { x: 520, y: 1600, scale: 1.62, pose: 'run', emotion: 'fear', palette: PAL.kraken },
        hunter: { x: 880, y: 1560, scale: 1.6, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Сонар показывал контакт. В сорока метрах от корпуса.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'И?' },
        { slot: 'BL1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'И теперь не показывает. Он не ушёл, Хантер. Он остановился.' }
      ]
    });
    lift(s, 54);
    // метка контакта на сонаре, пульсирует
    const blip = new (K().Circle)({
      x: 700, y: 700, radius: 9,
      fill: '#ff6b4a', shadowColor: '#ff6b4a', shadowBlur: 24, opacity: 0.9
    });
    const ring = new (K().Circle)({ x: 700, y: 700, radius: 18, stroke: 'rgba(255,107,74,0.5)', strokeWidth: 2 });
    s.frame.add(blip); s.frame.add(ring);
    s.tick = function (t) {
      const k = (t % 2200) / 2200;
      ring.radius(18 + k * 54);
      ring.opacity(0.6 * (1 - k));
      blip.opacity(0.55 + Math.abs(Math.sin(t / 420)) * 0.45);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(8);
      if (engine && engine.particlesHost) Cine.Particles.sparks(engine.particlesHost, 700, 700, '#7dfbd0', 14);
    };
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 2, tone: 'green', accent: '#7dfbd0',
      title: 'Контур живой', place: 'Реакторный зал',
      set: function (root, p) { return Cine.setReactor(root, p); },
      order: ['hunter', 'kraken'],
      figures: {
        kraken: { x: 720, y: 1600, scale: 1.7, pose: 'crouch', emotion: 'smirk', palette: PAL.kraken },
        hunter: { x: 300, y: 1560, scale: 1.62, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Контур живой. Он растёт. Он сам себя чинит.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты пустил в реактор неизвестную биологию.' },
        { slot: 'BL1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Я пустил в реактор будущее. Разница в терминологии.' }
      ]
    });
    lift(s, 60);
    // открытая панель контура: тёплый свет и жилы
    const panel = new (K().Group)();
    panel.add(new (K().Path)({
      data: 'M600 1180 L780 1160 L800 1400 L600 1420 Z',
      fill: '#120d08', stroke: '#2b3a2a', strokeWidth: 4
    }));
    for (let i = 0; i < 7; i++) {
      panel.add(new (K().Path)({
        data: 'M' + (620 + i * 24) + ' 1190 C' + (640 + i * 24) + ' 1260 ' + (600 + i * 24) + ' 1330 ' + (628 + i * 24) + ' 1410',
        stroke: i % 2 ? '#7dfbd0' : '#c9ffe8', strokeWidth: 2.4, opacity: 0.55, lineCap: 'round'
      }));
    }
    panel.add(new (K().Ellipse)({
      x: 700, y: 1300, radiusX: 130, radiusY: 120,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 130,
      fillRadialGradientColorStops: [0, 'rgba(125,251,208,0.18)', 1, 'rgba(125,251,208,0)']
    }));
    s.frame.add(panel);
    s.nodes.panel = panel;
    s.tick = function (t) {
      panel.opacity(0.75 + Math.sin(t / 700) * 0.25);
    };
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 3, tone: 'steel', accent: '#c6a8ff',
      title: 'Приказ — это бумага', place: 'Камбуз · ночь',
      set: function (root, p) { return Cine.setGalley(root, p); },
      order: ['guardB', 'guardA', 'nullar'],
      figures: {
        guardB: { x: 180, y: 1620, scale: 1.46, pose: 'stand', emotion: 'fear', palette: PAL.guardB },
        guardA: { x: 520, y: 1560, scale: 1.5, pose: 'crouch', emotion: 'neutral', flip: true, palette: PAL.guard },
        nullar: { x: 880, y: 1520, scale: 1.74, pose: 'lean', emotion: 'smirk', palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Он не отдаст образец. Значит, мы забираем не образец.' },
        { slot: 'BL1', who: 'ОХРАННИК', kind: 'speech', text: 'Приказ?' },
        { slot: 'BR1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Приказ — это бумага. Я — это приказ.' }
      ]
    });
    lift(s, 48);
    // разбитый стакан и кровь на столе
    const shard = new (K().Group)();
    for (let i = 0; i < 6; i++) {
      shard.add(new (K().Line)({
        points: [430 + i * 12, 1330 + (i % 3) * 6, 442 + i * 16, 1352 + (i % 2) * 8],
        stroke: '#bfe9f2', strokeWidth: 2, opacity: 0.45
      }));
    }
    shard.add(new (K().Ellipse)({ x: 500, y: 1352, radiusX: 26, radiusY: 7, fill: 'rgba(180,30,30,0.55)' }));
    s.frame.add(shard);
    s.tick = function (t) {
      // плафон качается
      if (s.nodes.lamp) s.nodes.lamp.rotation(Math.sin(t / 1900) * 1.6);
    };
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 4, tone: 'depth', accent: '#9df6ff',
      title: 'Первые двенадцать часов', place: 'Архивное ядро',
      set: function (root, p) { return Cine.setArchive(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        hunter: { x: 330, y: 1620, scale: 1.6, pose: 'crouch', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 860, y: 1620, scale: 1.52, pose: 'crouch', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Мой журнал начинается за четыре часа до прибытия метеорита. Раньше — нет.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'То есть тебя включили в тот момент.' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Меня не включали. Меня не выключали. Это разные вещи.' }
      ]
    });
    lift(s, 44);
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 5, tone: 'green', accent: '#8affd6',
      title: 'Он стучит', place: 'Биолаборатория',
      set: function (root, p) { return Cine.setLab(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        wei: { variant: 'doctor', x: 300, y: 1580, scale: 1.5, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor },
        hunter: { x: 880, y: 1560, scale: 1.62, pose: 'stand', emotion: 'focus', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Он стучит.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Что значит «стучит»?' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Он стучит мне в ответ. Я постучала. И он ответил.' }
      ]
    });
    lift(s, 52);
    // удар изнутри камня: волна по стеклу
    const wave = new (K().Circle)({ x: 800, y: 950, radius: 30, stroke: 'rgba(200,255,235,0.5)', strokeWidth: 2.2, opacity: 0 });
    s.frame.add(wave);
    s.tick = function (t) {
      const k = (t % 1600) / 1600;
      wave.radius(30 + k * 150);
      wave.opacity(k < 0.75 ? 0.5 * (1 - k / 0.75) : 0);
      if (k < 0.03) Cine.Shake.kick(5);
      if (s.nodes.pulse) {
        const p2 = 0.5 + Math.sin(t / 300) * 0.5;
        s.nodes.pulse.opacity(0.12 + p2 * 0.34);
      }
    };
    s.fire = function (engine) {
      Cine.Shake.kick(12);
      if (engine && engine.particlesHost) Cine.Particles.sparks(engine.particlesHost, 800, 950, '#8affd6', 18);
    };
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 6, tone: 'depth', accent: '#9df6ff',
      title: 'Чужой шаг', place: 'Технический тоннель',
      set: function (root, p) { return Cine.setTunnel(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        // оба пригнулись, фонарь в руке Хантера
        hunter: { x: 430, y: 1560, scale: 1.9, pose: 'crouch', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 860, y: 1580, scale: 1.78, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Это ваши?' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'У моих другой шаг. Тяжелее.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Разве?' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'У моих есть причина бояться.' }
      ]
    });
    lift(s, 40);
    // конус фонаря из руки
    const beam = new (K().Line)({
      points: [560, 1330, 700, 1120, 840, 1080, 940, 1200],
      stroke: 'rgba(230,252,255,0.10)', strokeWidth: 64, lineCap: 'round', lineJoin: 'round',
      shadowColor: 'rgba(220,250,255,0.7)', shadowBlur: 48
    });
    beam.opacity(0.42);
    s.fxBack.add(beam);   // свет под фигурами, а не поверх них
    // фонарь в руке
    const lampDot = new (K().Circle)({ x: 560, y: 1330, radius: 10, fill: '#eafcff', shadowColor: '#cdf6ff', shadowBlur: 46, opacity: 0.95 });
    s.root.add(lampDot);
    // второй луч, далёкий и чужой
    const other = new (K().Line)({ points: [1060, 940, 950, 1210], stroke: 'rgba(200,240,255,0.22)', strokeWidth: 22, lineCap: 'round' });
    s.root.add(other);
    s.tick = function (t) {
      other.opacity(0.08 + Math.abs(Math.sin(t / 1100)) * 0.2);
      beam.opacity(0.5 + Math.sin(t / 240) * 0.12);
      lampDot.opacity(0.7 + Math.abs(Math.sin(t / 130)) * 0.3);
    };
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 7, tone: 'green', accent: '#8affd6',
      title: 'Письмо', place: 'Биолаборатория · ночь',
      set: function (root, p) { return Cine.setLab(root, p); },
      order: ['wei'],
      figures: {
        wei: { variant: 'doctor', x: 940, y: 1560, scale: 1.86, pose: 'lean', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Ты не камень. Ты даже не животное.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Ты — письмо. И я тебя прочитаю.' }
      ]
    });
    lift(s, 60);
    // волокна тянутся к её пальцу
    const fibres = new (K().Group)();
    for (let i = 0; i < 8; i++) {
      fibres.add(new (K().Path)({
        data: 'M' + (812 + i * 6) + ' 900 C' + (840 + i * 10) + ' 980 ' + (880 + i * 6) + ' 1040 ' + (1000 + i * 4) + ' ' + (1090 + i * 10),
        stroke: i % 2 ? 'rgba(200,255,235,0.7)' : 'rgba(125,251,208,0.9)',
        strokeWidth: 2.6, lineCap: 'round', opacity: 0.8
      }));
      fibres.add(new (K().Circle)({
        x: 1000 + i * 4, y: 1090 + i * 10, radius: 4,
        fill: '#d8fff2', shadowColor: '#8affd6', shadowBlur: 16, opacity: 0.8
      }));
    }
    s.frame.add(fibres);
    s.tick = function (t) {
      fibres.opacity(0.45 + Math.abs(Math.sin(t / 900)) * 0.5);
      if (s.nodes.pulse) s.nodes.pulse.opacity(0.14 + Math.abs(Math.sin(t / 380)) * 0.3);
    };
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 2, page: 8, tone: 'alarm', accent: '#ff5a3d',
      title: 'Она держит', place: 'Реакторный зал · перегрузка',
      set: function (root, p) { return Cine.setReactorHot(root, p); },
      order: ['hunter', 'kraken'],
      figures: {
        kraken: { x: 760, y: 1600, scale: 1.8, pose: 'guard', emotion: 'shout', flip: true, palette: PAL.kraken },
        hunter: { x: 300, y: 1620, scale: 1.56, pose: 'run', emotion: 'angry', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Она держит! Она держит, я слышу!' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Отпусти вентиль!' },
        { slot: 'BL1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Не могу. Он меня держит.' }
      ]
    });
    lift(s, 46);
    s.tick = function (t) {
      // белый свет пульсирует, всё чаще
      const k = Math.abs(Math.sin(t / 260));
      s.root.opacity(0.86 + k * 0.14);
      if (k > 0.97) Cine.Shake.kick(6);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(18);
      Cine.FX.burst(900, 900, { n: 8, dir: Math.PI * 0.5, power: 20, size: 10, up: 5, color: '#3a4a44', edge: '#c9ffe8' });
    };
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    // ДРАКА: двое людей, руки, локти, кровь. Никаких мутаций.
    const s = Cine.scene({
      vol: 2, page: 9, tone: 'alarm', accent: '#ff5a3d',
      title: 'Двое уставших людей', place: 'Реакторный зал · пол',
      set: function (root, p) {
        const out = Cine.setReactorHot(root, p);
        // кабель, гильзы, кровь на полу
        const SimplexLib = global.SimplexNoise;
        const n = new (SimplexLib)(9911);
        for (let i = 0; i < 26; i++) {
          const x = 120 + ((i * 173) % 960);
          const y = 1480 + ((i * 61) % 240);
          root.add(new (K().Circle)({ x: x, y: y, radius: 2 + (i % 3), fill: '#c9a227', opacity: 0.55 }));
        }
        for (let i = 0; i < 3; i++) {
          root.add(new (K().Path)({
            data: 'M-100 ' + (1500 + i * 40) + ' C200 ' + (1440 + i * 60) + ' 500 ' + (1540 + i * 30) + ' 1300 ' + (1470 + i * 50),
            stroke: '#0b1418', strokeWidth: 12 - i * 2, opacity: 0.9
          }));
        }
        // кровь на полу
        for (let i = 0; i < 7; i++) {
          const bx = 520 + n.noise2D(i, 1) * 260;
          const by = 1600 + n.noise2D(i, 5) * 90;
          root.add(new (K().Ellipse)({
            x: bx, y: by, radiusX: 12 + Math.abs(n.noise2D(i, 3)) * 30, radiusY: 4 + Math.abs(n.noise2D(i, 7)) * 8,
            fill: 'rgba(150,24,24,0.55)'
          }));
        }
        return out;
      },
      order: ['kraken', 'hunter'],
      /* Хантер бьёт правой в челюсть: кулак ведёт вверх-вперёд */
      figures: {
        // Хантер бьёт снизу вверх, Кракентаус уже откинулся
        kraken: { x: 720, y: 1660, scale: 1.8, pose: 'hit', emotion: 'pain', flip: true, palette: PAL.kraken },
        hunter: { x: 470, y: 1680, scale: 1.86, pose: 'lean', emotion: 'angry', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты убьёшь всех.' },
        { slot: 'TR1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Я всех и спасаю. Просто ты не видишь.' },
        { slot: 'BL1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Господа. У нас гости.' }
      ]
    });
    lift(s, 34);

    // стойка удара: передняя рука выброшена в челюсть, вес на передней ноге
    if (s.figures.hunter) {
      s.figures.hunter.set({
        lean: 0.3, headTilt: 0.16, hipShift: 14, crouch: 0.26,
        handL: { x: 102, y: -430 }, handR: { x: -84, y: -232 },
        footL: { x: 92, y: 0 }, footR: { x: -72, y: 6 }
      });
    }

    // кровь из носа и удар — Konva-«брызги» линиями
    const splatter = new (K().Group)();
    for (let i = 0; i < 14; i++) {
      const a = -1.1 + (i / 14) * 2.0;
      const l = 34 + (i % 4) * 30;
      splatter.add(new (K().Line)({
        points: [672, 1112, 672 + Math.cos(a) * l, 1112 + Math.sin(a) * l],
        stroke: i % 3 ? '#8e1414' : '#c02020', strokeWidth: 2.6 + (i % 3), opacity: 0.85, lineCap: 'round'
      }));
    }
    // след удара: рваная вспышка контакта
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.34;
      splatter.add(new (K().Line)({
        points: [676, 1104, 676 + Math.cos(a) * (70 + i * 14), 1104 + Math.sin(a) * (70 + i * 14)],
        stroke: 'rgba(255,240,200,0.55)', strokeWidth: 3 - i * 0.3, lineCap: 'round'
      }));
    }
    s.root.add(splatter);
    s.nodes.splatter = splatter;

    s.tick = function (t) {
      s.root.opacity(0.9 + Math.abs(Math.sin(t / 300)) * 0.1);
      splatter.opacity(0.55 + Math.abs(Math.sin(t / 1400)) * 0.45);
      const phase = (t % 2400) / 2400;
      if (phase < 0.04) {
        // смена поз: удар → отшатывание → снова удар
        try {
          const h = s.figures.hunter, k = s.figures.kraken;
          h.pose(phase < 0.02 ? 'lean' : 'aim');
          k.pose(phase < 0.02 ? 'hit' : 'guard');
        } catch (e) { /* позы есть всегда */ }
      }
    };
    s.fire = function (engine) {
      // это не выстрел, а удар: тряска + брызги + обломки с пола
      Cine.Shake.kick(20);
      Cine.FX.burst(678, 1122, { n: 5, dir: Math.PI * 0.75, power: 16, size: 7, up: 4, color: '#2a1a1a', edge: '#b03030' });
      if (engine && engine.particlesHost) Cine.Particles.blood(engine.particlesHost, 680, 1112, Math.PI * 0.2, 26);
      if (s.figures.kraken) s.figures.kraken.emotion('pain');
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    // ВЗРЫВ. Последний кадр тома — первая мутация.
    const s = Cine.scene({
      vol: 2, page: 10, tone: 'alarm', accent: '#8affd6',
      title: 'Вот теперь — началось', place: 'Коридор у реактора · 23:41',
      set: function (root, p) { return Cine.setBlastCorridor(root, p); },
      order: ['kraken', 'wei', 'hunter', 'nullar'],
      figures: {
        // Кракентаус стоит в светящейся воде, руки подняты
        kraken: { x: 640, y: 1520, scale: 1.66, pose: 'guard', emotion: 'smirk', palette: { cloth: '#3a3f33', cloth2: '#24271f', accent: '#8affd6' } },
        // Хантер оттаскивает Вэй назад
        wei: { variant: 'doctor', x: 990, y: 1640, scale: 1.4, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor },
        hunter: { x: 1080, y: 1540, scale: 1.58, pose: 'run', emotion: 'angry', flip: true, palette: PAL.hunter },
        nullar: { x: 180, y: 1600, scale: 1.34, pose: 'stand', emotion: 'smirk', palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Не смотрите на свет.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Поздно.' },
        { slot: 'BL1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Вот теперь — началось.' }
      ]
    });
    // тут кадр не поднимаем — нам нужен низ с водой
    const p = s.palette;

    // 1) мутация: под кожей предплечий проступают ровные светящиеся линии
    const veins = new (K().Group)();
    const kf = s.figures.kraken;
    const jt = kf.nodes && kf.nodes.s ? kf.nodes.s : null;
    const arms = jt ? [
      { a: jt.eL, b: jt.handL }, { a: jt.eR, b: jt.handR }
    ] : [];
    const toWorld = function (pt) {
      return { x: kf.group.x() + pt.x * kf.group.scaleX(), y: kf.group.y() + pt.y * kf.group.scaleY() };
    };
    arms.forEach(function (arm) {
      const A = toWorld(arm.a), B = toWorld(arm.b);
      for (let i = -2; i <= 2; i++) {
        const nx = -(B.y - A.y), ny = (B.x - A.x);
        const L = Math.hypot(nx, ny) || 1;
        const ox = nx / L * i * 7, oy = ny / L * i * 7;
        veins.add(new (K().Line)({
          points: [A.x + ox, A.y + oy, (A.x + B.x) / 2 + ox * 1.4, (A.y + B.y) / 2 + oy * 1.4, B.x + ox * 0.6, B.y + oy * 0.6],
          stroke: Math.abs(i) === 2 ? '#c9ffe8' : '#8affd6',
          strokeWidth: 4.4 - Math.abs(i) * 0.5,
          opacity: 1, lineCap: 'round', lineJoin: 'round',
          shadowColor: '#8affd6', shadowBlur: 30
        }));
      }
    });
    // глаза больше не человеческие: ровное холодное свечение
    const eyes = new (K().Group)();
    if (jt) {
      const H2 = toWorld(jt.head);
      [-1, 1].forEach(function (sgn, idx) {
        eyes.add(new (K().Circle)({
          x: H2.x + (idx ? 15 : -13) * kf.group.scaleX(), y: H2.y - 4 * kf.group.scaleY(),
          radius: 9, fill: '#ffffff', shadowColor: '#8affd6', shadowBlur: 40, opacity: 1
        }));
        eyes.add(new (K().Circle)({
          x: H2.x + (idx ? 15 : -13) * kf.group.scaleX(), y: H2.y - 4 * kf.group.scaleY(),
          radius: 20, fillRadialGradientStartPoint: { x: 0, y: 0 },
          fillRadialGradientEndPoint: { x: 0, y: 0 },
          fillRadialGradientRadius: 20,
          fillRadialGradientColorStops: [0, 'rgba(180,255,235,0.55)', 1, 'rgba(180,255,235,0)']
        }));
      });
      // свет из-под рукавов
      arms.forEach(function (arm) {
        const A = toWorld(arm.a), B = toWorld(arm.b);
        eyes.add(new (K().Circle)({
          x: B.x, y: B.y, radius: 30,
          fillRadialGradientStartPoint: { x: 0, y: 0 },
          fillRadialGradientEndPoint: { x: 0, y: 0 },
          fillRadialGradientRadius: 30,
          fillRadialGradientColorStops: [0, 'rgba(140,255,220,0.5)', 1, 'rgba(140,255,220,0)']
        }));
      });
    }
    s.root.add(veins);
    s.root.add(eyes);
    s.nodes.veins = veins;
    s.nodes.eyes = eyes;

    // 2) белый свет из пробоины и «ржавая» пыль
    const glow = new (K().Ellipse)({
      x: 300, y: 620, radiusX: 260, radiusY: 300,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 300,
      fillRadialGradientColorStops: [0, 'rgba(255,255,255,0.55)', 0.32, 'rgba(200,255,235,0.22)', 1, 'rgba(200,255,235,0)']
    });
    s.root.add(glow);

    // 3) вода: рваная кромка по simplex-noise
    const SimplexLib = global.SimplexNoise;
    const nz = new (SimplexLib)(2024);
    let wd = 'M-200 1420';
    for (let i = 0; i <= 30; i++) {
      const x = -200 + i / 30 * 1600;
      const y = 1420 + nz.noise2D(i * 0.6, 2) * 40;
      wd += ' L' + Math.round(x) + ' ' + Math.round(y);
    }
    wd += ' L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + ' Z';
    const water = new (K().Path)({
      data: wd,
      fillLinearGradientStartPoint: { x: 0, y: 1400 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, 'rgba(160,255,225,0.42)', 1, 'rgba(70,200,165,0.2)']
    });
    s.root.add(water);
    s.nodes.water = water;

    let flashT = 0;
    s.tick = function (t) {
      // вспышка при первом показе страницы, потом затухает
      if (flashT === 0) flashT = t;
      const dt = (t - flashT) / 1000;
      const f = Math.max(0, 1 - dt / 1.6);
      s.root.opacity(1);
      glow.opacity(0.35 + f * 0.65 + Math.sin(t / 400) * 0.05);
      veins.opacity(0.25 + (dt > 0.9 ? Math.min(1, (dt - 0.9) * 0.9) : 0) * 0.75);
      eyes.opacity(0.2 + (dt > 1.1 ? Math.min(1, (dt - 1.1) * 1.2) : 0) * 0.8);
        water.opacity(0.75 + Math.sin(t / 900) * 0.15);
      if (f > 0.85) Cine.Shake.kick(24);
      if (s.figures.kraken) {
        // руки медленно поднимаются
        const up = Math.min(1, dt / 2.2);
        s.figures.kraken.set({ lean: 0.02 - up * 0.12, headTilt: -0.16 * up,
          handL: { x: 120, y: -300 - up * 90 }, handR: { x: 40, y: -330 - up * 80 } });
      }
    };

    s.fire = function (engine) {
      Cine.Shake.kick(32);
      Cine.FX.burst(300, 620, { n: 14, dir: Math.PI * 0.5, power: 30, size: 12, up: 8, color: '#2a2a28', edge: '#ffb36b' });
      if (engine && engine.particlesHost) {
        Cine.Particles.sparks(engine.particlesHost, 300, 620, '#ffffff', 60);
        Cine.Particles.embers(engine.particlesHost, 300, 620);
        Cine.Particles.sparks(engine.particlesHost, 760, 1300, '#8affd6', 40);
      }
    };
    return s;
  });

  // экспорт с номером страницы
  Cine.VOL2 = PAGES;
})(window);
