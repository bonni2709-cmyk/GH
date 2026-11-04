/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  декорации
   Каждый сет рисуется только путями Konva (Path / Line / Circle / Ellipse),
   вода и «рваность» — на simplex-noise, свет — на chroma-градиентах.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }
  function ch() { return global.chroma; }
  function Simplex() { return global.SimplexNoise; }
  const W = 1200, H = 1800;
  function r(v) { return Math.round(v * 100) / 100; }

  /* --------------------------------------------------------- 1. открытая вода */
  Cine.setOpenWater = function (root, p) {
    const SimplexLib = Simplex();
    const n = new SimplexLib(301);
    const g = new (K().Group)();
    root.add(g);

    // вертикальный градиент толщи воды
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [
        0, ch()(p.bgDeep).darken(2.2).hex(),
        0.42, ch()(p.bg).hex(),
        0.66, ch()(p.depth[1]).hex(),
        1, ch()(p.bg).darken(3).hex()
      ]
    }));

    // столбы света сверху
    for (let i = 0; i < 5; i++) {
      const x0 = 90 + i * 250 + n.noise2D(i, 1) * 40;
      g.add(new (K().Path)({
        data: 'M' + r(x0) + ' -120 L' + r(x0 + 70) + ' -120 L' + r(x0 + 300) + ' 900 L' + r(x0 + 120) + ' 900 Z',
        fillLinearGradientStartPoint: { x: 0, y: -120 },
        fillLinearGradientEndPoint: { x: 0, y: 900 },
        fillLinearGradientColorStops: [0, ch()(p.light).alpha(0.1).css(), 1, ch()(p.light).alpha(0).css()]
      }));
    }

    // взвесь: планктон и мусор
    for (let i = 0; i < 260; i++) {
      const x = (n.noise2D(i * 1.7, 0.3) * 0.5 + 0.5) * W;
      const y = ((i * 37) % 100) / 100 * H;
      const rr = 0.8 + ((i * 13) % 10) / 6;
      g.add(new (K().Circle)({
        x: r(x), y: r(y), radius: r(rr),
        fill: i % 7 ? p.light : p.warm,
        opacity: 0.06 + ((i * 29) % 10) / 90
      }));
    }

    // склон впадины слева и справа — рама кадра
    g.add(new (K().Path)({
      data: 'M-200 400 C60 620 140 900 60 1200 C20 1380 -40 1500 -60 1700 L-200 1700 Z',
      fill: '#02080b', opacity: 0.9
    }));
    g.add(new (K().Path)({
      data: 'M' + (W + 200) + ' 320 C980 560 900 860 980 1160 C1020 1360 1090 1500 1110 1700 L' + (W + 200) + ' 1700 Z',
      fill: '#02080b', opacity: 0.9
    }));

    // ближний аппарат: кольцо света и трос
    const sub = new (K().Group)({ x: 600, y: 520, scaleX: 1.7, scaleY: 1.7 });
    sub.add(new (K().Line)({ points: [0, -520, 0, -140], stroke: p.shadow, strokeWidth: 3, opacity: 0.5 }));
    sub.add(new (K().Path)({
      data: 'M-42 -130 C-42 -168 42 -168 42 -130 L30 -96 L-30 -96 Z',
      fill: '#0a1418', stroke: p.light, strokeWidth: 1.6, opacity: 0.9
    }));
    sub.add(new (K().Ellipse)({
      x: 0, y: -96, radiusX: 46, radiusY: 12, fill: p.warm, opacity: 0.5,
      shadowColor: p.light, shadowBlur: 40
    }));
    g.add(sub);

    // дно: станция искрой
    g.add(new (K().Ellipse)({
      x: 600, y: 1500, radiusX: 210, radiusY: 26,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 210,
      fillRadialGradientColorStops: [0, ch()(p.accent).alpha(0.3).css(), 1, ch()(p.accent).alpha(0).css()]
    }));
    for (let i = 0; i < 9; i++) {
      g.add(new (K().Path)({
        data: 'M' + (505 + i * 12) + ' 1494 L' + (512 + i * 12) + ' 1466 L' + (528 + i * 12) + ' 1464 L' + (536 + i * 12) + ' 1494 Z',
        fill: i % 2 ? '#0d1b22' : '#122530', stroke: p.accent, strokeWidth: 1, opacity: 0.9
      }));
      // ореол вокруг каждого окна станции
      g.add(new (K().Circle)({
        x: 512 + i * 12, y: 1480, radius: 16,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 16,
        fillRadialGradientColorStops: [0, ch()(p.accent).alpha(0.5).css(), 1, ch()(p.accent).alpha(0).css()]
      }));
    }
    // вмятина на корпусе
    g.add(new (K().Path)({
      data: 'M700 1480 C726 1462 758 1470 764 1488 C742 1492 716 1494 700 1480 Z',
      fill: '#060d11', stroke: p.warm, strokeWidth: 1.2, opacity: 0.7
    }));
    return { sub: sub };
  };

  /* --------------------------------------------------------- 2. шлюзовой отсек */
  Cine.setAirlock = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    // стены-«гармошки»
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, p.depth[0], 0.5, p.depth[1], 1, p.depth[2]]
    }));
    for (let i = 0; i < 7; i++) {
      const y0 = 200 + i * 210;
      g.add(new (K().Path)({
        data: 'M-100 ' + y0 + ' Q300 ' + (y0 - 70) + ' 600 ' + (y0 + 20) + ' Q900 ' + (y0 + 100) + ' ' + (W + 100) + ' ' + (y0 + 10),
        stroke: i % 2 ? p.light : p.ink, strokeWidth: i % 2 ? 2 : 9, opacity: i % 2 ? 0.14 : 0.5
      }));
    }
    // круглый люк: обод, болты, штурвал, свет из щели
    g.add(new (K().Circle)({
      x: 600, y: 520, radius: 214,
      fill: '#071014', stroke: '#1b3540', strokeWidth: 10, opacity: 1
    }));
    g.add(new (K().Circle)({
      x: 600, y: 520, radius: 190,
      fill: '#03080b', stroke: '#0d2028', strokeWidth: 4
    }));
    // тёплый свет из-под обода
    g.add(new (K().Circle)({
      x: 600, y: 520, radius: 190,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 190,
      fillRadialGradientColorStops: [0, 'rgba(255,150,90,0.16)', 0.7, 'rgba(255,150,90,0.05)', 1, 'rgba(255,150,90,0)']
    }));
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.add(new (K().Circle)({
        x: 600 + Math.cos(a) * 202, y: 520 + Math.sin(a) * 202,
        radius: 6.5, fill: '#2b4a55', stroke: '#0a171c', strokeWidth: 1.5
      }));
    }
    // штурвал
    g.add(new (K().Circle)({ x: 600, y: 520, radius: 84, stroke: p.warm, strokeWidth: 5, opacity: 0.35 }));
    g.add(new (K().Circle)({ x: 600, y: 520, radius: 22, fill: '#12242b', stroke: p.warm, strokeWidth: 3, opacity: 0.6 }));
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.3;
      g.add(new (K().Line)({
        points: [600 + Math.cos(a) * 22, 520 + Math.sin(a) * 22, 600 + Math.cos(a) * 84, 520 + Math.sin(a) * 84],
        stroke: p.warm, strokeWidth: 4, opacity: 0.35, lineCap: 'round'
      }));
    }
    // индикатор давления
    g.add(new (K().Path)({
      data: 'M980 700 L1050 700 L1050 748 L980 748 Z',
      fill: '#0a171c', stroke: p.accent, strokeWidth: 2, opacity: 0.8
    }));
    g.add(new (K().Circle)({ x: 1000, y: 724, radius: 5, fill: p.accent, opacity: 0.9 }));
    // пол с решёткой
    g.add(new (K().Path)({
      data: 'M-200 1180 L' + (W + 200) + ' 1180 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1180 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, p.floor, 1, p.bgDeep]
    }));
    for (let i = -6; i <= 6; i++) {
      g.add(new (K().Line)({
        points: [600 + i * 40, 1180, 600 + i * 190, H + 100],
        stroke: p.ink, strokeWidth: 3, opacity: 0.4
      }));
    }
    g.add(new (K().Line)({ points: [-50, 1180, W + 50, 1180], stroke: p.light, strokeWidth: 4, opacity: 0.28 }));
    // конденсат
    const SimplexLib = Simplex();
    const n = new SimplexLib(77);
    for (let i = 0; i < 40; i++) {
      const x = (n.noise2D(i * 2.1, 3) * 0.5 + 0.5) * W;
      const y = 120 + ((i * 53) % 900);
      g.add(new (K().Line)({
        points: [r(x), r(y), r(x + 2), r(y + 26)],
        stroke: p.light, strokeWidth: 1.4, opacity: 0.18, lineCap: 'round'
      }));
    }
    return {};
  };

  /* --------------------------------------------------------- 3. реакторный зал */
  Cine.setReactor = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, ch()(p.bg).darken(1.6).hex(), 0.45, p.bg, 1, p.bgDeep]
    }));
    // смотровое окно с водой: рама, толща, блики
    g.add(new (K().Path)({
      data: 'M96 226 L440 186 L440 796 L96 836 Z',
      fill: '#071820', stroke: '#153741', strokeWidth: 10
    }));
    g.add(new (K().Path)({
      data: 'M120 250 L416 214 L416 770 L120 806 Z',
      fillLinearGradientStartPoint: { x: 120, y: 214 },
      fillLinearGradientEndPoint: { x: 416, y: 806 },
      fillLinearGradientColorStops: [0, 'rgba(28,96,118,0.55)', 0.5, 'rgba(10,44,58,0.7)', 1, 'rgba(3,14,20,0.9)']
    }));
    // муть и глубина
    g.add(new (K().Path)({
      data: 'M140 300 C200 340 260 300 320 380 C370 440 300 500 240 520 C180 540 160 620 220 700 C280 760 360 720 400 760',
      stroke: p.light, strokeWidth: 6, opacity: 0.22, lineCap: 'round'
    }));
    for (let i = 0; i < 5; i++) {
      g.add(new (K().Path)({
        data: 'M' + (132 + i * 6) + ' ' + (300 + i * 96) + ' L' + (404 - i * 4) + ' ' + (268 + i * 96),
        stroke: 'rgba(157,246,255,0.12)', strokeWidth: 18 - i * 2, lineCap: 'round'
      }));
    }
    // крепления рамы
    for (let i = 0; i < 6; i++) {
      const yy = 250 + i * 106;
      g.add(new (K().Line)({ points: [96, yy, 126, yy - 3], stroke: '#1f4a56', strokeWidth: 5, opacity: 0.9 }));
      g.add(new (K().Line)({ points: [412, yy - 34, 442, yy - 37], stroke: '#1f4a56', strokeWidth: 5, opacity: 0.9 }));
    }
    // корпус реактора: колонна
    const rx = 760;
    g.add(new (K().Path)({
      data: 'M' + (rx - 190) + ' 300 C' + (rx - 210) + ' 700 ' + (rx - 200) + ' 1100 ' + (rx - 170) + ' 1500 L' + (rx + 170) + ' 1500 C' + (rx + 200) + ' 1100 ' + (rx + 210) + ' 700 ' + (rx + 190) + ' 300 Z',
      fillLinearGradientStartPoint: { x: rx - 200, y: 0 },
      fillLinearGradientEndPoint: { x: rx + 200, y: 0 },
      fillLinearGradientColorStops: [0, '#12242c', 0.42, '#24505c', 0.58, '#2f6673', 1, '#0d1c22'],
      stroke: p.ink, strokeWidth: 4
    }));
    // кольца
    for (let i = 0; i < 6; i++) {
      const y = 420 + i * 180;
      g.add(new (K().Ellipse)({
        x: rx, y: y, radiusX: 186, radiusY: 34,
        stroke: 'rgba(157,246,255,0.18)', strokeWidth: 2
      }));
      g.add(new (K().Ellipse)({
        x: rx, y: y + 8, radiusX: 188, radiusY: 34,
        stroke: 'rgba(2,8,10,0.55)', strokeWidth: 7
      }));
    }
    // вертикальный блик по корпусу — читается цилиндр, а не «стопка колец»
    g.add(new (K().Path)({
      data: 'M' + (rx - 90) + ' 320 C' + (rx - 104) + ' 720 ' + (rx - 96) + ' 1120 ' + (rx - 76) + ' 1480',
      stroke: 'rgba(180,240,255,0.20)', strokeWidth: 26, lineCap: 'round'
    }));
    g.add(new (K().Path)({
      data: 'M' + (rx + 96) + ' 320 C' + (rx + 110) + ' 720 ' + (rx + 102) + ' 1120 ' + (rx + 82) + ' 1480',
      stroke: 'rgba(0,0,0,0.45)', strokeWidth: 34, lineCap: 'round'
    }));
    // биолюминесцентный контур: мягкое свечение у стыков, без «червяков»
    const SimplexLib = Simplex();
    const n = new SimplexLib(913);
    for (let i = 0; i < 3; i++) {
      const yy = 640 + i * 300;
      g.add(new (K().Ellipse)({
        x: rx, y: yy, radiusX: 158 + n.noise2D(i, 1) * 16, radiusY: 12,
        stroke: 'rgba(125,251,208,0.5)', strokeWidth: 3, opacity: 0.55
      }));
    }
    // биологический контур: холодный отсвет на полу у основания
    g.add(new (K().Ellipse)({
      x: rx, y: 1520, radiusX: 300, radiusY: 46,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 300,
      fillRadialGradientColorStops: [0, 'rgba(125,251,208,0.16)', 1, 'rgba(125,251,208,0)']
    }));
    // пульт
    g.add(new (K().Path)({
      data: 'M70 1310 L520 1290 L560 1420 L40 1440 Z',
      fill: '#0a1519', stroke: p.ink, strokeWidth: 3
    }));
    g.add(new (K().Path)({
      data: 'M100 1320 L500 1304 L520 1360 L80 1376 Z',
      fill: '#102026'
    }));
    for (let i = 0; i < 22; i++) {
      const x = 110 + (i % 11) * 36;
      const y = 1330 + Math.floor(i / 11) * 22;
      g.add(new (K().Circle)({
        x: x, y: y, radius: 4.2,
        fill: i % 4 === 0 ? '#ff6b4a' : (i % 3 === 0 ? '#ffd166' : p.light),
        opacity: 0.75
      }));
    }
    // стрелка манометра
    g.add(new (K().Circle)({ x: 990, y: 1330, radius: 62, fill: '#081318', stroke: p.warm, strokeWidth: 2.4 }));
    g.add(new (K().Line)({ points: [990, 1330, 1026, 1294], stroke: '#ff5a3d', strokeWidth: 4, lineCap: 'round' }));
    g.add(new (K().Circle)({ x: 990, y: 1330, radius: 5, fill: p.warm }));
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1120 L' + (W + 200) + ' 1120 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1120 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, p.floor, 0.6, ch()(p.floor).brighten(1.3).hex(), 1, '#04100c']
    }));
    return {};
  };

  /* --------------------------------------------------------- 4. биолаборатория */
  Cine.setLab = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#04161a', 0.5, '#061e24', 1, '#02090c']
    }));
    // кафель
    for (let i = 0; i < 12; i++) {
      g.add(new (K().Line)({ points: [-200, 60 + i * 92, W + 200, 52 + i * 92], stroke: '#0d3038', strokeWidth: 2, opacity: 0.6 }));
    }
    for (let i = -6; i <= 6; i++) {
      g.add(new (K().Line)({ points: [600 + i * 110, -200, 600 + i * 210, 1120], stroke: '#0d3038', strokeWidth: 2, opacity: 0.4 }));
    }
    // контейнер с образцом: стеклянная колонна
    const cx = 800, cy = 900;
    g.add(new (K().Ellipse)({ x: cx, y: 1052, radiusX: 150, radiusY: 26, fill: '#04161a', stroke: '#1d4a52', strokeWidth: 3 }));
    g.add(new (K().Path)({
      data: 'M' + (cx - 128) + ' 1040 L' + (cx - 128) + ' 640 C' + (cx - 128) + ' 596 ' + (cx + 128) + ' 596 ' + (cx + 128) + ' 640 L' + (cx + 128) + ' 1040 Z',
      fill: 'rgba(150,240,255,0.05)',
      stroke: '#7de0ea', strokeWidth: 2.6, opacity: 0.9
    }));
    g.add(new (K().Line)({ points: [cx - 100, 700, cx - 92, 1010], stroke: '#d8ffff', strokeWidth: 4, opacity: 0.14, lineCap: 'round' }));
    // метеорит внутри: неправильный камень с полостью
    g.add(new (K().Path)({
      data: 'M' + (cx - 96) + ' 1006 C' + (cx - 120) + ' 940 ' + (cx - 84) + ' 880 ' + (cx - 18) + ' 872 C' + (cx + 62) + ' 866 ' + (cx + 110) + ' 916 ' + (cx + 96) + ' 986 C' + (cx + 84) + ' 1032 ' + (cx + 10) + ' 1044 ' + (cx - 96) + ' 1006 Z',
      fill: '#1b2226', stroke: '#3c4a4f', strokeWidth: 3
    }));
    g.add(new (K().Path)({
      data: 'M' + (cx - 40) + ' 950 C' + (cx - 20) + ' 918 ' + (cx + 30) + ' 918 ' + (cx + 48) + ' 946 C' + (cx + 40) + ' 984 ' + (cx - 20) + ' 986 ' + (cx - 40) + ' 950 Z',
      fill: '#05080a'
    }));
    // пульсация полости
    const pulse = new (K().Ellipse)({
      x: cx + 4, y: 951, radiusX: 30, radiusY: 20,
      fill: '#8affd6', opacity: 0.18
    });
    g.add(pulse);
    // лабораторный стол с приборами
    g.add(new (K().Path)({
      data: 'M60 1230 L520 1214 L556 1300 L30 1318 Z',
      fill: '#0d1f24', stroke: '#061216', strokeWidth: 3
    }));
    g.add(new (K().Line)({ points: [70, 1236, 512, 1220], stroke: '#7de0ea', strokeWidth: 2.4, opacity: 0.35 }));
    for (let i = 0; i < 4; i++) {
      const bx = 110 + i * 110;
      g.add(new (K().Path)({
        data: 'M' + bx + ' 1215 L' + (bx + 10) + ' 1140 L' + (bx + 58) + ' 1136 L' + (bx + 66) + ' 1212 Z',
        fill: '#10222a', stroke: '#2b5a68', strokeWidth: 1.6, opacity: 0.95
      }));
      g.add(new (K().Line)({ points: [bx + 16, 1180, bx + 52, 1176], stroke: '#8affd6', strokeWidth: 2, opacity: 0.5 }));
    }

    // стеклянная перегородка на переднем плане
    g.add(new (K().Line)({ points: [-40, 1180, W + 40, 1150], stroke: '#7de0ea', strokeWidth: 3, opacity: 0.3 }));
    // стойки и полки с образцами
    for (let s = 0; s < 3; s++) {
      const sx = 90 + s * 200;
      g.add(new (K().Line)({ points: [sx, 1160, sx, 700], stroke: '#12333a', strokeWidth: 8, opacity: 0.9 }));
      for (let k = 0; k < 4; k++) {
        const sy = 760 + k * 110;
        g.add(new (K().Line)({ points: [sx - 52, sy, sx + 52, sy], stroke: '#1b4a52', strokeWidth: 4 }));
        g.add(new (K().Path)({
          data: 'M' + (sx - 26) + ' ' + sy + ' L' + (sx - 20) + ' ' + (sy - 46) + ' L' + (sx + 8) + ' ' + (sy - 42) + ' L' + (sx + 12) + ' ' + sy + ' Z',
          fill: 'rgba(140,255,220,0.10)', stroke: '#54c9b4', strokeWidth: 1.4, opacity: 0.8
        }));
      }
    }
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1120 L' + (W + 200) + ' 1120 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1120 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#06181c', 1, '#01070a']
    }));
    return { pulse: pulse };
  };

  /* --------------------------------------------------------- 5. кают-компания */
  Cine.setMess = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, p.depth[0], 0.55, p.depth[1], 1, p.depth[2]]
    }));
    // длинный стол в перспективе
    g.add(new (K().Path)({
      data: 'M330 1180 L870 1180 L1060 1560 L140 1560 Z',
      fill: '#101b20', stroke: p.ink, strokeWidth: 4
    }));
    g.add(new (K().Path)({
      data: 'M348 1192 L852 1192 L1020 1540 L180 1540 Z',
      fillLinearGradientStartPoint: { x: 600, y: 1180 },
      fillLinearGradientEndPoint: { x: 600, y: 1560 },
      fillLinearGradientColorStops: [0, '#1d2f36', 0.6, '#27414a', 1, '#152630']
    }));
    // блик по кромке
    g.add(new (K().Line)({ points: [352, 1196, 848, 1196], stroke: p.light, strokeWidth: 3, opacity: 0.4 }));
    // лавки
    g.add(new (K().Path)({ data: 'M300 1300 L120 1420 L120 1470 L300 1360 Z', fill: '#0c171c', stroke: p.ink, strokeWidth: 3 }));
    g.add(new (K().Path)({ data: 'M900 1300 L1080 1420 L1080 1470 L900 1360 Z', fill: '#0c171c', stroke: p.ink, strokeWidth: 3 }));
    // подвесной плафон
    g.add(new (K().Line)({ points: [600, -100, 600, 250], stroke: p.shadow, strokeWidth: 4 }));
    g.add(new (K().Path)({
      data: 'M540 250 C540 226 660 226 660 250 L640 268 L560 268 Z',
      fill: '#17262d', stroke: p.ink, strokeWidth: 3
    }));
    g.add(new (K().Ellipse)({
      x: 600, y: 268, radiusX: 46, radiusY: 10, fill: '#fff0c4',
      shadowColor: '#ffd08a', shadowBlur: 70, opacity: 0.95
    }));
    g.add(new (K().Ellipse)({
      x: 600, y: 700, radiusX: 520, radiusY: 620,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 620,
      fillRadialGradientColorStops: [0, ch()('#ffd08a').alpha(0.12).css(), 0.5, ch()('#ffd08a').alpha(0.04).css(), 1, ch()('#ffd08a').alpha(0).css()]
    }));
    // переборка в глубине и второй плафон
    g.add(new (K().Path)({
      data: 'M-200 900 L' + (W + 200) + ' 900 L' + (W + 200) + ' 1120 L-200 1120 Z',
      fill: '#08161b', stroke: '#0b2028', strokeWidth: 2, opacity: 0.9
    }));
    g.add(new (K().Path)({
      data: 'M300 900 L300 700 C360 660 440 660 500 700 L500 900 Z',
      fill: '#050f13', stroke: '#123039', strokeWidth: 2
    }));
    for (let i = 0; i < 3; i++) {
      const lx = 180 + i * 420;
      g.add(new (K().Line)({ points: [lx, 0, lx, 330], stroke: '#0b1a20', strokeWidth: 3 }));
      g.add(new (K().Path)({
        data: 'M' + (lx - 34) + ' 330 C' + (lx - 34) + ' 316 ' + (lx + 34) + ' 316 ' + (lx + 34) + ' 330 L' + (lx + 24) + ' 344 L' + (lx - 24) + ' 344 Z',
        fill: '#16262d', stroke: '#0b1a20', strokeWidth: 2
      }));
      g.add(new (K().Ellipse)({ x: lx, y: 344, radiusX: 24, radiusY: 6, fill: '#ffe6b0', shadowColor: '#ffcf87', shadowBlur: 46, opacity: 0.85 }));
    }

    // стулья у стола
    [ [760, 1450], [452, 1478] ].forEach(function (c0, i) {
      const sx = c0[0], sy = c0[1];
      g.add(new (K().Path)({
        data: 'M' + (sx - 46) + ' ' + sy + ' L' + (sx + 46) + ' ' + (sy - 4) + ' L' + (sx + 52) + ' ' + (sy + 34) + ' L' + (sx - 40) + ' ' + (sy + 38) + ' Z',
        fill: i ? '#0e1e24' : '#122730', stroke: '#08161b', strokeWidth: 2.4
      }));
      g.add(new (K().Path)({
        data: 'M' + (sx - 44) + ' ' + sy + ' L' + (sx - 40) + ' ' + (sy - 96) + ' L' + (sx + 40) + ' ' + (sy - 100) + ' L' + (sx + 42) + ' ' + (sy - 4),
        fill: 'none', stroke: '#0b1c22', strokeWidth: 6, opacity: 0.9
      }));
      g.add(new (K().Path)({
        data: 'M' + (sx - 36) + ' ' + (sy + 36) + ' L' + (sx - 30) + ' ' + (sy + 130) + ' M' + (sx + 34) + ' ' + (sy + 32) + ' L' + (sx + 40) + ' ' + (sy + 126),
        stroke: '#0a171c', strokeWidth: 6, lineCap: 'round'
      }));
    });

    // чашки на столе
    for (let i = 0; i < 3; i++) {
      const x = 420 + i * 150;
      g.add(new (K().Ellipse)({ x: x, y: 1300 - i * 6, radiusX: 24, radiusY: 8, fill: '#0a1418', stroke: p.light, strokeWidth: 1.6, opacity: 0.9 }));
      g.add(new (K().Path)({ data: 'M' + (x - 10) + ' ' + (1296 - i * 6) + ' C' + (x - 4) + ' ' + (1280 - i * 6) + ' ' + (x + 4) + ' ' + (1280 - i * 6) + ' ' + (x + 10) + ' ' + (1296 - i * 6), stroke: '#9fe8f0', strokeWidth: 2, opacity: 0.25 }));
    }
    return {};
  };

  /* --------------------------------------------------------- 6. архивное ядро */
  Cine.setArchive = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#05070f', 0.5, '#080c18', 1, '#03050a']
    }));
    // кабели по стенам
    const SimplexLib = Simplex();
    const n = new SimplexLib(451);
    for (let i = 0; i < 26; i++) {
      const x0 = -40 + i * 50;
      const y0 = -100;
      const wob = n.noise2D(i * 1.7, 2) * 90;
      g.add(new (K().Path)({
        data: 'M' + r(x0) + ' ' + y0 + ' C' + r(x0 + wob) + ' 400 ' + r(x0 - wob) + ' 800 ' + r(x0 + 20) + ' 1200',
        stroke: i % 4 ? '#0d1526' : '#16223a', strokeWidth: 3 + (i % 3) * 2, opacity: 0.9
      }));
      if (i % 5 === 0) {
        g.add(new (K().Path)({
          data: 'M' + r(x0) + ' ' + y0 + ' C' + r(x0 + wob) + ' 400 ' + r(x0 - wob) + ' 800 ' + r(x0 + 20) + ' 1200',
          stroke: p.light, strokeWidth: 1, opacity: 0.12
        }));
      }
    }
    // колонна ядра: три сегмента сферы, сужающиеся кверху
    const cx = 600;
    const segY = [1560, 1240, 980, 720];
    for (let i = 0; i < 3; i++) {
      const yb = segY[i], yt = segY[i + 1] + 18;
      const wb = 168 - i * 26, wt = 148 - i * 26;
      g.add(new (K().Path)({
        data: 'M' + (cx - wb) + ' ' + yb +
          ' C' + (cx - wb - 16) + ' ' + (yb - 90) + ' ' + (cx - wt) + ' ' + (yt + 70) + ' ' + (cx - wt) + ' ' + yt +
          ' C' + (cx - wt * 0.5) + ' ' + (yt - 40) + ' ' + (cx + wt * 0.5) + ' ' + (yt - 40) + ' ' + (cx + wt) + ' ' + yt +
          ' C' + (cx + wt) + ' ' + (yt + 70) + ' ' + (cx + wb + 16) + ' ' + (yb - 90) + ' ' + (cx + wb) + ' ' + yb + ' Z',
        fillLinearGradientStartPoint: { x: cx - wb, y: 0 },
        fillLinearGradientEndPoint: { x: cx + wb, y: 0 },
        fillLinearGradientColorStops: [0, '#05080f', 0.36, '#101b2d', 0.6, '#1b2c47', 1, '#04070c'],
        stroke: p.ink, strokeWidth: 3
      }));
      // светящееся кольцо между сегментами
      g.add(new (K().Ellipse)({
        x: cx, y: yt, radiusX: wt + 4, radiusY: 22,
        stroke: 'rgba(157,246,255,0.5)', strokeWidth: 2.4, opacity: 0.7
      }));
    }
    // капсулы памяти в верхнем сегменте
    for (let i = 0; i < 7; i++) {
      g.add(new (K().Circle)({
        x: cx - 60 + (i % 3) * 60, y: 760 + Math.floor(i / 3) * 70,
        radius: 13, fill: 'rgba(157,246,255,0.18)', stroke: 'rgba(157,246,255,0.6)', strokeWidth: 1.4
      }));
    }
    // трубки охлаждения
    for (let i = 0; i < 9; i++) {
      const x = cx - 112 + i * 28;
      g.add(new (K().Line)({ points: [x, 400, x, 1540], stroke: '#243650', strokeWidth: 8, opacity: 0.9 }));
      g.add(new (K().Line)({ points: [x - 2, 400, x - 2, 1540], stroke: '#5d86b8', strokeWidth: 1.6, opacity: 0.35 }));
    }
    // бегущие искры памяти
    const sparks = new (K().Group)();
    for (let i = 0; i < 22; i++) {
      const x = cx - 112 + (i * 53) % 224;
      const y = 430 + (i * 137) % 1080;
      sparks.add(new (K().Circle)({
        x: x, y: y, radius: 2.6,
        fill: i % 3 ? '#9df6ff' : '#ffffff',
        shadowColor: '#9df6ff', shadowBlur: 18, opacity: 0.85
      }));
    }
    g.add(sparks);
    // «глаз» ядра
    g.add(new (K().Circle)({
      x: cx, y: 640, radius: 78,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 78,
      fillRadialGradientColorStops: [0, 'rgba(200,255,255,0.9)', 0.36, 'rgba(60,200,220,0.35)', 1, 'rgba(10,40,60,0)']
    }));
    g.add(new (K().Circle)({ x: cx, y: 640, radius: 16, fill: '#d8ffff' }));
    g.add(new (K().Ellipse)({
      x: cx, y: 1500, radiusX: 300, radiusY: 120,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 300,
      fillRadialGradientColorStops: [0, 'rgba(120,230,255,0.18)', 1, 'rgba(120,230,255,0)']
    }));
    return { sparks: sparks };
  };

  /* --------------------------------------------------------- 7. внешний шлюз / трещина */
  Cine.setHull = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, p.depth[0], 0.45, p.depth[1], 1, p.depth[2]]
    }));
    // обшивка: крупные панели со швами
    for (let i = 0; i < 8; i++) {
      const y = 60 + i * 200;
      g.add(new (K().Line)({ points: [-200, y, W + 200, y + 14], stroke: p.ink, strokeWidth: 8, opacity: 0.45 }));
      g.add(new (K().Line)({ points: [-200, y + 8, W + 200, y + 22], stroke: p.light, strokeWidth: 1.4, opacity: 0.08 }));
    }
    // трещина: рваная ломаная сверху вниз
    const SimplexLib = Simplex();
    const n = new SimplexLib(1207);
    let d = 'M700 240';
    let y = 240;
    let x = 700;
    for (let i = 0; i < 14; i++) {
      y += 60 + n.noise2D(i * 2.3, 1) * 34;
      x += n.noise2D(i * 1.7, 5) * 46;
      d += ' L' + r(x) + ' ' + r(y);
    }
    g.add(new (K().Path)({ data: d, stroke: '#72e6ff', strokeWidth: 9, opacity: 0.16 }));
    g.add(new (K().Path)({ data: d, stroke: '#d8ffff', strokeWidth: 2.4, opacity: 0.85 }));
    // «дыхание» воды за трещиной
    g.add(new (K().Path)({
      data: d, stroke: '#2a6f8a', strokeWidth: 22, opacity: 0.35, lineJoin: 'round'
    }));
    // заплатка
    g.add(new (K().Path)({
      data: 'M560 980 C640 950 760 960 840 1000 L830 1120 C740 1150 620 1140 550 1100 Z',
      fill: '#16262c', stroke: p.warm, strokeWidth: 2.6, opacity: 0.92
    }));
    for (let i = 0; i < 10; i++) {
      const bx = 578 + (i % 5) * 52;
      const by = 1000 + Math.floor(i / 5) * 70;
      g.add(new (K().Circle)({ x: bx, y: by, radius: 4.4, fill: p.light, opacity: 0.5 }));
    }
    // сварочный шов
    g.add(new (K().Path)({
      data: 'M556 1080 C640 1108 748 1112 836 1084',
      stroke: '#ffb36b', strokeWidth: 3.4, opacity: 0.5, dash: [8, 7]
    }));
    // пол
    g.add(new (K().Line)({ points: [-200, 1500, W + 200, 1440], stroke: p.light, strokeWidth: 5, opacity: 0.18 }));
    return {};
  };

  /* --------------------------------------------------------- 8. столовая: сорок человек */
  Cine.setCanteen = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#07141a', 0.5, '#0a1c22', 1, '#030c10']
    }));
    // три ряда силуэтов: дальний — светлее (дымка), ближний — темнее и крупнее
    for (let row = 0; row < 3; row++) {
      const y = 1520 + row * 78;
      const s = 1.05 + row * 0.34;
      for (let i = 0; i < 12; i++) {
        const x = 26 + i * 104 + (row % 2 ? 48 : 0);
        const tone = row === 0 ? '#1b3d47' : (row === 1 ? '#142f37' : '#0c1f26');
        const fig = Cine.crowdFigure(x, y, s, tone, row === 0 ? 0.7 : 0.9);
        fig.add(new (K().Path)({
          data: 'M0 -26 C-14 -28 -24 -22 -26 -10 M0 -26 C14 -28 24 -22 26 -10',
          stroke: 'rgba(157,246,255,0.35)', strokeWidth: 1.2, opacity: 0.45
        }));
        g.add(fig);
      }
    }
    // панорамный иллюминатор: за ним только вода и пыль
    g.add(new (K().Path)({
      data: 'M120 420 C120 356 300 330 600 330 C900 330 1080 356 1080 420 L1080 940 C1080 1010 900 1040 600 1040 C300 1040 120 1010 120 940 Z',
      fillLinearGradientStartPoint: { x: 600, y: 330 },
      fillLinearGradientEndPoint: { x: 600, y: 1040 },
      fillLinearGradientColorStops: [0, 'rgba(24,90,110,0.30)', 0.55, 'rgba(10,44,58,0.34)', 1, 'rgba(4,18,24,0.5)'],
      stroke: 'rgba(120,225,240,0.35)', strokeWidth: 3
    }));
    // переборки иллюминатора
    for (let i = 1; i < 3; i++) {
      const x = 120 + i * 320;
      g.add(new (K().Line)({ points: [x, 346, x, 1032], stroke: 'rgba(120,225,240,0.28)', strokeWidth: 6 }));
    }
    g.add(new (K().Line)({ points: [124, 690, 1076, 690], stroke: 'rgba(120,225,240,0.2)', strokeWidth: 4 }));
    // свет сверху в воде
    for (let i = 0; i < 4; i++) {
      g.add(new (K().Path)({
        data: 'M' + (240 + i * 210) + ' 350 L' + (300 + i * 210) + ' 350 L' + (420 + i * 210) + ' 1010 L' + (330 + i * 210) + ' 1010 Z',
        fillLinearGradientStartPoint: { x: 0, y: 350 },
        fillLinearGradientEndPoint: { x: 0, y: 1010 },
        fillLinearGradientColorStops: [0, 'rgba(157,246,255,0.10)', 1, 'rgba(157,246,255,0)']
      }));
    }
    // взвесь за стеклом
    for (let i = 0; i < 90; i++) {
      const x = 150 + ((i * 137) % 900);
      const y = 360 + ((i * 211) % 650);
      g.add(new (K().Circle)({ x: x, y: y, radius: 1 + (i % 3) * 0.7, fill: '#cdeff5', opacity: 0.12 + (i % 5) / 60 }));
    }

    // балки потолка
    for (let i = 0; i < 4; i++) {
      g.add(new (K().Line)({ points: [-200, 120 + i * 150, W + 200, 100 + i * 150], stroke: '#0e2630', strokeWidth: 16, opacity: 0.9 }));
      g.add(new (K().Line)({ points: [-200, 126 + i * 150, W + 200, 106 + i * 150], stroke: '#2b5a68', strokeWidth: 2, opacity: 0.35 }));
    }
    // ряд лавок в среднем плане — заполняет пустоту
    for (let i = 0; i < 4; i++) {
      const yy = 1180 + i * 60;
      g.add(new (K().Path)({
        data: 'M-100 ' + yy + ' L' + (W + 100) + ' ' + (yy - 16) + ' L' + (W + 100) + ' ' + (yy + 14) + ' L-100 ' + (yy + 30) + ' Z',
        fill: i % 2 ? '#0f2028' : '#132a33', stroke: '#08161b', strokeWidth: 2, opacity: 0.95
      }));
    }
    // мигающий плафон
    g.add(new (K().Ellipse)({
      x: 600, y: 96, radiusX: 60, radiusY: 14, fill: '#ffe6b0', shadowColor: '#ffcf87', shadowBlur: 90, opacity: 0.9
    }));
    g.add(new (K().Ellipse)({
      x: 600, y: 620, radiusX: 620, radiusY: 560,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 620,
      fillRadialGradientColorStops: [0, 'rgba(255,206,135,0.13)', 0.5, 'rgba(255,206,135,0.04)', 1, 'rgba(255,206,135,0)']
    }));
    return {};
  };

  /* --------------------------------------------------------- 9. ночной коридор */
  Cine.setNightCorridor = function (root, p) {
    const SimplexLib = Simplex();
    const n = new SimplexLib(606);
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#02060a', 0.55, '#04121a', 1, '#010406']
    }));
    // единственная лампа
    g.add(new (K().Path)({
      data: 'M470 240 C470 214 730 214 730 240 L706 262 L494 262 Z',
      fill: '#1b2a30', stroke: p.ink, strokeWidth: 3
    }));
    g.add(new (K().Ellipse)({ x: 600, y: 262, radiusX: 104, radiusY: 16, fill: '#dff7ff', shadowColor: '#9df6ff', shadowBlur: 90, opacity: 0.9 }));
    g.add(new (K().Path)({
      data: 'M496 262 L704 262 L1010 1560 L190 1560 Z',
      fillLinearGradientStartPoint: { x: 0, y: 262 },
      fillLinearGradientEndPoint: { x: 0, y: 1560 },
      fillLinearGradientColorStops: [0, 'rgba(180,240,255,0.14)', 0.5, 'rgba(160,230,255,0.05)', 1, 'rgba(160,230,255,0)']
    }));
    // швы стены
    for (let i = 0; i < 7; i++) {
      g.add(new (K().Line)({ points: [-200, 330 + i * 150, W + 200, 322 + i * 150], stroke: '#04121a', strokeWidth: 7, opacity: 0.6 }));
    }
    // дверные проёмы
    for (let i = 0; i < 3; i++) {
      const x = 120 + i * 420;
      g.add(new (K().Path)({
        data: 'M' + x + ' 1180 L' + x + ' 520 C' + (x + 90) + ' 480 ' + (x + 180) + ' 520 ' + (x + 180) + ' 562 L' + (x + 180) + ' 1180 Z',
        fill: '#020608', stroke: '#0d2530', strokeWidth: 2, opacity: 0.9
      }));
    }
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1180 L' + (W + 200) + ' 1180 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1180 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#071a20', 1, '#01060a']
    }));
    g.add(new (K().Ellipse)({
      x: 600, y: 1500, radiusX: 480, radiusY: 150,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 480,
      fillRadialGradientColorStops: [0, 'rgba(157,246,255,0.12)', 1, 'rgba(157,246,255,0)']
    }));
    // тень на стене от того, кто замер
    const shadow = new (K().Path)({
      data: 'M560 1200 C580 1010 566 900 596 800 C620 720 690 700 720 760 C744 810 706 860 700 930 C692 1030 760 1120 800 1200 Z',
      fill: '#000000', opacity: 0.62
    });
    // тусклый ободок — тень «отклеивается» от стены
    g.add(new (K().Path)({
      data: 'M560 1200 C580 1010 566 900 596 800 C620 720 690 700 720 760 C744 810 706 860 700 930 C692 1030 760 1120 800 1200',
      stroke: 'rgba(157,246,255,0.16)', strokeWidth: 2, opacity: 0.6
    }));
    g.add(shadow);
    // пыль с потолка
    const dust = new (K().Group)();
    for (let i = 0; i < 60; i++) {
      const x = 300 + ((i * 97) % 600);
      const y = 300 + ((i * 173) % 1200);
      dust.add(new (K().Circle)({ x: x, y: y, radius: 1.4 + (i % 3) * 0.6, fill: '#cfeff5', opacity: 0.1 + (i % 5) / 40 }));
    }
    g.add(dust);
    return { shadow: shadow, dust: dust };
  };

  /* --------------------------------------------------------- 10. коридор B (страница 5) */
  Cine.setCorridorB = function (root, p) {
    return { room: Cine.room({
      palette: p, horizon: 1160, seed: 55, vp: { x: 640, y: 980 },
      pipes: [
        { x: 120, y0: -100, c1: 300, c2: 700, y1: 1120, w: 30 },
        { x: 1080, y0: -100, c1: 380, c2: 760, y1: 1120, w: 22 }
      ],
      lamps: [
        { x: 300, y: 210, r: 220 },
        { x: 940, y: 180, r: 260 },
        { x: 620, y: 60, r: 180 }
      ]
    }) };
  };

  /* --------------------------------------------------------- 11. вахтенный пост */
  Cine.setWatch = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#040d12', 0.5, '#071a21', 1, '#02080b']
    }));
    // обзорный экран: чёрная вода и «снег» помех
    g.add(new (K().Path)({
      data: 'M96 150 L1104 128 L1112 812 L88 836 Z',
      fill: '#01060a', stroke: '#123039', strokeWidth: 12
    }));
    g.add(new (K().Path)({
      data: 'M120 176 L1080 156 L1086 790 L114 812 Z',
      fillLinearGradientStartPoint: { x: 120, y: 156 },
      fillLinearGradientEndPoint: { x: 1080, y: 812 },
      fillLinearGradientColorStops: [0, 'rgba(10,40,54,0.55)', 0.5, 'rgba(4,18,26,0.9)', 1, 'rgba(1,6,10,1)']
    }));
    // сетка сонара
    for (let i = 1; i < 6; i++) {
      g.add(new (K().Line)({ points: [120 + i * 160, 170, 120 + i * 160, 806], stroke: 'rgba(120,225,240,0.10)', strokeWidth: 1.6 }));
    }
    for (let i = 1; i < 4; i++) {
      g.add(new (K().Line)({ points: [122, 170 + i * 160, 1082, 152 + i * 160], stroke: 'rgba(120,225,240,0.08)', strokeWidth: 1.6 }));
    }
    // «снег» помех — детерминированный, чтобы кадр не мигал при перерисовке
    const SimplexLib = Simplex();
    const n = new SimplexLib(8081);
    for (let i = 0; i < 300; i++) {
      const x = 122 + ((i * 173) % 950);
      const y = 172 + ((i * 97) % 620);
      const a = Math.abs(n.noise2D(i * 0.7, i * 0.3));
      g.add(new (K().Circle)({ x: x, y: y, radius: 0.7 + a * 1.7, fill: '#cdeff5', opacity: 0.05 + a * 0.22 }));
    }
    // сектор сонара
    g.add(new (K().Path)({
      data: 'M600 880 L600 470 A410 410 0 0 1 1010 880 Z',
      fill: 'rgba(120,240,210,0.05)', stroke: 'rgba(120,240,210,0.2)', strokeWidth: 1.6
    }));
    for (let i = 1; i <= 4; i++) {
      g.add(new (K().Arc)({
        x: 600, y: 880, innerRadius: i * 96 - 2, outerRadius: i * 96,
        angle: 180, rotation: 0, fill: 'rgba(120,240,210,0.14)'
      }));
    }
    g.add(new (K().Line)({ points: [600, 880, 600, 566], stroke: 'rgba(150,255,225,0.5)', strokeWidth: 2.4 }));

    // пульт с двумя мониторами
    g.add(new (K().Path)({
      data: 'M60 1240 L1140 1224 L1160 1500 L40 1516 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1224 },
      fillLinearGradientEndPoint: { x: 0, y: 1516 },
      fillLinearGradientColorStops: [0, '#14262d', 1, '#08161b']
    }));
    g.add(new (K().Line)({ points: [62, 1248, 1138, 1232], stroke: p.light, strokeWidth: 3, opacity: 0.35 }));
    [[300, 1150], [900, 1136]].forEach(function (m, i) {
      g.add(new (K().Path)({
        data: 'M' + (m[0] - 190) + ' ' + (m[1] + 110) + ' L' + (m[0] - 186) + ' ' + (m[1] - 96) + ' L' + (m[0] + 186) + ' ' + (m[1] - 104) + ' L' + (m[0] + 190) + ' ' + (m[1] + 102) + ' Z',
        fill: '#04121a', stroke: '#1b3d47', strokeWidth: 7
      }));
      g.add(new (K().Path)({
        data: 'M' + (m[0] - 168) + ' ' + (m[1] + 88) + ' L' + (m[0] - 164) + ' ' + (m[1] - 74) + ' L' + (m[0] + 164) + ' ' + (m[1] - 82) + ' L' + (m[0] + 168) + ' ' + (m[1] + 80) + ' Z',
        fill: i ? 'rgba(255,120,80,0.10)' : 'rgba(120,240,210,0.10)',
        stroke: i ? 'rgba(255,140,100,0.35)' : 'rgba(120,240,210,0.35)', strokeWidth: 1.6
      }));
      for (let k = 0; k < 4; k++) {
        g.add(new (K().Line)({
          points: [m[0] - 140, m[1] - 40 + k * 30, m[0] - 140 + (60 + ((k * 47) % 160)), m[1] - 40 + k * 30 + ((k % 2) ? 6 : -4)],
          stroke: i ? 'rgba(255,160,120,0.5)' : 'rgba(150,255,225,0.5)', strokeWidth: 2, lineCap: 'round'
        }));
      }
    });
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1500 L' + (W + 200) + ' 1490 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1490 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a1a20', 1, '#02080b']
    }));
    return {};
  };

  /* --------------------------------------------------------- 12. рубка: кресло, кофе */
  Cine.setBridge = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#04101a', 0.5, '#061a26', 1, '#02080d']
    }));
    // пульт полукольцом
    g.add(new (K().Path)({
      data: 'M-100 1180 C300 1060 900 1060 1300 1180 L1300 1560 L-100 1560 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1060 },
      fillLinearGradientEndPoint: { x: 0, y: 1560 },
      fillLinearGradientColorStops: [0, '#17323b', 0.5, '#0d2028', 1, '#061117']
    }));
    g.add(new (K().Path)({
      data: 'M-100 1180 C300 1060 900 1060 1300 1180',
      stroke: p.light, strokeWidth: 3, opacity: 0.4
    }));
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = -60 + t * 1320;
      const y = 1200 - Math.sin(t * Math.PI) * 96;
      g.add(new (K().Circle)({
        x: x, y: y, radius: 4.4,
        fill: i % 5 === 0 ? '#ff8f5a' : (i % 3 === 0 ? '#ffd166' : '#8fe8f0'),
        opacity: 0.7
      }));
    }
    // кресло
    g.add(new (K().Path)({
      data: 'M760 1180 C860 1140 990 1150 1040 1230 L1040 1560 L760 1560 Z',
      fill: '#0d1c22', stroke: '#061117', strokeWidth: 3
    }));
    g.add(new (K().Path)({
      data: 'M780 1240 C870 1210 980 1220 1016 1280',
      stroke: '#2b5a68', strokeWidth: 3, opacity: 0.5
    }));
    // иллюминаторы
    for (let i = 0; i < 3; i++) {
      g.add(new (K().Circle)({
        x: 210 + i * 300, y: 380, radius: 96,
        fill: 'rgba(10,40,54,0.5)', stroke: '#1b3d47', strokeWidth: 8
      }));
      g.add(new (K().Circle)({
        x: 210 + i * 300, y: 380, radius: 78,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 78,
        fillRadialGradientColorStops: [0, 'rgba(160,235,255,0.12)', 1, 'rgba(160,235,255,0)']
      }));
    }
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1560 L' + (W + 200) + ' 1560 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fill: '#040d12'
    }));
    return {};
  };

  /* --------------------------------------------------------- 13. камбуз */
  Cine.setGalley = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#1a1108', 0.45, '#120c07', 1, '#050403']
    }));
    // один жёлтый плафон
    g.add(new (K().Line)({ points: [600, -80, 600, 300], stroke: '#0a0805', strokeWidth: 4 }));
    g.add(new (K().Path)({
      data: 'M520 300 C520 276 680 276 680 300 L660 322 L540 322 Z',
      fill: '#241708', stroke: '#0a0805', strokeWidth: 3
    }));
    g.add(new (K().Ellipse)({ x: 600, y: 322, radiusX: 60, radiusY: 12, fill: '#ffd9a0', shadowColor: '#ffb765', shadowBlur: 80, opacity: 0.9 }));
    g.add(new (K().Path)({
      data: 'M540 322 L660 322 L940 1560 L260 1560 Z',
      fillLinearGradientStartPoint: { x: 0, y: 322 },
      fillLinearGradientEndPoint: { x: 0, y: 1560 },
      fillLinearGradientColorStops: [0, 'rgba(255,200,130,0.13)', 0.5, 'rgba(255,190,120,0.05)', 1, 'rgba(255,190,120,0)']
    }));
    // стол
    g.add(new (K().Path)({
      data: 'M120 1240 L1080 1224 L1120 1420 L80 1440 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1224 },
      fillLinearGradientEndPoint: { x: 0, y: 1440 },
      fillLinearGradientColorStops: [0, '#2a1d12', 1, '#140d08']
    }));
    g.add(new (K().Line)({ points: [124, 1248, 1076, 1232], stroke: '#ffcf94', strokeWidth: 2.6, opacity: 0.3 }));
    // лавки
    g.add(new (K().Path)({ data: 'M60 1400 L40 1500 L1080 1480 L1100 1380 Z', fill: '#120c07', stroke: '#0a0805', strokeWidth: 3 }));
    // кружки на столе
    for (let i = 0; i < 5; i++) {
      const x = 250 + i * 170;
      g.add(new (K().Path)({
        data: 'M' + (x - 20) + ' 1280 L' + (x - 16) + ' 1326 L' + (x + 16) + ' 1326 L' + (x + 20) + ' 1280 Z',
        fill: '#3a2a1a', stroke: '#0a0805', strokeWidth: 2
      }));
      g.add(new (K().Ellipse)({ x: x, y: 1280, radiusX: 20, radiusY: 6, fill: '#4a3825' }));
    }
    // ведро и швабра у стены
    g.add(new (K().Path)({ data: 'M1020 1180 L1060 1180 L1052 1270 L1028 1270 Z', fill: '#1a1a14', stroke: '#0a0a08', strokeWidth: 2 }));
    g.add(new (K().Line)({ points: [1000, 1250, 1110, 1080], stroke: '#2a2418', strokeWidth: 6, lineCap: 'round' }));
    return {};
  };

  /* --------------------------------------------------------- 14. технический тоннель */
  Cine.setTunnel = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fill: '#061117'
    }));
    // трубы вдоль тоннеля, уходящие в точку схода
    const vp = { x: 620, y: 860 };
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (0.02 + i / 13 * 0.96);
      const rad = 820;
      const x0 = vp.x + Math.cos(a) * rad;
      const y0 = vp.y + Math.sin(a) * rad * 1.5;
      const w = 8 + (i % 4) * 9;
      g.add(new (K().Line)({
        points: [x0, y0, vp.x + (x0 - vp.x) * 0.06, vp.y + (y0 - vp.y) * 0.06],
        stroke: i % 3 ? '#1a2f38' : '#26454f', strokeWidth: w, lineCap: 'round'
      }));
      g.add(new (K().Line)({
        points: [x0, y0, vp.x + (x0 - vp.x) * 0.06, vp.y + (y0 - vp.y) * 0.06],
        stroke: 'rgba(157,246,255,0.22)', strokeWidth: 1.6, lineCap: 'round'
      }));
    }
    // рёбра жёсткости
    for (let i = 0; i < 6; i++) {
      const k = Math.pow(i / 6, 1.6);
      const rx = 220 + k * 760, ry = 300 + k * 520;
      g.add(new (K().Ellipse)({
        x: vp.x, y: vp.y, radiusX: rx, radiusY: ry * 0.72,
        stroke: i % 2 ? '#152a33' : '#20424c', strokeWidth: 10 - i, opacity: 0.9
      }));
    }
    // точка схода — проём с ободом
    g.add(new (K().Path)({
      data: 'M516 772 C560 742 680 742 744 772 L744 988 C680 1016 560 1016 516 988 Z',
      fill: '#02080b', stroke: '#1d3b45', strokeWidth: 5
    }));
    g.add(new (K().Path)({
      data: 'M530 786 C570 762 676 762 730 786 L730 974 C676 998 570 998 530 974 Z',
      fill: '#0a1a20', opacity: 0.8
    }));
    g.add(new (K().Ellipse)({
      x: 620, y: 880, radiusX: 220, radiusY: 150,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 220,
      fillRadialGradientColorStops: [0, 'rgba(0,0,0,0.9)', 1, 'rgba(0,0,0,0)']
    }));
    // пол-решётка
    g.add(new (K().Path)({
      data: 'M-200 1180 L' + (W + 200) + ' 1180 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fill: '#050c10'
    }));
    for (let i = -7; i <= 7; i++) {
      g.add(new (K().Line)({
        points: [620 + i * 30, 1180, 620 + i * 190, H + 100],
        stroke: '#0d1a20', strokeWidth: 4, opacity: 0.9
      }));
    }
    return { vp: vp };
  };

  /* --------------------------------------------------------- 15. реактор: перегрузка */
  Cine.setReactorHot = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const out = Cine.setReactor(root, p);
    // аварийные лампы по стенам
    for (let i = 0; i < 6; i++) {
      const x = 120 + i * 200;
      g.add(new (K().Circle)({
        x: x, y: 210, radius: 26,
        fill: '#ff4a3a', shadowColor: '#ff3d33', shadowBlur: 60, opacity: 0.9
      }));
      g.add(new (K().Path)({
        data: 'M' + (x - 18) + ' 236 L' + (x + 18) + ' 236 L' + (x + 120) + ' 1000 L' + (x - 120) + ' 1000 Z',
        fillLinearGradientStartPoint: { x: 0, y: 236 },
        fillLinearGradientEndPoint: { x: 0, y: 1000 },
        fillLinearGradientColorStops: [0, 'rgba(255,74,58,0.10)', 1, 'rgba(255,74,58,0)']
      }));
    }
    return out;
  };

  /* --------------------------------------------------------- 16. коридор после взрыва */
  Cine.setBlastCorridor = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#120a06', 0.42, '#1c0d07', 1, '#050303']
    }));
    // стена с пробоиной
    g.add(new (K().Path)({
      data: 'M120 240 L480 200 L520 900 L120 940 Z',
      fill: '#0a0f12', stroke: '#1d2a30', strokeWidth: 3
    }));
    const SimplexLib = Simplex();
    const n = new SimplexLib(4477);
    // рваная пробоина
    let d = '';
    const cx = 300, cy = 620;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      const rad = 150 + Math.abs(n.noise2D(i * 0.9, 3.3)) * 96;
      const xx = cx + Math.cos(a) * rad * 0.9;
      const yy = cy + Math.sin(a) * rad * 1.1;
      d += (i ? ' L' : 'M') + r(xx) + ' ' + r(yy);
    }
    g.add(new (K().Path)({ data: d + ' Z', fill: '#02060a', stroke: '#3a2a1e', strokeWidth: 5 }));
    // раскалённые края
    g.add(new (K().Path)({
      data: d + ' Z',
      stroke: 'rgba(255,140,60,0.55)', strokeWidth: 2.4, shadowColor: '#ff7a2f', shadowBlur: 30
    }));
    // светящаяся вода из контура
    g.add(new (K().Path)({
      data: 'M-200 1400 C200 1330 420 1420 620 1340 C820 1264 1020 1360 1400 1300 L1400 ' + (H + 200) + ' L-200 ' + (H + 200) + ' Z',
      fillLinearGradientStartPoint: { x: 0, y: 1300 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, 'rgba(150,255,220,0.22)', 0.5, 'rgba(110,240,200,0.14)', 1, 'rgba(60,180,150,0.06)']
    }));
    g.add(new (K().Path)({
      data: 'M-200 1400 C200 1330 420 1420 620 1340 C820 1264 1020 1360 1400 1300',
      stroke: 'rgba(200,255,235,0.7)', strokeWidth: 3
    }));
    // трещины по стене
    for (let i = 0; i < 9; i++) {
      let x0 = cx + (n.noise2D(i, 1) * 220), y0 = cy + (n.noise2D(i, 5) * 320);
      let dd = 'M' + r(x0) + ' ' + r(y0);
      for (let k = 0; k < 5; k++) {
        x0 += n.noise2D(i * 2 + k, 7) * 90;
        y0 += n.noise2D(i * 3 + k, 9) * 90;
        dd += ' L' + r(x0) + ' ' + r(y0);
      }
      g.add(new (K().Path)({ data: dd, stroke: 'rgba(255,150,90,0.28)', strokeWidth: 2 }));
    }
    return { hole: { x: cx, y: cy }, glow: d };
  };


  /* --------------------------------------------------------- 17. коридор после вспышки */
  Cine.setFlash = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#1a0c06', 0.35, '#2a1208', 0.7, '#120806', 1, '#050302']
    }));
    // дым под потолком
    const SimplexLib = Simplex();
    const n = new SimplexLib(3131);
    for (let i = 0; i < 12; i++) {
      const cx = 100 + i * 100 + n.noise2D(i, 1) * 60;
      g.add(new (K().Ellipse)({
        x: cx, y: 260 + Math.abs(n.noise2D(i, 5)) * 180,
        radiusX: 130 + Math.abs(n.noise2D(i, 3)) * 90, radiusY: 60 + Math.abs(n.noise2D(i, 7)) * 50,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 150,
        fillRadialGradientColorStops: [0, 'rgba(60,40,30,0.30)', 1, 'rgba(60,40,30,0)']
      }));
    }
    // переборка со снятой створкой, за ней свет
    g.add(new (K().Path)({
      data: 'M120 260 L360 240 L360 1240 L120 1260 Z',
      fill: '#0a0d10', stroke: '#2a1a10', strokeWidth: 4
    }));
    g.add(new (K().Path)({
      data: 'M380 220 C450 240 470 340 470 500 L470 1100 C470 1180 430 1230 380 1240 Z',
      fill: 'rgba(255,190,120,0.20)', stroke: 'rgba(255,180,110,0.55)', strokeWidth: 3,
      shadowColor: '#ff9a5c', shadowBlur: 60
    }));
    // оранжевый свет оттуда
    g.add(new (K().Path)({
      data: 'M420 300 L820 560 L820 1240 L420 1200 Z',
      fillLinearGradientStartPoint: { x: 420, y: 300 },
      fillLinearGradientEndPoint: { x: 800, y: 1240 },
      fillLinearGradientColorStops: [0, 'rgba(255,150,80,0.20)', 1, 'rgba(255,150,80,0)']
    }));
    // обломки на полу
    for (let i = 0; i < 22; i++) {
      const bx = 140 + ((i * 197) % 900);
      const by = 1420 + ((i * 89) % 260);
      const rr = 7 + (i % 5) * 4;
      g.add(new (K().Path)({
        data: 'M' + bx + ' ' + by + ' L' + (bx + rr) + ' ' + (by - rr * 0.7) + ' L' + (bx + rr * 1.6) + ' ' + (by + rr * 0.3) + ' L' + (bx + rr * 0.4) + ' ' + (by + rr * 0.8) + ' Z',
        fill: '#2b2420', stroke: '#6a5650', strokeWidth: 1.2
      }));
    }
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1240 L' + (W + 200) + ' 1240 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1240 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#1d1512', 1, '#070504']
    }));
    return {};
  };

  /* --------------------------------------------------------- 18. горящее крыло */
  Cine.setBurningWing = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#1c0703', 0.4, '#2e0d04', 0.75, '#160604', 1, '#050202']
    }));
    // огонь: пучок языков из simplex
    const SimplexLib = Simplex();
    const n = new SimplexLib(7777);
    for (let i = 0; i < 26; i++) {
      const bx = 80 + i * 44 + n.noise2D(i, 1) * 30;
      const by = 1300 + Math.abs(n.noise2D(i, 3)) * 120;
      const h = 220 + Math.abs(n.noise2D(i, 5)) * 420;
      g.add(new (K().Path)({
        data: 'M' + (bx - 34) + ' ' + by + ' C' + (bx - 20 + n.noise2D(i, 9) * 40) + ' ' + (by - h * 0.4) +
          ' ' + (bx + 18 + n.noise2D(i, 11) * 40) + ' ' + (by - h * 0.7) +
          ' ' + (bx + n.noise2D(i, 13) * 26) + ' ' + (by - h),
        stroke: i % 3 ? 'rgba(255,120,40,0.55)' : 'rgba(255,200,90,0.6)',
        strokeWidth: 18 + (i % 4) * 8, lineCap: 'round'
      }));
    }
    // дым
    for (let i = 0; i < 9; i++) {
      const cx = 120 + i * 130;
      g.add(new (K().Ellipse)({
        x: cx, y: 520 + Math.abs(n.noise2D(i, 21)) * 300,
        radiusX: 150, radiusY: 110,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 150,
        fillRadialGradientColorStops: [0, 'rgba(20,14,12,0.55)', 1, 'rgba(20,14,12,0)']
      }));
    }
    // раскалённый пол
    g.add(new (K().Path)({
      data: 'M-200 1320 L' + (W + 200) + ' 1320 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1320 },
      fillLinearGradientEndPoint: { x: 0, y: 1700 },
      fillLinearGradientColorStops: [0, 'rgba(255,110,40,0.30)', 1, 'rgba(80,20,6,0.6)']
    }));
    return {};
  };

  /* --------------------------------------------------------- 19. медотсек */
  Cine.setMedbay = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a1a1c', 0.5, '#0c2226', 1, '#030c0e']
    }));
    // холодная лампа
    g.add(new (K().Ellipse)({
      x: 600, y: 170, radiusX: 420, radiusY: 60, fill: '#dffcff', shadowColor: '#bff4ff', shadowBlur: 120, opacity: 0.55
    }));
    // койки
    for (let i = 0; i < 2; i++) {
      const x = 200 + i * 620;
      g.add(new (K().Path)({
        data: 'M' + x + ' 1240 L' + (x + 380) + ' 1228 L' + (x + 390) + ' 1320 L' + (x - 10) + ' 1332 Z',
        fill: '#cfe4e6', stroke: '#8fb2b8', strokeWidth: 3, opacity: 0.9
      }));
      g.add(new (K().Path)({
        data: 'M' + (x + 10) + ' 1240 C' + (x + 40) + ' 1180 ' + (x + 120) + ' 1180 ' + (x + 140) + ' 1240',
        fill: 'none', stroke: '#a9c7cc', strokeWidth: 12, lineCap: 'round', opacity: 0.8
      }));
      g.add(new (K().Path)({
        data: 'M' + (x + 300) + ' 1230 L' + (x + 370) + ' 1228 L' + (x + 376) + ' 1270 L' + (x + 306) + ' 1272 Z',
        fill: '#e8f6f8', opacity: 0.85
      }));
    }
    // капельница и штатив
    g.add(new (K().Line)({ points: [880, 900, 880, 1250], stroke: '#7fa4aa', strokeWidth: 6 }));
    g.add(new (K().Path)({
      data: 'M858 900 L902 900 L898 960 L862 960 Z',
      fill: 'rgba(190,240,250,0.5)', stroke: '#9fd0d8', strokeWidth: 2
    }));
    // шкаф с инструментом
    g.add(new (K().Path)({
      data: 'M980 400 L1160 388 L1170 1180 L980 1192 Z',
      fill: '#0e2429', stroke: '#1f4a52', strokeWidth: 3
    }));
    for (let i = 0; i < 5; i++) {
      g.add(new (K().Line)({ points: [990, 480 + i * 140, 1160, 470 + i * 140], stroke: '#2b5a68', strokeWidth: 3, opacity: 0.7 }));
    }
    // вспомогательные нити-«датчики»
    g.add(new (K().Path)({
      data: 'M120 500 C160 700 140 900 200 1100', stroke: '#9fd0d8', strokeWidth: 2, opacity: 0.35
    }));
    return {};
  };

  /* --------------------------------------------------------- 20. нижнее техническое кольцо */
  Cine.setLowerRing = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fill: '#020a0a'
    }));
    const SimplexLib = Simplex();
    const n = new SimplexLib(5150);
    // колонны и трубы
    for (let i = 0; i < 12; i++) {
      const x = -60 + i * 118;
      g.add(new (K().Line)({
        points: [x, -100, x + n.noise2D(i, 2) * 80, 1300],
        stroke: i % 2 ? '#0b1a1a' : '#132828', strokeWidth: 18 + (i % 3) * 10
      }));
      g.add(new (K().Line)({
        points: [x - 6, -100, x - 6 + n.noise2D(i, 2) * 80, 1300],
        stroke: 'rgba(120,220,200,0.10)', strokeWidth: 2
      }));
    }
    // биолюминесцентные наросты
    for (let i = 0; i < 40; i++) {
      const x = 60 + Math.abs(n.noise2D(i, 11)) * 1080;
      const y = 300 + Math.abs(n.noise2D(i, 13)) * 900;
      const r2 = 6 + Math.abs(n.noise2D(i, 17)) * 22;
      g.add(new (K().Circle)({
        x: x, y: y, radius: r2,
        fill: 'rgba(120,250,210,0.10)', stroke: 'rgba(150,255,225,0.35)', strokeWidth: 1.4
      }));
    }
    // стоячая вода
    g.add(new (K().Path)({
      data: 'M-200 1320 L' + (W + 200) + ' 1320 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1320 },
      fillLinearGradientEndPoint: { x: 0, y: 1700 },
      fillLinearGradientColorStops: [0, 'rgba(30,110,100,0.55)', 1, 'rgba(8,40,38,0.85)']
    }));
    for (let i = 0; i < 14; i++) {
      g.add(new (K().Line)({
        points: [60 + i * 84, 1400 + (i % 4) * 60, 60 + i * 84 + 40, 1400 + (i % 4) * 60 + 10],
        stroke: 'rgba(180,255,235,0.18)', strokeWidth: 2.2
      }));
    }
    return {};
  };

  /* --------------------------------------------------------- 21. тамбур шлюза (выход) */
  Cine.setLockRoom = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a1418', 0.5, '#0d1e24', 1, '#040a0c']
    }));
    // тяжёлая створка
    g.add(new (K().Path)({
      data: 'M240 180 L960 160 L980 1400 L220 1420 Z',
      fill: '#16262c', stroke: '#2b4a55', strokeWidth: 6
    }));
    g.add(new (K().Path)({
      data: 'M270 220 L930 200 L946 1360 L254 1380 Z',
      fillLinearGradientStartPoint: { x: 270, y: 200 },
      fillLinearGradientEndPoint: { x: 946, y: 1380 },
      fillLinearGradientColorStops: [0, '#1d333b', 0.5, '#152831', 1, '#0b1a20']
    }));
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      g.add(new (K().Circle)({
        x: 600 + Math.cos(a) * 300, y: 800 + Math.sin(a) * 540,
        radius: 8, fill: '#3a6270', stroke: '#0a1418', strokeWidth: 2
      }));
    }
    // штурвал в центре
    g.add(new (K().Circle)({ x: 600, y: 800, radius: 96, stroke: '#7fd8de', strokeWidth: 8, opacity: 0.35 }));
    g.add(new (K().Circle)({ x: 600, y: 800, radius: 26, fill: '#12242b', stroke: '#7fd8de', strokeWidth: 4, opacity: 0.6 }));
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      g.add(new (K().Line)({
        points: [600 + Math.cos(a) * 26, 800 + Math.sin(a) * 26, 600 + Math.cos(a) * 96, 800 + Math.sin(a) * 96],
        stroke: '#7fd8de', strokeWidth: 5, opacity: 0.35, lineCap: 'round'
      }));
    }
    // вода у порога
    g.add(new (K().Path)({
      data: 'M-200 1420 L' + (W + 200) + ' 1400 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1400 },
      fillLinearGradientEndPoint: { x: 0, y: 1750 },
      fillLinearGradientColorStops: [0, 'rgba(40,140,150,0.35)', 1, 'rgba(8,30,36,0.8)']
    }));
    return {};
  };

})(window);
