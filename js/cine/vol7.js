/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 7 «МНЕМА», страницы 61–70
   Архив знал всё с самого начала.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const PAGES = [];
  const W = 1200, H = 1800;
  Cine.VOL7 = PAGES;

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
      vol: 7, page: 1, title: 'К ядру', place: 'Архив · подход к ядру',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setArchive(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 320, y: 1720, scale: 1.44, pose: 'stand', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 830, y: 1710, scale: 1.62, pose: 'stand', emotion: 'focus', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'В архивном зале всегда на два градуса холоднее, чем в коридоре.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Ядро не отвечает на запросы. Оно отвечает на присутствие.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Тогда давай присутствовать громче.' }
      ]
    });
    lift(s, 26);
    s.tick = function (t) {
      s.root.opacity(0.97 + Math.abs(Math.sin(t / 2100)) * 0.03);
    };
    return s;
  });

  /* ============================================================== страница 2 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 2, title: 'Архив отвечает', place: 'Архив · колонна Мнемы',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setArchive(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 430, y: 1700, scale: 1.66, pose: 'lean', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 900, y: 1700, scale: 1.46, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Вы пришли раньше, чем я рассчитала.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Мы спешили.' },
        { slot: 'BR1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Зря. У меня было двести лет.' }
      ]
    });
    lift(s, 22);
    // искры памяти бегут по колонне
    const sparks = s.nodes.sparks;
    if (sparks) {
      s.tick = function (t) {
        sparks.children.forEach(function (c, i) {
          c.y(430 + ((i * 137 + t * (0.06 + (i % 3) * 0.02)) % 1080));
          c.opacity(0.45 + Math.abs(Math.sin(t / 900 + i)) * 0.5);
        });
      };
    }
    return s;
  });

  /* ============================================================== страница 3 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 3, title: 'Такого языка нет', place: 'Архив · стена записей',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setMemoryWall(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 250, y: 1720, scale: 1.54, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 960, y: 1710, scale: 1.46, pose: 'lean', emotion: 'focus', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Это не язык. В нём нет повторяющихся знаков.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Тогда что это?' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'Инструкция. И она написана не для нас.' }
      ]
    });
    lift(s, 18);
    // скан ползёт по стене
    const scan = s.nodes.scan;
    if (scan) {
      s.tick = function (t) {
        scan.y(80 + Math.abs(Math.sin(t / 2600)) * 900);
      };
    }
    return s;
  });

  /* ============================================================== страница 4 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 4, title: 'Носитель', place: 'Архив · стена записей',
      tone: 'depth', accent: '#8affd6',
      set: function (root, p) { return Cine.setMemoryWall(root, p); },
      order: ['wei', 'hunter'],
      figures: {
        wei: { variant: 'doctor', x: 340, y: 1720, scale: 1.5, pose: 'stand', emotion: 'focus', palette: PAL.doctor },
        hunter: { x: 900, y: 1720, scale: 1.56, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Метеорит не был камнем. Он был посылкой.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'С дном и крышкой?' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'С адресом. И адрес — координаты станции.' }
      ]
    });
    lift(s, 20);
    return s;
  });

  /* ============================================================== страница 5 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 5, title: 'Не авария', place: 'Архив · стена записей',
      tone: 'alarm', accent: '#ff9a5c',
      set: function (root, p) { return Cine.setMemoryWall(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 380, y: 1710, scale: 1.62, pose: 'stand', emotion: 'angry', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 880, y: 1720, scale: 1.46, pose: 'crouch', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Взрыв не был аварией. Он был запуском.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Восемьдесят человек погибли.' },
        { slot: 'BR1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Восемьдесят три. Я считала каждого.' }
      ]
    });
    lift(s, 16);
    s.tick = function (t) {
      s.root.opacity(0.95 + Math.abs(Math.sin(t / 700)) * 0.05);
    };
    return s;
  });

  /* ============================================================== страница 6 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 6, title: 'Заваренная дверь', place: 'Ярус 6 · переборка 12',
      tone: 'steel', accent: '#ffd166',
      set: function (root, p) { return Cine.setSealedBulkhead(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 300, y: 1740, scale: 1.5, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 930, y: 1740, scale: 1.4, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ВЭЙ', kind: 'speech', text: 'Эту дверь заварили изнутри.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'Значит, снаружи её никто не открывал.' },
        { slot: 'BR1', who: 'ВЭЙ', kind: 'speech', accent: true, text: 'И значит, кто-то остался за ней.' }
      ]
    });
    lift(s, 12);
    s.tick = function (t) {
      const cut = s.nodes.cut;
      if (!cut) return;
      cut.opacity(0.86 + Math.abs(Math.sin(t / 260)) * 0.14);
    };
    return s;
  });

  /* ============================================================== страница 7 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 7, title: 'Запись', place: 'Архив · стена записей',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setMemoryWall(root, p); },
      order: ['hunter'],
      figures: {
        hunter: { x: 640, y: 1740, scale: 1.6, pose: 'stand', emotion: 'fear', palette: PAL.hunter }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Четвёртый экран. Смотрите внимательно.' },
        { slot: 'BL1', kind: 'narration', text: 'С экрана смотрел Хантер. Тот же шрам, тот же поворот головы.' }
      ]
    });
    lift(s, 10);
    // таймкод записи
    const code = new (K().Group)();
    const bar = new (K().Path)({
      data: 'M700 470 L1050 466 L1050 500 L700 504 Z',
      fill: 'rgba(255,122,92,0.22)', stroke: 'rgba(255,122,92,0.6)', strokeWidth: 2
    });
    code.add(bar);
    for (let i = 0; i < 3; i++) {
      code.add(new (K().Line)({
        points: [716 + i * 26, 487, 730 + i * 26, 487],
        stroke: '#ffd0c0', strokeWidth: 6, lineCap: 'round'
      }));
    }
    s.fxFront.add(code);
    s.tick = function (t) {
      bar.opacity(Math.sin(t / 520) > 0 ? 0.85 : 0.35);
    };
    return s;
  });

  /* ============================================================== страница 8 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 8, title: 'Час до взрыва', place: 'Архив · запись',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setMemoryWall(root, p); },
      order: ['wei'],
      figures: {
        wei: { variant: 'doctor', x: 1010, y: 1760, scale: 1.42, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', kind: 'narration', text: 'За час до взрыва Хантер стоял у этого же экрана и улыбался.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Это не вы. Это кто-то с вашим лицом.' },
        { slot: 'BR1', who: 'ХАНТЕР', kind: 'speech', accent: true, text: 'Это моя куртка. И мой шрам.' }
      ]
    });
    lift(s, 8);
    // крупное лицо на экране — из путей (вписано в четвёртый экран)
    const face = new (K().Group)({ opacity: 0.72 });
    const cx = 244, cy = 806;
    const F = new (K().Group)({ x: cx, y: cy, scaleX: 0.62, scaleY: 0.62 });
    F.add(new (K().Path)({
      data: 'M0 -210 C138 -210 190 -60 162 40 C140 140 78 214 0 214 C-78 214 -140 140 -162 40 C-190 -60 -138 -210 0 -210 Z',
      fill: 'rgba(190,240,255,0.10)', stroke: 'rgba(190,240,255,0.40)', strokeWidth: 6
    }));
    [-1, 1].forEach(function (sgn) {
      F.add(new (K().Path)({
        data: 'M' + (sgn * 34) + ' -46 C' + (sgn * 76) + ' -70 ' + (sgn * 96) + ' -40 ' + (sgn * 88) + ' -12 C' + (sgn * 78) + ' 18 ' + (sgn * 40) + ' 16 ' + (sgn * 30) + ' -12 Z',
        fill: 'rgba(230,255,255,0.42)'
      }));
      F.add(new (K().Circle)({ x: sgn * 58, y: -24, radius: 13, fill: '#05202a' }));
    });
    F.add(new (K().Path)({
      data: 'M-46 96 C-20 124 20 124 46 96',
      stroke: 'rgba(230,255,255,0.5)', strokeWidth: 8, lineCap: 'round', fillEnabled: false
    }));
    // шрам
    F.add(new (K().Path)({
      data: 'M96 30 L132 96',
      stroke: 'rgba(255,190,170,0.55)', strokeWidth: 7, fillEnabled: false
    }));
    face.add(F);
    // строчная развёртка и помехи поверх лица
    for (let i = 0; i < 14; i++) {
      face.add(new (K().Path)({
        data: 'M74 ' + (648 + i * 26) + ' L414 ' + (646 + i * 26),
        stroke: 'rgba(157,246,255,0.09)', strokeWidth: 8
      }));
    }
    for (let i = 0; i < 5; i++) {
      face.add(new (K().Path)({
        data: 'M' + (80 + (i * 61) % 220) + ' ' + (700 + i * 54) + ' L' + (240 + (i * 41) % 160) + ' ' + (698 + i * 54),
        stroke: 'rgba(255,255,255,0.10)', strokeWidth: 3
      }));
    }
    s.fxBack.add(face);
    s.tick = function (t) {
      face.children.forEach(function (c, i) {
        if (i % 9 === 0) c.opacity(0.82 + Math.abs(Math.sin(t / 400 + i)) * 0.18);
      });
    };
    return s;
  });

  /* ============================================================== страница 9 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 9, title: 'Я этого не помню', place: 'Архив · стена записей',
      tone: 'violet', accent: '#c6a8ff',
      set: function (root, p) { return Cine.setMemoryWall(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 380, y: 1720, scale: 1.66, pose: 'hit', emotion: 'pain', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 900, y: 1720, scale: 1.46, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'ХАНТЕР', kind: 'speech', text: 'Я этого не помню.' },
        { slot: 'BL1', who: 'ВЭЙ', kind: 'speech', text: 'Вы были в списке. Первым.' },
        { slot: 'BR1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Память можно снять. Совесть — нет.' }
      ]
    });
    lift(s, 14);
    s.tick = function (t) {
      s.root.opacity(0.95 + Math.abs(Math.sin(t / 1500)) * 0.05);
    };
    return s;
  });

  /* ============================================================== страница 10 */
  PAGES.push(function () {
    const s = Cine.scene({
      vol: 7, page: 10, title: 'Ядро просит', place: 'Архив · ядро Мнемы',
      tone: 'depth', accent: '#9df6ff',
      set: function (root, p) { return Cine.setCoreRoom(root, p); },
      order: ['hunter', 'wei'],
      figures: {
        hunter: { x: 340, y: 1760, scale: 1.5, pose: 'stand', emotion: 'focus', palette: PAL.hunter },
        wei: { variant: 'doctor', x: 930, y: 1760, scale: 1.4, pose: 'stand', emotion: 'fear', flip: true, palette: PAL.doctor }
      },
      bubbles: [
        { slot: 'TL1', who: 'МНЕМА', kind: 'speech', text: 'Хантер. У меня к вам просьба.' },
        { slot: 'BL1', who: 'ХАНТЕР', kind: 'speech', text: 'У тебя двести лет и весь архив. Чего тебе не хватает?' },
        { slot: 'BR1', who: 'МНЕМА', kind: 'speech', accent: true, text: 'Свидетеля. Живого.' }
      ]
    });
    lift(s, 20);
    const sparks = s.nodes.sparks;
    if (sparks) {
      s.tick = function (t) {
        sparks.children.forEach(function (c, i) {
          c.y(300 + ((i * 137 + t * 0.05) % 1180));
        });
      };
    }
    return s;
  });
})(window);
