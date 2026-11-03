/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 1 «ДНО», страницы 1–10
   Каждая страница: декорация + фигуры + реплики + маленькое «действие»
   (fire / hit / blink), которое читалка дёргает по таймеру.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  Cine.VOL1 = PAGES;
  const TONE = 'depth';

  /* ----------------------------------------------------------- вспомогалки */
  const PAL = {
    hunter: { cloth: '#1b2b32', cloth2: '#121b20' },
    guard: { cloth: '#2a3a44', cloth2: '#18242b' },
    guardB: { cloth: '#22313a', cloth2: '#141f25' },
    nullar: { cloth: '#2a2340', cloth2: '#171228' },
    doctor: { cloth: '#c9d6d9', cloth2: '#9fb2b8' },
    tech: { cloth: '#2a3238', cloth2: '#1a2226' },
    kraken: { cloth: '#3a3f33', cloth2: '#24271f' }
  };


  /* вертикальный кроп: сдвигаем весь кадр, координаты фигур остаются прямыми */
  function lift(scene, dy) {
    if (scene && scene.frame) scene.frame.y(scene.frame.y() + dy);
    return scene;
  }

  /* =============================================================== страница 1 */
  PAGES.push(function (opts) {
    const s = Cine.scene({
      vol: 1, page: 1, tone: 'depth', accent: '#39e0d2',
      title: 'Спуск', place: 'Тихий океан · 10 994 м',
      set: function (root, p) {
        const out = Cine.setOpenWater(root, p);
        // отражение большого света над станцией
        out.shaft = new (K().Path)({
          data: 'M420 -100 L520 -100 L620 1500 L300 1500 Z',
          fillLinearGradientStartPoint: { x: 0, y: -100 },
          fillLinearGradientEndPoint: { x: 0, y: 1500 },
          fillLinearGradientColorStops: [0, 'rgba(157,246,255,0.10)', 1, 'rgba(157,246,255,0)']
        });
        root.add(out.shaft);
        return out;
      },
      figures: {},
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Тихий океан. 10 994 метра под поверхностью.' },
        { slot: 'BL1', kind: 'narration', text: 'Здесь нет ни дня, ни ночи — только давление и гул воды, которой всё равно.' },
        { slot: 'BR1', who: 'СИСТЕМА', kind: 'speech', text: '«Генезис-1», ответьте. Третьи сутки молчания. Приём.' }
      ]
    });
    s.tick = function (t) {
      if (s.nodes.shaft) s.nodes.shaft.opacity(0.5 + Math.sin(t / 1800) * 0.3);
    };
    return s;
  });

  /* =============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 2, tone: 'steel', accent: '#ff7a2f',
      title: 'Смена «А»', place: 'Шлюзовой отсек',
      set: function (root, p) {
        const out = Cine.setAirlock(root, p);
        // пар из клапана
        for (let i = 0; i < 3; i++) {
          out['steam' + i] = new (K().Ellipse)({
            x: 880, y: 980 - i * 40, radiusX: 120 + i * 50, radiusY: 40 + i * 14,
            fillRadialGradientStartPoint: { x: 0, y: 0 },
            fillRadialGradientEndPoint: { x: 0, y: 0 },
            fillRadialGradientRadius: 160,
            fillRadialGradientColorStops: [0, 'rgba(220,245,255,0.07)', 1, 'rgba(220,245,255,0)']
          });
          root.add(out['steam' + i]);
        }
        return out;
      },
      order: ['hunter', 'kraken'],
      figures: {
        hunter: { x: 380, y: 1500, scale: 1.62, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        kraken: { x: 812, y: 1560, scale: 1.62, pose: 'crouch', emotion: 'smirk', palette: PAL.kraken }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Реактор держит восемьдесят. Больше не дам.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', text: 'Совет требует сто. Или проект закрывают.' },
        { slot: 'BL1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Пусть совет спустится и сам покрутит вентиль.' }
      ]
    });
    lift(s, 70);
    return s;
  });

  /* =============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 3, tone: 'steel', accent: '#7dfbd0',
      title: 'Реакторный зал', place: 'Сердце станции',
      set: function (root, p) { return Cine.setReactor(root, p); },
      order: ['hunter', 'kraken'],
      figures: {
        kraken: { x: 292, y: 1586, scale: 1.66, pose: 'stand', emotion: 'smirk', palette: PAL.kraken },
        hunter: { x: 946, y: 1560, scale: 1.56, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Биологический контур охлаждения. Энергии хватит на город под водой. Бесконечно.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', text: 'Слово «бесконечно» в техдокументации пишут только идиоты и самоубийцы.' },
        { slot: 'BL1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Или те, кто первым увидел будущее.' }
      ]
    });
    lift(s, 80);
    return s;
  });

  /* =============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 4, tone: 'steel', accent: '#8affd6',
      title: 'Он живой', place: 'Биолаборатория',
      set: function (root, p) { return Cine.setLab(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 468, y: 1590, scale: 1.6, pose: 'crouch', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 890, y: 1570, scale: 1.66, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Он отвечает на частоту. Метеорит. Он живой, Хантер.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Он камень, доктор.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Камень не подстраивается под мой пульс. А он подстраивается.' }
      ]
    });
    lift(s, 76);
    s.tick = function (t) {
      if (s.nodes.pulse) {
        const k = 0.5 + Math.sin(t / 420) * 0.5;
        s.nodes.pulse.opacity(0.1 + k * 0.3);
        s.nodes.pulse.radiusX(26 + k * 10);
        s.nodes.pulse.radiusY(16 + k * 7);
      }
    };
    return s;
  });

  /* =============================================================== страница 5 */
  PAGES.push(function () { return Cine.buildChapter1Page5 ? Cine.buildChapter1Page5() : null; });

  /* =============================================================== страница 6 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 6, tone: 'steel', accent: '#c6a8ff',
      title: 'Пять выстрелов', place: 'Кают-компания',
      set: function (root, p) { return Cine.setMess(root, p); },
      // край стола перед камерой: два человека за столом, а не в пустоте
      foreground: function (fg, p) {
        const table = new (K().Path)({
          data: 'M-100 1560 L' + 1300 + ' 1544 L1300 1900 L-100 1900 Z',
          fillLinearGradientStartPoint: { x: 0, y: 1544 },
          fillLinearGradientEndPoint: { x: 0, y: 1800 },
          fillLinearGradientColorStops: [0, '#1b2f37', 0.35, '#122228', 1, '#060d11']
        });
        fg.add(table);
        fg.add(new (K().Line)({ points: [-100, 1552, 1300, 1536], stroke: '#7fd8de', strokeWidth: 2.4, opacity: 0.3 }));
        // чашки в переднем плане
        [[300, 1620], [880, 1608]].forEach(function (c0) {
          fg.add(new (K().Ellipse)({ x: c0[0], y: c0[1], radiusX: 34, radiusY: 11, fill: '#0a1418', stroke: '#9fe8f0', strokeWidth: 1.6, opacity: 0.85 }));
          fg.add(new (K().Path)({
            data: 'M' + (c0[0] - 24) + ' ' + c0[1] + ' C' + (c0[0] - 22) + ' ' + (c0[1] - 34) + ' ' + (c0[0] + 22) + ' ' + (c0[1] - 34) + ' ' + (c0[0] + 24) + ' ' + c0[1],
            stroke: '#8fd8e0', strokeWidth: 2, opacity: 0.35
          }));
        });
        return {};
      },
      order: ['hunter', 'nullar'],
      kick: 60,
      figures: {
        hunter: { x: 292, y: 1500, scale: 1.8, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter },
        nullar: { variant: 'nullar', x: 860, y: 1490, scale: 1.72, pose: 'stand', emotion: 'smirk', palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Пять выстрелов. Четыре в стену, один в потолок. Вы очень аккуратны.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', text: 'Я считаю патроны. Вы — людей.' },
        { slot: 'BL1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Пока да.' }
      ]
    });
    lift(s, 64);
    // Нуллар медленно вращает чашку — микро-жест
    s.tick = function (t) {
      const n = s.figures.nullar;
      if (n) n.group.rotation(Math.sin(t / 1400) * 0.6);
    };
    return s;
  });

  /* =============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 7, tone: 'depth', accent: '#9df6ff',
      title: 'Мнема', place: 'Архивное ядро',
      set: function (root, p) { return Cine.setArchive(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        hunter: { x: 396, y: 1590, scale: 1.62, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 872, y: 1600, scale: 1.52, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Добрый вечер, начальник охраны. Вы не спали тридцать один час.' },
        { slot: 'TR1', who: 'ХАНТЕР', kind: 'speech', text: 'Считаешь?' },
        { slot: 'TL2', who: 'МНЕМА', kind: 'speech', text: 'Я не считаю. Я помню.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Она врёт. Первые двенадцать часов её памяти не существует.' }
      ]
    });
    lift(s, 70);
    s.tick = function (t) {
      if (!s.nodes.sparks) return;
      s.nodes.sparks.children.forEach(function (c, i) {
        c.y(430 + ((i * 137 + t * (0.05 + (i % 4) * 0.02)) % 1080));
      });
    };
    return s;
  });

  /* =============================================================== страница 8 */
  PAGES.push(function () {
    // маленькая искра сварки — Konva-частицы
    const s = Cine.scene({
      vol: 1, page: 8, tone: 'depth', accent: '#ffb36b',
      title: 'Она держит', place: 'Внешний ремонтный шлюз',
      set: function (root, p) {
        const out = Cine.setHull(root, p);
        out.weld = new (K().Group)();
        for (let i = 0; i < 14; i++) {
          out.weld.add(new (K().Line)({
            points: [680, 1060, 640 - (i * 37) % 120, 1180 + ((i * 53) % 200)],
            stroke: i % 3 ? '#ffd166' : '#fff6d8',
            strokeWidth: 2.2, opacity: 0.7, lineCap: 'round'
          }));
        }
        root.add(out.weld);
        return out;
      },
      order: ['tech1', 'tech2', 'kraken', 'hunter'],
      figures: {
        tech1: { variant: 'tech', x: 452, y: 1620, scale: 1.44, pose: 'crouch', emotion: 'fear', palette: PAL.tech },
        tech2: { variant: 'tech', x: 648, y: 1640, scale: 1.38, pose: 'crouch', emotion: 'focus', flip: true, palette: PAL.tech },
        kraken: { x: 236, y: 1430, scale: 1.34, pose: 'stand', emotion: 'smirk', flip: true, palette: PAL.kraken },
        hunter: { x: 962, y: 1552, scale: 1.74, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ТЕХНИК', kind: 'speech', text: 'Ещё миллиметр — и нас сложит, как банку.' },
        { slot: 'TR1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Не сложит. Она держит.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты уверен?' },
        { slot: 'BR1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Я с ней разговариваю. Она держит.' }
      ]
    });
    lift(s, 56);
    s.tick = function (t) {
      if (s.nodes.weld) s.nodes.weld.opacity(0.45 + Math.abs(Math.sin(t / 90)) * 0.55);
    };
    return s;
  });

  /* =============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 9, tone: 'steel', accent: '#ff7a2f',
      title: 'Сорок человек', place: 'Общий сбор',
      set: function (root, p) { return Cine.setCanteen(root, p); },
      order: ['kraken', 'hunter', 'nullar'],
      figures: {
        kraken: { x: 250, y: 1560, scale: 1.34, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.kraken },
        hunter: { x: 604, y: 1432, scale: 1.52, pose: 'stand', emotion: 'shout', palette: PAL.hunter },
        nullar: { x: 968, y: 1584, scale: 1.3, pose: 'stand', emotion: 'smirk', palette: PAL.nullar }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'С завтрашнего дня образец — под моей ответственностью. Не под вашей, Нуллар. Под моей.' },
        { slot: 'TR1', who: 'НУЛЛАР', kind: 'speech', text: 'Это нарушение протокола.' },
        { slot: 'TL2', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Протокол писали в кабинете с окном. Здесь окна нет.' }
      ]
    });
    // стул под Хантером: он говорит, стоя на стуле
    const chair = new (K().Group)();
    chair.add(new (K().Path)({
      data: 'M520 1560 L688 1560 L676 1600 L532 1600 Z',
      fill: '#16262c', stroke: '#0a1418', strokeWidth: 2.4
    }));
    chair.add(new (K().Path)({
      data: 'M534 1600 L548 1690 M674 1600 L660 1690',
      stroke: '#122027', strokeWidth: 7, lineCap: 'round'
    }));
    chair.add(new (K().Path)({
      data: 'M520 1470 L688 1462 L692 1570 L516 1560 Z',
      fill: 'none', stroke: '#0d1a1f', strokeWidth: 3
    }));
    s.root.add(chair);
    chair.moveToBottom();
    lift(s, 52);
    s.tick = function (t) {
      // плафон мигает: свет то есть, то нет
      const k = (Math.sin(t / 700) > 0.92) ? 0.55 : 1;
      s.root.opacity(k);
    };
    return s;
  });

  /* =============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 1, page: 10, tone: 'depth', accent: '#ff3d33',
      title: 'Снаружи стучат', place: 'Ночной коридор',
      set: function (root, p) { return Cine.setNightCorridor(root, p); },
      order: ['hunter'],
      figures: {
        // Хантер замер в дверном проёме — почти силуэт
        hunter: { x: 690, y: 1626, scale: 1.74, pose: 'stand', emotion: 'fear', flip: true, palette: { cloth: '#0b1a20', cloth2: '#071016' } }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Тишина. Потом — глухой удар по корпусу. Не изнутри. Снаружи.' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', text: 'Хантер. Проснитесь.' },
        { slot: 'BR1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Снаружи стучат.' }
      ],
      shadowAlpha: 0.22
    });
    lift(s, 60);
    s.tick = function (t) {
      // удары по корпусу: пыль и дрожь лампы раз в 3 секунды
      const phase = (t % 3000) / 3000;
      if (s.nodes.dust) s.nodes.dust.opacity(phase < 0.12 ? 1 : 0.25);
      if (phase < 0.05) Cine.Shake.kick(10);
      if (s.figures.hunter) s.figures.hunter.group.x(690 + Math.sin(t / 300) * 1.5);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(16);
      Cine.FX.burst(700, 380, { n: 6, dir: Math.PI * 0.5, power: 10, size: 8, up: 3, color: '#2a3a42', edge: '#7f97a0' });
      if (engine && engine.particlesHost) Cine.Particles.sparks(engine.particlesHost, 420, 260, '#cfeff5', 18);
    };
    return s;
  });

})(window);
