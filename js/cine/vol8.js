/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 8 «КРИОКАМЕРА», страницы 71–80
   На станции есть человек, который старше станции.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  const W = 1200, H = 1800;
  Cine.VOL8 = PAGES;

  const PAL = {
    hunter: { cloth: '#1b2b32', cloth2: '#121b20' },
    doctor: { cloth: '#c9d6d9', cloth2: '#9fb2b8' },
    nullar: { cloth: '#241d38', cloth2: '#141026' },
    guard: { cloth: '#2f3a40', cloth2: '#1a2328' },
    kraken: { cloth: '#3a3f33', cloth2: '#24271f' },
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
      vol: 8, page: 1, title: 'Отсек F', place: 'Ярус −2 · отсек F',
      tone: 'steel', accent: '#8affd6',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 250, y: 1760, scale: 1.44, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 950, y: 1760, scale: 1.4, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Отсек F был вычеркнут из всех планов станции.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Здесь минус двенадцать. И здесь что-то работает.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Тогда выключим.' }
      ]
    });
    lift(s, 18);
    const mist = s.nodes.mist;
    if (mist) {
      s.tick = function (t) {
        mist.children.forEach(function (c, i) {
          c.opacity(0.5 + Math.abs(Math.sin(t / 2400 + i * 0.8)) * 0.5);
        });
      };
    }
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 2, title: 'Иней', place: 'Отсек F · у камеры',
      tone: 'steel', accent: '#8affd6',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 300, y: 1760, scale: 1.44, pose: 'crouch', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 900, y: 1750, scale: 1.5, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Наледь наросла изнутри. Это не конденсат.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Дышит?' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Считает. Раз в двенадцать секунд.' }
      ]
    });
    lift(s, 16);
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 3, title: 'Стекло', place: 'Отсек F · стекло камеры',
      tone: 'steel', accent: '#8affd6',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 210, y: 1770, scale: 1.36, pose: 'stand', emotion: 'fear', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 990, y: 1770, scale: 1.32, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'За стеклом стоял человек. Не мутант, не тварь — человек.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Скажи мне, что это не Кракентаус.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Это Кракентаус.' }
      ]
    });
    lift(s, 12);
    // внутри камеры — силуэт человека (Path) и переднее стекло поверх
    const man = new (K().Group)();
    man.add(new (K().Path)({
      data: 'M600 660 C646 660 672 694 668 736 C665 772 646 800 600 800 C554 800 535 772 532 736 C528 694 554 660 600 660 Z',
      fill: 'rgba(220,245,255,0.20)', stroke: 'rgba(220,245,255,0.36)', strokeWidth: 2
    }));
    man.add(new (K().Path)({
      data: 'M600 806 C556 806 524 830 512 862 L466 900 C448 916 442 946 452 976 L482 1452 L718 1452 L748 976 C758 946 752 916 734 900 L688 862 C676 830 644 806 600 806 Z',
      fill: 'rgba(200,235,250,0.12)', stroke: 'rgba(200,235,250,0.26)', strokeWidth: 2
    }));
    // руки вдоль тела
    [-1, 1].forEach(function (sgn) {
      man.add(new (K().Path)({
        data: 'M' + (600 + sgn * 96) + ' 930 C' + (600 + sgn * 126) + ' 1030 ' + (600 + sgn * 124) + ' 1180 ' + (600 + sgn * 108) + ' 1300',
        stroke: 'rgba(200,235,250,0.22)', strokeWidth: 22, lineCap: 'round', fillEnabled: false
      }));
    });
    man.add(new (K().Path)({
      data: 'M600 780 L600 1450',
      stroke: 'rgba(220,250,255,0.12)', strokeWidth: 2, fillEnabled: false
    }));
    s.fxBack.add(man);
    s.frame.add(Cine.cryoPodFront({}));
    s.tick = function (t) {
      man.opacity(0.9 + Math.abs(Math.sin(t / 3000)) * 0.1);
    };
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 4, title: 'Биометрия', place: 'Отсек F · терминал',
      tone: 'steel', accent: '#8affd6',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 340, y: 1750, scale: 1.44, pose: 'stand', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 880, y: 1760, scale: 1.48, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Камера занята сто девятнадцать лет.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Станции сорок.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Вот именно.' }
      ]
    });
    lift(s, 20);
    // голограмма-панель с цифрами (штрихи вместо текста)
    const panel = new (K().Group)();
    panel.add(new (K().Path)({
      data: 'M420 560 L780 548 L780 760 L420 772 Z',
      fill: 'rgba(10,40,52,0.55)', stroke: 'rgba(157,246,255,0.35)', strokeWidth: 2
    }));
    for (let i = 0; i < 5; i++) {
      panel.add(new (K().Line)({
        points: [448, 600 + i * 32, 448 + 90 + (i * 47) % 180, 598 + i * 32],
        stroke: i === 0 ? '#8affd6' : 'rgba(157,246,255,0.4)', strokeWidth: i === 0 ? 7 : 4, lineCap: 'round'
      }));
    }
    s.fxFront.add(panel);
    s.tick = function (t) {
      panel.opacity(0.86 + Math.abs(Math.sin(t / 700)) * 0.14);
    };
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 5, title: 'Он не один', place: 'Отсек F · у камеры',
      tone: 'violet', accent: '#c6a8ff',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['nullar', 'hunter'],
      figures: {
        nullar: { x: 360, y: 1740, scale: 1.72, pose: 'stand', emotion: 'smirk', palette: PAL.nullar },
        hunter: { x: 930, y: 1750, scale: 1.5, pose: 'stand', emotion: 'angry', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'НУЛЛАР', kind: 'speech', text: 'Не трогай камеру, Хантер.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты знал, что он здесь.' },
        { slot: 'BR1', who: 'НУЛЛАР', kind: 'speech', accent: true, text: 'Я знал, что здесь кто-то есть. Это разные вещи.' }
      ]
    });
    lift(s, 18);
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 6, title: 'Двойник', place: 'Отсек F · проход',
      tone: 'violet', accent: '#c6a8ff',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['kraken', 'hunter'],
      figures: {
        kraken: { x: 330, y: 1740, scale: 1.6, pose: 'stand', emotion: 'smirk', palette: PAL.kraken },
        hunter: { x: 900, y: 1750, scale: 1.5, pose: 'aim', emotion: 'angry', rifle: true, aimAngle: 0.02, flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Опусти ствол, начальник охраны.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Ты стоишь там же, где стоял час назад.' },
        { slot: 'BR1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Я стою там же, где стоял сто лет.' }
      ]
    });
    lift(s, 14);
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 7, title: 'Который из них', place: 'Отсек F · между ними',
      tone: 'violet', accent: '#ff5a8f',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['kraken', 'wei', 'hunter'],
      figures: {
        kraken: { x: 190, y: 1750, scale: 1.44, pose: 'stand', emotion: 'neutral', palette: PAL.kraken },
        wei: { variant: 'doctor', x: 960, y: 1750, scale: 1.4, pose: 'guard', emotion: 'fear', flip: true, palette: PAL.doctor },
        hunter: { x: 600, y: 1770, scale: 1.44, pose: 'stand', emotion: 'fear', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Один из вас — копия.' },
        { slot: 'BL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Оба.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Тогда где оригинал?' }
      ]
    });
    lift(s, 10);
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 8, title: 'Двести лет', place: 'Отсек F · стекло',
      tone: 'steel', accent: '#8affd6',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['wei', 'kraken'],
      figures: {
        wei: { variant: 'doctor', x: 280, y: 1770, scale: 1.38, pose: 'stand', emotion: 'focus', palette: PAL.doctor },
        kraken: { x: 950, y: 1760, scale: 1.46, pose: 'lean', emotion: 'focus', flip: true, palette: PAL.kraken }
      },
      bubbles: [
        { slot: 'TL1', who: 'КРАКЕНТАУС', kind: 'speech', text: 'Меня зовут Кракентаус. Это всё, что я помню точно.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Вы помните запуск?' },
        { slot: 'BR1', who: 'КРАКЕНТАУС', kind: 'speech', accent: true, text: 'Я был запуском.' }
      ]
    });
    lift(s, 14);
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 9, title: 'Двойник просыпается', place: 'Отсек F · проход',
      tone: 'alarm', accent: '#ff4a3a',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['kraken', 'hunter', 'wei'],
      figures: {
        kraken: { x: 340, y: 1740, scale: 1.66, pose: 'hit', emotion: 'pain', palette: PAL.kraken },
        hunter: { x: 760, y: 1760, scale: 1.46, pose: 'guard', emotion: 'angry', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 1030, y: 1770, scale: 1.34, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'Двойник упал раньше, чем прозвучал сигнал.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'У него остановилось сердце. У нас на глазах.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Значит, копии не живут без команды.' }
      ]
    });
    lift(s, 8);
    s.tick = function (t) {
      s.root.opacity(0.92 + Math.abs(Math.sin(t / 420)) * 0.08);
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 8, page: 10, title: 'Он открыл глаза', place: 'Отсек F · камера',
      tone: 'alarm', accent: '#ff4a3a',
      set: function (root, p) { return Cine.setCryoBay(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 230, y: 1770, scale: 1.36, pose: 'stand', emotion: 'fear', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 970, y: 1770, scale: 1.34, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'В камере открылись глаза. Одновременно — за стеклом и в проходе.' },
        { slot: 'BL1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Теперь их двое. Как и было задумано.' }
      ]
    });
    lift(s, 6);
    // в камере — голова и раскрытые глаза
    const face = new (K().Group)();
    // тело в камере (без головы — голова отдельно, чтобы управлять глазами)
    face.add(new (K().Path)({
      data: 'M600 890 C556 890 524 912 512 944 L466 982 C448 998 442 1028 452 1058 L482 1452 L718 1452 L748 1058 C758 1028 752 998 734 982 L688 944 C676 912 644 890 600 890 Z',
      fill: 'rgba(200,235,250,0.12)', stroke: 'rgba(200,235,250,0.26)', strokeWidth: 2
    }));
    [-1, 1].forEach(function (sgn) {
      face.add(new (K().Path)({
        data: 'M' + (600 + sgn * 96) + ' 1010 C' + (600 + sgn * 126) + ' 1100 ' + (600 + sgn * 124) + ' 1240 ' + (600 + sgn * 108) + ' 1340',
        stroke: 'rgba(200,235,250,0.2)', strokeWidth: 20, lineCap: 'round', fillEnabled: false
      }));
    });
    // голова — крупнее, чтобы глаза читались в листе
    const head = new (K().Group)({ scaleX: 0.72, scaleY: 0.72 });
    head.add(new (K().Path)({
      data: 'M0 -96 C58 -96 82 -50 78 4 C74 54 42 92 0 92 C-42 92 -74 54 -78 4 C-82 -50 -58 -96 0 -96 Z',
      fill: 'rgba(210,238,250,0.24)', stroke: 'rgba(214,244,255,0.5)', strokeWidth: 3
    }));
    [-1, 1].forEach(function (sgn) {
      head.add(new (K().Path)({
        data: 'M' + (sgn * 12) + ' -10 C' + (sgn * 34) + ' -26 ' + (sgn * 50) + ' -6 ' + (sgn * 44) + ' 12 C' + (sgn * 38) + ' 30 ' + (sgn * 14) + ' 26 ' + (sgn * 10) + ' 8 Z',
        fill: 'rgba(255,246,232,0.92)'
      }));
      head.add(new (K().Circle)({ x: sgn * 28, y: 4, radius: 8, fill: '#0d1a16' }));
      head.add(new (K().Circle)({ x: sgn * 28 + 3, y: 1, radius: 2.6, fill: '#dff7ff', opacity: 0.8 }));
    });
    head.add(new (K().Path)({
      data: 'M-16 52 C-6 60 6 60 16 52',
      stroke: 'rgba(255,246,232,0.6)', strokeWidth: 4, lineCap: 'round', fillEnabled: false
    }));
    head.x(600); head.y(804);
    face.add(head);
    s.fxBack.add(face);
    s.frame.add(Cine.cryoPodFront({}));
    // тревожная подсветка камеры
    const glow = new (K().Path)({
      data: 'M330 1470 L372 512 C382 372 486 306 600 306 C714 306 818 372 828 512 L870 1470 Z',
      fill: 'rgba(255,90,70,0.10)'
    });
    s.frame.add(glow);
    s.tick = function (t) {
      glow.opacity(0.4 + Math.abs(Math.sin(t / 480)) * 0.6);
    };
    s.fire = function (engine) {
      Cine.Shake.kick(16);
      if (engine && engine.particlesHost) Cine.Particles.embers(engine.particlesHost, 600, 1000);
    };
    return s;
  });
})(window);
