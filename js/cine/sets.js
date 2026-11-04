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
        fillEnabled: false, stroke: '#0b1c22', strokeWidth: 6, opacity: 0.9
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
    const lt = p.light || '#8ff0ff';

    /* --- стена --- */
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#04101a', 0.42, '#07202c', 0.72, '#050f16', 1, '#02080d']
    }));

    /* --- потолочная панель и лампа --- */
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' 120 L840 196 L360 196 L-200 120 Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: 200 },
      fillLinearGradientColorStops: [0, '#020a0f', 1, '#0a2130']
    }));
    g.add(new (K().Path)({
      data: 'M360 196 L840 196 L860 214 L340 214 Z',
      fill: lt, opacity: 0.55
    }));
    // световой конус
    g.add(new (K().Path)({
      data: 'M350 210 L850 210 L1010 1180 L190 1180 Z',
      fillLinearGradientStartPoint: { x: 0, y: 210 },
      fillLinearGradientEndPoint: { x: 0, y: 1180 },
      fillLinearGradientColorStops: [0, 'rgba(150,240,255,0.13)', 0.45, 'rgba(150,240,255,0.05)', 1, 'rgba(150,240,255,0)']
    }));

    /* --- рёбра жёсткости по краям --- */
    [70, 1060].forEach(function (x) {
      g.add(new (K().Path)({
        data: 'M' + x + ' 196 L' + (x + 70) + ' 196 L' + (x + 70) + ' 1250 L' + x + ' 1250 Z',
        fillLinearGradientStartPoint: { x: x, y: 0 },
        fillLinearGradientEndPoint: { x: x + 70, y: 0 },
        fillLinearGradientColorStops: [0, '#081a24', 0.5, '#123747', 1, '#06141c'],
        opacity: 0.9
      }));
      for (let i = 0; i < 6; i++) {
        g.add(new (K().Circle)({
          x: x + 35, y: 300 + i * 150, radius: 6,
          fill: '#0b2430', stroke: '#1d4a58', strokeWidth: 2
        }));
      }
    });

    /* --- три иллюминатора --- */
    for (let i = 0; i < 3; i++) {
      const cx = 210 + i * 300, cy = 380, R = 96;
      g.add(new (K().Circle)({
        x: cx, y: cy, radius: R + 14, fill: '#061a22', stroke: '#0d2b36', strokeWidth: 4
      }));
      // вода за стеклом
      g.add(new (K().Circle)({
        x: cx, y: cy, radius: R,
        fillLinearGradientStartPoint: { x: 0, y: cy - R },
        fillLinearGradientEndPoint: { x: 0, y: cy + R },
        fillLinearGradientColorStops: [0, '#0b3340', 0.55, '#05161d', 1, '#020a0e']
      }));
      for (let k = 0; k < 9; k++) {
        const a = (k * 2.399 + i * 1.1) % (Math.PI * 2);
        const rr = R * (0.24 + (k % 5) * 0.13);
        g.add(new (K().Circle)({
          x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.86,
          radius: 1.6 + (k % 3), fill: 'rgba(190,250,255,0.5)'
        }));
      }
      // луч сверху
      g.add(new (K().Path)({
        data: 'M' + (cx - 46) + ' ' + (cy - R + 8) + ' L' + (cx + 10) + ' ' + (cy - R + 8) + ' L' + (cx + 56) + ' ' + (cy + 12) + ' L' + (cx - 10) + ' ' + (cy + 12) + ' Z',
        fill: 'rgba(150,240,255,0.09)'
      }));
      // обод и зажимы
      g.add(new (K().Circle)({ x: cx, y: cy, radius: R, fillEnabled: false, stroke: '#2b5560', strokeWidth: 12 }));
      g.add(new (K().Circle)({ x: cx, y: cy, radius: R - 9, fillEnabled: false, stroke: '#04141a', strokeWidth: 5, opacity: 0.9 }));
      for (let b = 0; b < 8; b++) {
        const a = b / 8 * Math.PI * 2 + 0.4;
        g.add(new (K().Circle)({
          x: cx + Math.cos(a) * (R + 6), y: cy + Math.sin(a) * (R + 6), radius: 6,
          fill: '#122f3a', stroke: '#24505d', strokeWidth: 2
        }));
      }
      // блик
      g.add(new (K().Path)({
        data: 'M' + (cx - 62) + ' ' + (cy - 34) + ' C' + (cx - 34) + ' ' + (cy - 76) + ' ' + (cx + 22) + ' ' + (cy - 82) + ' ' + (cx + 56) + ' ' + (cy - 54),
        stroke: 'rgba(210,255,252,0.22)', strokeWidth: 9, lineCap: 'round'
      }));
    }

    /* --- швы панелей --- */
    [360, 660, 960].forEach(function (x) {
      g.add(new (K().Path)({
        data: 'M' + x + ' 240 L' + (x - 10) + ' 1120',
        stroke: 'rgba(90,170,190,0.10)', strokeWidth: 3
      }));
    });

    /* --- пульт полукольцом --- */
    g.add(new (K().Path)({
      data: 'M-100 1180 C300 1060 900 1060 1300 1180 L1300 1470 L-100 1470 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1060 },
      fillLinearGradientEndPoint: { x: 0, y: 1470 },
      fillLinearGradientColorStops: [0, '#1a3945', 0.35, '#102b35', 1, '#061117']
    }));
    // кромка
    g.add(new (K().Path)({
      data: 'M-100 1180 C300 1060 900 1060 1300 1180',
      stroke: lt, strokeWidth: 4, opacity: 0.5
    }));
    g.add(new (K().Path)({
      data: 'M-100 1188 C300 1070 900 1070 1300 1188 L1300 1214 C900 1096 300 1096 -100 1214 Z',
      fill: 'rgba(150,240,255,0.07)'
    }));
    // подсветка под кромкой
    g.add(new (K().Path)({
      data: 'M-60 1216 C300 1100 900 1100 1260 1216 L1260 1300 C900 1190 300 1190 -60 1300 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1110 },
      fillLinearGradientEndPoint: { x: 0, y: 1300 },
      fillLinearGradientColorStops: [0, 'rgba(150,240,255,0.10)', 1, 'rgba(150,240,255,0)']
    }));

    // лампочки по кромке
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = -60 + t * 1320;
      const y = 1204 - Math.sin(t * Math.PI) * 96;
      g.add(new (K().Circle)({
        x: x, y: y, radius: 4.2,
        fill: i % 5 === 0 ? '#ff8f5a' : (i % 3 === 0 ? '#ffd166' : '#8fe8f0'),
        opacity: 0.75,
        shadowColor: i % 5 === 0 ? '#ff8f5a' : '#8fe8f0', shadowBlur: 8
      }));
    }

    /* --- экраны на пульте (наклонные трапеции) --- */
    const screens = [
      { x: 128, y: 1150, w: 220, h: 108, tilt: -8, hue: '#6fe3ff' },
      { x: 470, y: 1118, w: 262, h: 120, tilt: 0, hue: '#9dffd8' },
      { x: 862, y: 1152, w: 220, h: 106, tilt: 8, hue: '#ffb98a' }
    ];
    screens.forEach(function (sc) {
      const x0 = sc.x, y0 = sc.y, x1 = sc.x + sc.w, y1 = sc.y + sc.h;
      const s2 = sc.tilt * 0.9;
      g.add(new (K().Path)({
        data: 'M' + x0 + ' ' + (y0 + s2) + ' L' + x1 + ' ' + (y0 - s2) + ' L' + (x1 - 10) + ' ' + (y1 - s2) + ' L' + (x0 + 10) + ' ' + (y1 + s2) + ' Z',
        fill: '#04222b', stroke: '#1b4a58', strokeWidth: 4
      }));
      g.add(new (K().Path)({
        data: 'M' + (x0 + 12) + ' ' + (y0 + 10 + s2) + ' L' + (x1 - 12) + ' ' + (y0 + 10 - s2) + ' L' + (x1 - 18) + ' ' + (y0 + 40 - s2) + ' L' + (x0 + 18) + ' ' + (y0 + 40 + s2) + ' Z',
        fill: sc.hue, opacity: 0.10
      }));
      // строчки данных
      for (let r2 = 0; r2 < 5; r2++) {
        const ly = y0 + 26 + r2 * 16;
        const lw = 40 + ((r2 * 53 + sc.x) % 120);
        g.add(new (K().Path)({
          data: 'M' + (x0 + 20) + ' ' + (ly + s2) + ' L' + (x0 + 20 + lw) + ' ' + (ly - s2 * 0.6),
          stroke: sc.hue, strokeWidth: r2 === 0 ? 5 : 3, opacity: 0.30 + r2 * 0.10, lineCap: 'round'
        }));
      }
      // рампа кнопок
      for (let b = 0; b < 6; b++) {
        g.add(new (K().Circle)({
          x: x0 + 26 + b * 22, y: y1 - 18 - s2 * 0.2, radius: 4,
          fill: b === 1 ? '#ff8f5a' : '#8fe8f0', opacity: 0.55
        }));
      }
    });

    /* --- кофе на пульте --- */
    g.add(new (K().Path)({
      data: 'M700 1088 L744 1088 L738 1146 L706 1146 Z',
      fill: '#122a33', stroke: '#2a5a68', strokeWidth: 3
    }));
    g.add(new (K().Path)({
      data: 'M700 1088 L744 1088 L743 1098 L701 1098 Z',
      fill: '#c8a06a', opacity: 0.85
    }));
    g.add(new (K().Path)({
      data: 'M744 1100 C760 1102 760 1126 742 1128',
      stroke: '#2a5a68', strokeWidth: 5, fillEnabled: false
    }));
    for (let i = 0; i < 3; i++) {
      g.add(new (K().Path)({
        data: 'M' + (712 + i * 12) + ' 1082 C' + (706 + i * 12) + ' 1060 ' + (720 + i * 12) + ' 1046 ' + (714 + i * 12) + ' 1024',
        stroke: 'rgba(230,245,250,0.18)', strokeWidth: 4, lineCap: 'round', fillEnabled: false
      }));
    }

    /* --- кабели --- */
    [[120, 1470, 60, 1700], [1120, 1470, 1180, 1740]].forEach(function (c) {
      g.add(new (K().Path)({
        data: 'M' + c[0] + ' ' + c[1] + ' C' + (c[0] + 40) + ' ' + (c[1] + 90) + ' ' + (c[2] - 30) + ' ' + (c[3] - 110) + ' ' + c[2] + ' ' + c[3],
        stroke: '#0b1d24', strokeWidth: 10, fillEnabled: false, lineCap: 'round'
      }));
    });

    /* --- пол и отражения --- */
    g.add(new (K().Path)({
      data: 'M-200 1470 L' + (W + 200) + ' 1470 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1470 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#08161d', 0.4, '#040e13', 1, '#01070a']
    }));
    for (let i = 0; i < 7; i++) {
      const x = 130 + i * 158;
      g.add(new (K().Ellipse)({
        x: x, y: 1516 + (i % 2) * 34, radiusX: 84, radiusY: 12,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 84,
        fillRadialGradientColorStops: [0, i % 4 === 0 ? 'rgba(255,150,100,0.10)' : 'rgba(140,235,255,0.085)', 1, 'rgba(140,235,255,0)']
      }));
    }
    // стыки плит
    for (let i = 0; i < 5; i++) {
      const yy = 1540 + i * 60;
      g.add(new (K().Path)({
        data: 'M-100 ' + yy + ' L' + (W + 100) + ' ' + yy,
        stroke: 'rgba(120,200,220,0.05)', strokeWidth: 2
      }));
    }
    // блик на полу от пульта
    g.add(new (K().Path)({
      data: 'M180 1476 C420 1450 780 1450 1020 1476 L1020 1512 C780 1486 420 1486 180 1512 Z',
      fill: 'rgba(140,235,255,0.10)'
    }));

    /* --- пыль в воздухе --- */
    for (let i = 0; i < 18; i++) {
      g.add(new (K().Circle)({
        x: 160 + ((i * 137) % 880), y: 330 + ((i * 211) % 760),
        radius: 1 + (i % 3), fill: 'rgba(200,245,255,0.35)'
      }));
    }
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
        fillEnabled: false, stroke: '#a9c7cc', strokeWidth: 12, lineCap: 'round', opacity: 0.8
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


  /* --------------------------------------------------------- 22. затопленная палуба */
  Cine.setFloodedDeck = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const SimplexLib = Simplex();
    const n = new SimplexLib(8821);
    // общий тон: грязная зелень воды
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#04110f', 0.4, '#08201d', 0.72, '#0a2a25', 1, '#04100f']
    }));
    // дальняя переборка с рёбрами
    g.add(new (K().Path)({
      data: 'M-100 300 L' + (W + 100) + ' 300 L' + (W + 100) + ' 1240 L-100 1240 Z',
      fill: '#061614', stroke: '#0d2f2a', strokeWidth: 3, opacity: 0.9
    }));
    for (let i = 0; i < 8; i++) {
      const x = -40 + i * 172;
      g.add(new (K().Line)({
        points: [x, 300, x + n.noise2D(i, 2) * 30, 1240],
        stroke: i % 2 ? '#0b2723' : '#0f3730', strokeWidth: 14 + (i % 3) * 8
      }));
    }
    // ржавые потёки
    for (let i = 0; i < 16; i++) {
      const x = 40 + Math.abs(n.noise2D(i, 7)) * 1100;
      const y0 = 320 + Math.abs(n.noise2D(i, 9)) * 160;
      const len = 120 + Math.abs(n.noise2D(i, 13)) * 420;
      g.add(new (K().Line)({
        points: [x, y0, x + 3, y0 + len],
        stroke: 'rgba(120,90,50,0.28)', strokeWidth: 2 + (i % 4) * 1.6, lineCap: 'round'
      }));
    }
    // провал в полу — до воды, иначе он читается как чёрное пятно на поверхности
    g.add(new (K().Path)({
      data: 'M760 1240 C830 1214 940 1216 1000 1244 C1014 1300 976 1348 900 1364 C826 1348 772 1300 760 1240 Z',
      fill: '#010706', stroke: '#0b2a26', strokeWidth: 4
    }));
    g.add(new (K().Path)({
      data: 'M760 1240 C830 1214 940 1216 1000 1244',
      stroke: 'rgba(150,255,225,0.35)', strokeWidth: 2.4, shadowColor: '#8affd6', shadowBlur: 18
    }));
    // вода по пояс: линия + поверхность
    g.add(new (K().Path)({
      data: 'M-200 1210 C160 1180 380 1236 620 1206 C860 1176 1080 1232 1400 1200 L1400 ' + (H + 200) + ' L-200 ' + (H + 200) + ' Z',
      fillLinearGradientStartPoint: { x: 0, y: 1200 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, 'rgba(70,190,165,0.36)', 0.4, 'rgba(28,110,96,0.55)', 1, 'rgba(6,38,34,0.9)']
    }));
    g.add(new (K().Path)({
      data: 'M-200 1210 C160 1180 380 1236 620 1206 C860 1176 1080 1232 1400 1200',
      stroke: 'rgba(190,255,235,0.55)', strokeWidth: 2.6
    }));
    // отражения на воде
    for (let i = 0; i < 12; i++) {
      const x = 60 + i * 96;
      g.add(new (K().Line)({
        points: [x, 1250 + (i % 4) * 70, x + 54, 1252 + (i % 4) * 70],
        stroke: 'rgba(180,255,235,0.14)', strokeWidth: 2.4
      }));
    }
    // биолюминесцентные пятна на стенах
    for (let i = 0; i < 26; i++) {
      const x = 60 + Math.abs(n.noise2D(i, 17)) * 1080;
      const y = 380 + Math.abs(n.noise2D(i, 19)) * 780;
      g.add(new (K().Circle)({
        x: r(x), y: r(y), radius: 4 + Math.abs(n.noise2D(i, 23)) * 16,
        fill: 'rgba(120,255,220,0.10)', stroke: 'rgba(150,255,230,0.3)', strokeWidth: 1.3
      }));
    }
    return {};
  };

  /* --------------------------------------------------------- 23. капсула не с Земли */
  Cine.setCapsuleBay = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const SimplexLib = Simplex();
    const n = new SimplexLib(6606);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#050c12', 0.5, '#0a1a20', 1, '#03080b']
    }));
    // бетонная выемка в стене
    g.add(new (K().Path)({
      data: 'M120 260 L1080 240 L1100 1300 L100 1320 Z',
      fill: '#0b1a1f', stroke: '#173039', strokeWidth: 4
    }));
    g.add(new (K().Path)({
      data: 'M180 320 L1020 300 L1036 1240 L164 1258 Z',
      fill: '#08141a'
    }));
    // капсула: сфера в срезе
    const cx = 600, cy = 760, R = 300;
    g.add(new (K().Circle)({
      x: cx, y: cy, radius: R + 70,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: R + 70,
      fillRadialGradientColorStops: [0, 'rgba(140,255,220,0.16)', 1, 'rgba(140,255,220,0)']
    }));
    g.add(new (K().Path)({
      data: 'M' + (cx - R) + ' ' + cy + ' A' + R + ' ' + R + ' 0 1 1 ' + (cx + R) + ' ' + cy + ' A' + R + ' ' + R + ' 0 1 1 ' + (cx - R) + ' ' + cy + ' Z',
      fillLinearGradientStartPoint: { x: cx - R, y: cy - R },
      fillLinearGradientEndPoint: { x: cx + R, y: cy + R },
      fillLinearGradientColorStops: [0, '#1c3138', 0.45, '#12232a', 1, '#08151a'],
      stroke: '#2b4a55', strokeWidth: 6
    }));
    // рёбра сферы
    for (let i = 1; i <= 4; i++) {
      g.add(new (K().Ellipse)({
        x: cx, y: cy, radiusX: R * (1 - i * 0.18), radiusY: R,
        stroke: 'rgba(120,200,210,0.18)', strokeWidth: 2
      }));
    }
    // окалина — прожилки на корпусе
    for (let i = 0; i < 22; i++) {
      let x = cx - R + Math.abs(n.noise2D(i, 3)) * R * 2;
      let y = cy - R + Math.abs(n.noise2D(i, 5)) * R * 2;
      let d = 'M' + r(x) + ' ' + r(y);
      for (let k = 0; k < 4; k++) {
        x += n.noise2D(i * 2 + k, 7) * 40;
        y += n.noise2D(i * 3 + k, 11) * 40;
        d += ' L' + r(x) + ' ' + r(y);
      }
      g.add(new (K().Path)({ data: d, stroke: 'rgba(255,190,120,0.22)', strokeWidth: 1.6 }));
    }
    // свечение из щели
    g.add(new (K().Path)({
      data: 'M' + (cx - 120) + ' ' + (cy + 140) + ' C' + (cx - 40) + ' ' + (cy + 200) + ' ' + (cx + 60) + ' ' + (cy + 190) + ' ' + (cx + 130) + ' ' + (cy + 120),
      stroke: 'rgba(160,255,230,0.75)', strokeWidth: 4, shadowColor: '#8affd6', shadowBlur: 40
    }));
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1300 L' + (W + 200) + ' 1280 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + ' Z',
      fillLinearGradientStartPoint: { x: 0, y: 1290 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a171c', 1, '#03080a']
    }));
    // инструменты и обломки вокруг
    for (let i = 0; i < 9; i++) {
      const x = 160 + i * 110;
      const y = 1380 + (i % 4) * 40;
      g.add(new (K().Path)({
        data: 'M' + x + ' ' + y + ' L' + (x + 46) + ' ' + (y - 12) + ' L' + (x + 52) + ' ' + (y + 4) + ' L' + (x + 6) + ' ' + (y + 16) + ' Z',
        fill: '#132228', stroke: '#1f3d46', strokeWidth: 1.6
      }));
    }
    return { capsule: { x: cx, y: cy, r: R } };
  };

  /* --------------------------------------------------------- 24. гидролокатор */
  Cine.setSonarRoom = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fill: '#03090c'
    }));
    // круглый экран
    const cx = 600, cy = 700, R = 330;
    g.add(new (K().Circle)({
      x: cx, y: cy, radius: R + 26,
      fill: '#0a1a1f', stroke: '#1d4149', strokeWidth: 8
    }));
    g.add(new (K().Circle)({
      x: cx, y: cy, radius: R,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: R,
      fillRadialGradientColorStops: [0, '#0b2e2c', 0.7, '#061c1c', 1, '#03100f']
    }));
    // сетка
    [0.33, 0.66, 1].forEach(function (k) {
      g.add(new (K().Circle)({ x: cx, y: cy, radius: R * k, stroke: 'rgba(140,255,220,0.22)', strokeWidth: 2 }));
    });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.add(new (K().Line)({
        points: [cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, cx + Math.cos(a) * R, cy + Math.sin(a) * R],
        stroke: 'rgba(140,255,220,0.14)', strokeWidth: 1.6
      }));
    }
    // сектор развёртки
    g.add(new (K().Path)({
      data: 'M' + cx + ' ' + cy + ' L' + (cx + R * 0.42) + ' ' + (cy - R * 0.9) + ' A' + R + ' ' + R + ' 0 0 1 ' + (cx + R * 0.9) + ' ' + (cy - R * 0.42) + ' Z',
      fill: 'rgba(140,255,220,0.12)'
    }));
    // отметки контактов
    for (let i = 0; i < 5; i++) {
      const a = -2.4 + i * 0.5, rr = 90 + i * 44;
      g.add(new (K().Circle)({
        x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, radius: 5 + (i === 4 ? 9 : 0),
        fill: i === 4 ? '#ff7a5c' : '#bfffe8', opacity: 0.85,
        shadowColor: i === 4 ? '#ff7a5c' : '#8affd6', shadowBlur: 18
      }));
    }
    // корпус прибора
    g.add(new (K().Path)({
      data: 'M120 1080 L1080 1060 L1110 1420 L90 1440 Z',
      fill: '#0c1d22', stroke: '#1d4149', strokeWidth: 4
    }));
    for (let i = 0; i < 14; i++) {
      const x = 150 + i * 68;
      g.add(new (K().Circle)({
        x: x, y: 1170 + (i % 3) * 60, radius: 12,
        fill: i % 4 === 0 ? '#ff9a5c' : '#2f6a72', opacity: 0.7
      }));
    }
    // тумблеры
    for (let i = 0; i < 6; i++) {
      g.add(new (K().Line)({
        points: [180 + i * 150, 1330, 180 + i * 150 + (i % 2 ? 22 : -22), 1290],
        stroke: '#8fe8f0', strokeWidth: 6, lineCap: 'round', opacity: 0.6
      }));
    }
    // тросы под потолком
    for (let i = 0; i < 7; i++) {
      g.add(new (K().Path)({
        data: 'M' + (60 + i * 180) + ' -40 C' + (80 + i * 180) + ' 120 ' + (30 + i * 180) + ' 280 ' + (70 + i * 180) + ' 420',
        stroke: '#132c33', strokeWidth: 5, opacity: 0.8
      }));
    }
    return { screen: { x: cx, y: cy, r: R } };
  };

  /* --------------------------------------------------------- 25. иллюминатор */
  Cine.setPorthole = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const SimplexLib = Simplex();
    const n = new SimplexLib(3355);
    // стена вокруг
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a161b', 1, '#040a0d']
    }));
    const cx = 600, cy = 820, R = 400;
    // вода за стеклом
    g.add(new (K().Circle)({
      x: cx, y: cy, radius: R,
      fillLinearGradientStartPoint: { x: 0, y: cy - R },
      fillLinearGradientEndPoint: { x: 0, y: cy + R },
      fillLinearGradientColorStops: [0, '#07242c', 0.5, '#031218', 1, '#010a0c']
    }));
    // столбы света сверху
    for (let i = 0; i < 5; i++) {
      const x = cx - 220 + i * 110;
      g.add(new (K().Path)({
        data: 'M' + x + ' ' + (cy - R) + ' L' + (x + 60) + ' ' + (cy - R) + ' L' + (x + 150) + ' ' + (cy + R * 0.6) + ' L' + (x - 40) + ' ' + (cy + R * 0.6) + ' Z',
        fillLinearGradientStartPoint: { x: 0, y: cy - R },
        fillLinearGradientEndPoint: { x: 0, y: cy + R * 0.6 },
        fillLinearGradientColorStops: [0, 'rgba(120,220,255,0.10)', 1, 'rgba(120,220,255,0)']
      }));
    }
    // пузырьки / взвесь
    for (let i = 0; i < 40; i++) {
      const a = Math.abs(n.noise2D(i, 3)) * Math.PI * 2;
      const rr = Math.abs(n.noise2D(i, 7)) * R * 0.94;
      g.add(new (K().Circle)({
        x: r(cx + Math.cos(a) * rr), y: r(cy + Math.sin(a) * rr),
        radius: 1.4 + Math.abs(n.noise2D(i, 11)) * 3.4,
        fill: 'rgba(200,255,245,0.35)'
      }));
    }
    // толстое стекло: внутренний обод и фаска
    g.add(new (K().Circle)({ x: cx, y: cy, radius: R, fillEnabled: false, stroke: '#33565f', strokeWidth: 26 }));
    g.add(new (K().Circle)({ x: cx, y: cy, radius: R - 16, fillEnabled: false, stroke: '#0a1a20', strokeWidth: 10, opacity: 0.8 }));
    g.add(new (K().Circle)({
      x: cx, y: cy, radius: R - 22, fillEnabled: false,
      stroke: 'rgba(180,255,245,0.18)', strokeWidth: 4
    }));
    // блик стекла
    g.add(new (K().Path)({
      data: 'M' + (cx - 300) + ' ' + (cy - 180) + ' C' + (cx - 180) + ' ' + (cy - 330) + ' ' + (cx + 40) + ' ' + (cy - 370) + ' ' + (cx + 200) + ' ' + (cy - 300),
      stroke: 'rgba(210,255,250,0.16)', strokeWidth: 26, lineCap: 'round'
    }));
    // зажимы по кругу
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.add(new (K().Circle)({
        x: cx + Math.cos(a) * (R + 22), y: cy + Math.sin(a) * (R + 22), radius: 13,
        fill: '#16333b', stroke: '#2b525b', strokeWidth: 3
      }));
    }
    // рама-уголки
    g.add(new (K().Path)({
      data: 'M60 120 L340 120 L340 180 L120 180 L120 400 L60 400 Z',
      fill: '#0e2027', stroke: '#1b3a43', strokeWidth: 2
    }));
    g.add(new (K().Path)({
      data: 'M1140 1680 L860 1680 L860 1620 L1080 1620 L1080 1400 L1140 1400 Z',
      fill: '#0e2027', stroke: '#1b3a43', strokeWidth: 2
    }));
    return { port: { x: cx, y: cy, r: R } };
  };

  /* --------------------------------------------------------- 26. шахта с трапом */
  Cine.setShaft = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const SimplexLib = Simplex();
    const n = new SimplexLib(9091);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fill: '#040c0f'
    }));
    // стены шахты сужаются
    g.add(new (K().Path)({
      data: 'M-100 0 L520 240 L520 1560 L-100 1800 Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 520, y: 900 },
      fillLinearGradientColorStops: [0, '#0b1a1f', 1, '#061114']
    }));
    g.add(new (K().Path)({
      data: 'M1300 0 L680 240 L680 1560 L1300 1800 Z',
      fillLinearGradientStartPoint: { x: 1300, y: 0 },
      fillLinearGradientEndPoint: { x: 680, y: 900 },
      fillLinearGradientColorStops: [0, '#0c1d22', 1, '#061114']
    }));
    const midX = 600;
    // рёбра шахты — за трапом, иначе трап читается как пружина
    for (let i = 0; i < 7; i++) {
      const k = Math.pow(i / 7, 1.25);
      const half = 540 - k * 300;
      g.add(new (K().Ellipse)({
        x: midX, y: 220 + k * 1360, radiusX: half, radiusY: half * 0.2,
        stroke: i % 2 ? 'rgba(15,38,44,0.75)' : 'rgba(22,56,63,0.6)', strokeWidth: 7 - i * 0.6
      }));
    }
    // трап: две стойки и перекладины в перспективе
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      g.add(new (K().Line)({
        points: [midX + sgn * 86, 120, midX + sgn * 120, 1720],
        stroke: '#25454e', strokeWidth: 16, lineCap: 'round'
      }));
      g.add(new (K().Line)({
        points: [midX + sgn * 86, 120, midX + sgn * 120, 1720],
        stroke: 'rgba(160,240,255,0.14)', strokeWidth: 3, lineCap: 'round'
      }));
    }
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const y = 180 + t * 1500;
      const half = 86 + t * 34;
      const w = 10 + t * 5;
      g.add(new (K().Line)({
        points: [midX - half, y, midX + half, y - 4],
        stroke: i % 4 === 0 ? '#2f5862' : '#1c3941', strokeWidth: w, lineCap: 'round'
      }));
    }
    // вода по стенкам
    for (let i = 0; i < 18; i++) {
      const x = 120 + Math.abs(n.noise2D(i, 5)) * 240;
      const y = 300 + Math.abs(n.noise2D(i, 9)) * 1300;
      g.add(new (K().Line)({
        points: [x, y, x + 6, y + 60 + Math.abs(n.noise2D(i, 13)) * 140],
        stroke: 'rgba(120,220,220,0.18)', strokeWidth: 2.4, lineCap: 'round'
      }));
    }
    // площадка-решётка, на которой стоят люди
    g.add(new (K().Path)({
      data: 'M-200 1590 L' + (W + 200) + ' 1590 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + ' Z',
      fillLinearGradientStartPoint: { x: 0, y: 1590 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#12242a', 1, '#050c0f']
    }));
    for (let i = 0; i < 14; i++) {
      g.add(new (K().Line)({
        points: [-60 + i * 100, 1594, -60 + i * 100, 1720],
        stroke: '#1b333a', strokeWidth: 5, opacity: 0.9
      }));
    }
    for (let i = 0; i < 3; i++) {
      g.add(new (K().Line)({
        points: [-100, 1600 + i * 46, (W + 100), 1600 + i * 46],
        stroke: '#1b333a', strokeWidth: 4, opacity: 0.8
      }));
    }
    // перила площадки
    g.add(new (K().Line)({ points: [-40, 1470, 300, 1470], stroke: '#2a4a53', strokeWidth: 8, lineCap: 'round' }));
    g.add(new (K().Line)({ points: [900, 1470, 1240, 1470], stroke: '#2a4a53', strokeWidth: 8, lineCap: 'round' }));
    g.add(new (K().Line)({ points: [120, 1470, 120, 1600], stroke: '#2a4a53', strokeWidth: 7 }));
    g.add(new (K().Line)({ points: [1080, 1470, 1080, 1600], stroke: '#2a4a53', strokeWidth: 7 }));

    // далёкий свет внизу
    g.add(new (K().Ellipse)({
      x: midX, y: 1620, radiusX: 260, radiusY: 90,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 260,
      fillRadialGradientColorStops: [0, 'rgba(255,150,90,0.16)', 1, 'rgba(255,150,90,0)']
    }));
    return {};
  };


  /* --------------------------------------------------------- 27. ядро Мнемы (крупно) */
  Cine.setCoreRoom = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const S = Simplex();
    const n = new S(8123);
    const cy = 'rgba(157,246,255,';

    // стена
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#04060d', 0.45, '#070c18', 0.78, '#050a12', 1, '#02040a']
    }));

    // кабели по стенам
    for (let i = 0; i < 22; i++) {
      const x0 = -40 + i * 58;
      const wob = n.noise2D(i * 1.3, 5) * 80;
      g.add(new (K().Path)({
        data: 'M' + r(x0) + ' -120 C' + r(x0 + wob) + ' 420 ' + r(x0 - wob * 0.7) + ' 900 ' + r(x0 + 18) + ' 1420',
        stroke: i % 5 ? '#0b1220' : '#141f33', strokeWidth: 3 + (i % 3) * 2, opacity: 0.95
      }));
    }

    // пол-решётка
    g.add(new (K().Path)({
      data: 'M-200 1580 L' + (W + 200) + ' 1580 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1580 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a121c', 0.5, '#05090f', 1, '#020408']
    }));
    for (let i = 0; i < 16; i++) {
      g.add(new (K().Line)({
        points: [-80 + i * 90, 1590, -140 + i * 90, 1780],
        stroke: '#16232f', strokeWidth: 3, opacity: 0.9
      }));
    }
    for (let i = 0; i < 4; i++) {
      g.add(new (K().Line)({
        points: [-120, 1620 + i * 46, W + 120, 1616 + i * 46],
        stroke: '#16232f', strokeWidth: 2.5, opacity: 0.7
      }));
    }

    // кольцо-подиум
    g.add(new (K().Ellipse)({
      x: 600, y: 1570, radiusX: 300, radiusY: 46,
      fill: '#0b1420', stroke: '#1b3247', strokeWidth: 4
    }));
    g.add(new (K().Ellipse)({
      x: 600, y: 1570, radiusX: 236, radiusY: 34,
      stroke: cy + '0.22)', strokeWidth: 2
    }));

    // дальние стойки у стен
    [40, 150, 980, 1090].forEach(function (x) {
      g.add(new (K().Path)({
        data: 'M' + x + ' 1180 L' + (x + 54) + ' 1180 L' + (x + 58) + ' 1520 L' + (x - 4) + ' 1520 Z',
        fill: '#070d15', stroke: '#101d2a', strokeWidth: 2, opacity: 0.95
      }));
      for (let i = 0; i < 5; i++) {
        g.add(new (K().Circle)({
          x: x + 27, y: 1240 + i * 56, radius: 3.4, fill: '#1b3040', opacity: 0.9
        }));
      }
    });
    // трубки охлаждения по бокам столба (за ним)
    [430, 690].forEach(function (x0) {
      for (let i = 0; i < 4; i++) {
        const x = x0 + i * 18;
        g.add(new (K().Line)({ points: [x, 1030, x, 1560], stroke: '#1a2a3d', strokeWidth: 7, opacity: 0.95 }));
        g.add(new (K().Line)({ points: [x - 2, 1030, x - 2, 1560], stroke: '#4e7ba0', strokeWidth: 1.4, opacity: 0.28 }));
      }
    });

    // столб ядра: три сегмента, сужающиеся кверху
    const segY = [1570, 1290, 1050, 870];
    for (let i = 0; i < 3; i++) {
      const yb = segY[i], yt = segY[i + 1] + 14;
      const wb = 132 - i * 22, wt = 112 - i * 22;
      g.add(new (K().Path)({
        data: 'M' + (600 - wb) + ' ' + yb +
          ' C' + (600 - wb - 14) + ' ' + (yb - 82) + ' ' + (600 - wt) + ' ' + (yt + 62) + ' ' + (600 - wt) + ' ' + yt +
          ' C' + (600 - wt * 0.5) + ' ' + (yt - 34) + ' ' + (600 + wt * 0.5) + ' ' + (yt - 34) + ' ' + (600 + wt) + ' ' + yt +
          ' C' + (600 + wt) + ' ' + (yt + 62) + ' ' + (600 + wb + 14) + ' ' + (yb - 82) + ' ' + (600 + wb) + ' ' + yb + ' Z',
        fillLinearGradientStartPoint: { x: 600 - wb, y: 0 },
        fillLinearGradientEndPoint: { x: 600 + wb, y: 0 },
        fillLinearGradientColorStops: [0, '#04070d', 0.34, '#0e1830', 0.55, '#1d3050', 0.72, '#0c1526', 1, '#03060b'],
        stroke: '#02040a', strokeWidth: 3
      }));
      // светящееся кольцо-стык
      g.add(new (K().Ellipse)({
        x: 600, y: yt, radiusX: wt + 3, radiusY: 18,
        stroke: cy + '0.5)', strokeWidth: 2.2, opacity: 0.75
      }));
      g.add(new (K().Ellipse)({
        x: 600, y: yt + 5, radiusX: wt + 16, radiusY: 24,
        stroke: cy + '0.12)', strokeWidth: 8
      }));
    }

    // сердцевина — свет
    g.add(new (K().Circle)({
      x: 600, y: 966, radius: 46,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 46,
      fillRadialGradientColorStops: [0, 'rgba(230,255,255,0.95)', 0.4, 'rgba(90,220,235,0.5)', 1, 'rgba(10,40,60,0)']
    }));
    g.add(new (K().Circle)({ x: 600, y: 966, radius: 9, fill: '#ffffff', opacity: 0.95 }));

    // капсулы памяти в верхнем сегменте
    for (let i = 0; i < 9; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      g.add(new (K().Circle)({
        x: 600 - 44 + col * 44, y: 880 + row * 52, radius: 11,
        fill: 'rgba(157,246,255,0.14)', stroke: cy + '0.55)', strokeWidth: 1.4
      }));
    }

    // консоли по краям
    [[-40, 460], [780, 460]].forEach(function (c, k) {
      const x = c[0], w = c[1];
      g.add(new (K().Path)({
        data: 'M' + x + ' 1560 L' + (x + w) + ' 1548 L' + (x + w - 26) + ' 1250 L' + (x + 26) + ' 1262 Z',
        fillLinearGradientStartPoint: { x: 0, y: 1250 },
        fillLinearGradientEndPoint: { x: 0, y: 1560 },
        fillLinearGradientColorStops: [0, '#173040', 0.5, '#0d1d29', 1, '#060f16'],
        stroke: '#1d3a4a', strokeWidth: 3
      }));
      g.add(new (K().Path)({
        data: 'M' + (x + 34) + ' 1320 L' + (x + w - 40) + ' 1310 L' + (x + w - 52) + ' 1400 L' + (x + 34) + ' 1410 Z',
        fill: '#08171f', stroke: cy + '0.3)', strokeWidth: 2
      }));
      for (let i = 0; i < 4; i++) {
        g.add(new (K().Line)({
          points: [x + 46, 1336 + i * 18, x + 74 + i * 26, 1334 + i * 18],
          stroke: k ? '#9df6ff' : '#8affd6', strokeWidth: 3, opacity: 0.4 + i * 0.1, lineCap: 'round'
        }));
      }
      for (let i = 0; i < 4; i++) {
        g.add(new (K().Circle)({
          x: x + 52 + i * 30, y: 1476, radius: 6,
          fill: i === 1 ? '#ff9a5c' : '#2b5a68', opacity: 0.8
        }));
      }
    });

    // искры памяти
    const sparks = new (K().Group)();
    for (let i = 0; i < 26; i++) {
      sparks.add(new (K().Circle)({
        x: 470 + ((i * 53) % 260), y: 300 + ((i * 137) % 1180),
        radius: 1.8 + (i % 3), fill: i % 4 ? '#9df6ff' : '#ffffff',
        shadowColor: '#9df6ff', shadowBlur: 16, opacity: 0.6 + (i % 3) * 0.12
      }));
    }
    g.add(sparks);

    return { sparks: sparks, core: { x: 600, y: 1570 } };
  };

  /* --------------------------------------------------------- 28. стена записей */
  Cine.setMemoryWall = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const S = Simplex();
    const n = new S(4471);

    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#030610', 0.5, '#061019', 1, '#02040a']
    }));

    // рама стены
    g.add(new (K().Path)({
      data: 'M40 170 L1160 150 L1160 1060 L40 1080 Z',
      fill: '#070e18', stroke: '#132436', strokeWidth: 6
    }));

    // сетка экранов 3 × 2
    const cw = 356, chh = 416;
    const screens = [];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 66 + col * 364, y = 196 + row * 432;
      const gs = new (K().Group)();
      gs.add(new (K().Path)({
        data: 'M' + x + ' ' + y + ' L' + (x + cw) + ' ' + y + ' L' + (x + cw) + ' ' + (y + chh) + ' L' + x + ' ' + (y + chh) + ' Z',
        fill: '#04101a', stroke: '#1b3b4c', strokeWidth: 4
      }));
      gs.add(new (K().Path)({
        data: 'M' + (x + 8) + ' ' + (y + 8) + ' L' + (x + cw - 8) + ' ' + (y + 8) + ' L' + (x + cw - 8) + ' ' + (y + chh - 46) + ' L' + (x + 8) + ' ' + (y + chh - 46) + ' Z',
        fill: '#05161f'
      }));
      gs.add(new (K().Line)({
        points: [x + 8, y + chh - 46, x + cw - 8, y + chh - 46],
        stroke: 'rgba(157,246,255,0.18)', strokeWidth: 2
      }));
      // подпись-полоска
      gs.add(new (K().Line)({
        points: [x + 22, y + chh - 22, x + 92 + (i * 41) % 150, y + chh - 22],
        stroke: 'rgba(157,246,255,0.35)', strokeWidth: 4, lineCap: 'round'
      }));
      g.add(gs);
      screens.push({ x: x, y: y, w: cw, h: chh - 46, g: gs, idx: i });
    }

    // содержимое экранов
    // 1) срез метеорита: концентрические кольца и прожилки
    (function (s0) {
      const cx = s0.x + s0.w / 2, cy = s0.y + s0.h / 2;
      for (let i = 1; i <= 5; i++) {
        g.add(new (K().Ellipse)({
          x: cx, y: cy, radiusX: 22 + i * 26, radiusY: 20 + i * 24,
          stroke: 'rgba(157,246,255,' + (0.42 - i * 0.05) + ')', strokeWidth: 2,
          rotation: -8 + i * 3
        }));
      }
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2;
        g.add(new (K().Line)({
          points: [cx + Math.cos(a) * 46, cy + Math.sin(a) * 42,
            cx + Math.cos(a + 0.2) * 150, cy + Math.sin(a + 0.14) * 136],
          stroke: 'rgba(180,255,240,0.28)', strokeWidth: 2
        }));
      }
      g.add(new (K().Circle)({ x: cx, y: cy, radius: 17, fill: 'rgba(220,255,252,0.55)' }));
    })(screens[0]);

    // 2) график: осциллограмма
    (function (s0) {
      const base = s0.y + s0.h * 0.62;
      let d = 'M' + (s0.x + 18) + ' ' + base;
      for (let i = 0; i < 46; i++) {
        const x = s0.x + 18 + i * 7;
        const amp = Math.abs(n.noise2D(i * 0.4, 3)) * 90;
        d += ' L' + r(x) + ' ' + r(base - amp + (i % 7 === 0 ? -40 : 0));
      }
      g.add(new (K().Path)({ data: d, stroke: '#8affd6', strokeWidth: 3, opacity: 0.75 }));
      g.add(new (K().Line)({
        points: [s0.x + 18, base + 26, s0.x + s0.w - 18, base + 26],
        stroke: 'rgba(138,255,214,0.2)', strokeWidth: 2
      }));
      for (let i = 0; i < 3; i++) {
        g.add(new (K().Circle)({
          x: s0.x + 60 + i * 90, y: s0.y + 60 + i * 14, radius: 4, fill: '#8affd6', opacity: 0.6
        }));
      }
    })(screens[1]);

    // 3) схема станции: ярусы
    (function (s0) {
      const cx = s0.x + s0.w / 2;
      for (let i = 0; i < 7; i++) {
        const yy = s0.y + 46 + i * 42;
        const ww = 120 - Math.abs(i - 3) * 14;
        g.add(new (K().Path)({
          data: 'M' + (cx - ww) + ' ' + yy + ' L' + (cx + ww) + ' ' + yy + ' L' + (cx + ww * 0.86) + ' ' + (yy + 16) + ' L' + (cx - ww * 0.86) + ' ' + (yy + 16) + ' Z',
          fill: i === 5 ? 'rgba(255,122,92,0.28)' : 'rgba(157,246,255,0.14)',
          stroke: 'rgba(157,246,255,0.35)', strokeWidth: 1.6
        }));
      }
      g.add(new (K().Line)({
        points: [cx, s0.y + 30, cx, s0.y + s0.h - 26],
        stroke: 'rgba(255,255,255,0.18)', strokeWidth: 2
      }));
    })(screens[2]);

    // 4) запись: лицо-силуэт и таймкод
    (function (s0) {
      const cx = s0.x + s0.w / 2, cy = s0.y + s0.h * 0.46;
      g.add(new (K().Path)({
        data: 'M' + cx + ' ' + (cy - 92) + ' C' + (cx + 62) + ' ' + (cy - 92) + ' ' + (cx + 86) + ' ' + (cy - 24) + ' ' + (cx + 74) + ' ' + (cy + 26) +
          ' C' + (cx + 64) + ' ' + (cy + 74) + ' ' + (cx + 34) + ' ' + (cy + 104) + ' ' + cx + ' ' + (cy + 104) +
          ' C' + (cx - 34) + ' ' + (cy + 104) + ' ' + (cx - 64) + ' ' + (cy + 74) + ' ' + (cx - 74) + ' ' + (cy + 26) +
          ' C' + (cx - 86) + ' ' + (cy - 24) + ' ' + (cx - 62) + ' ' + (cy - 92) + ' ' + cx + ' ' + (cy - 92) + ' Z',
        fill: 'rgba(157,246,255,0.12)', stroke: 'rgba(157,246,255,0.5)', strokeWidth: 2
      }));
      g.add(new (K().Path)({
        data: 'M' + (cx - 96) + ' ' + (cy + 132) + ' C' + (cx - 70) + ' ' + (cy + 84) + ' ' + (cx + 70) + ' ' + (cy + 84) + ' ' + (cx + 96) + ' ' + (cy + 132) + ' Z',
        fill: 'rgba(157,246,255,0.10)', stroke: 'rgba(157,246,255,0.35)', strokeWidth: 2
      }));
      for (let i = 0; i < 3; i++) {
        g.add(new (K().Line)({
          points: [s0.x + 24, s0.y + 30 + i * 12, s0.x + 24 + 60 + i * 22, s0.y + 30 + i * 12],
          stroke: 'rgba(255,140,110,0.55)', strokeWidth: 3
        }));
      }
    })(screens[3]);

    // 5) список станций
    (function (s0) {
      for (let i = 0; i < 7; i++) {
        const yy = s0.y + 54 + i * 40;
        g.add(new (K().Circle)({
          x: s0.x + 34, y: yy - 5, radius: 5,
          fill: i < 4 ? '#8affd6' : '#2b4a55', opacity: 0.85
        }));
        g.add(new (K().Line)({
          points: [s0.x + 52, yy - 5, s0.x + 52 + 120 + (i * 37) % 140, yy - 5],
          stroke: i < 4 ? 'rgba(138,255,214,0.5)' : 'rgba(120,160,180,0.25)', strokeWidth: 4, lineCap: 'round'
        }));
      }
    })(screens[4]);

    // 6) таймлайн
    (function (s0) {
      const y0 = s0.y + s0.h * 0.55;
      g.add(new (K().Line)({
        points: [s0.x + 22, y0, s0.x + s0.w - 22, y0],
        stroke: 'rgba(157,246,255,0.35)', strokeWidth: 3
      }));
      for (let i = 0; i < 6; i++) {
        const x = s0.x + 34 + i * 52;
        g.add(new (K().Line)({
          points: [x, y0 - 12, x, y0 + 12],
          stroke: 'rgba(157,246,255,0.45)', strokeWidth: 2
        }));
      }
      g.add(new (K().Line)({
        points: [s0.x + 34 + 4 * 52, y0 - 60, s0.x + 34 + 4 * 52, y0 + 60],
        stroke: '#ff7a5c', strokeWidth: 4
      }));
      g.add(new (K().Circle)({ x: s0.x + 34 + 4 * 52, y: y0 - 60, radius: 7, fill: '#ff7a5c' }));
    })(screens[5]);

    // пыль и лёгкий скан
    const scan = new (K().Group)();
    scan.add(new (K().Line)({
      points: [40, 200, 1160, 190], stroke: 'rgba(157,246,255,0.16)', strokeWidth: 26
    }));
    g.add(scan);

    // пол
    g.add(new (K().Path)({
      data: 'M-200 1180 L' + (W + 200) + ' 1160 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1160 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a1520', 0.4, '#050b12', 1, '#02040a']
    }));
    // отсвет экранов на полу
    g.add(new (K().Path)({
      data: 'M120 1180 L1080 1164 L1040 1330 L150 1346 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1164 },
      fillLinearGradientEndPoint: { x: 0, y: 1346 },
      fillLinearGradientColorStops: [0, 'rgba(110,220,235,0.10)', 1, 'rgba(110,220,235,0)']
    }));
    return { screens: screens, scan: scan };
  };

  /* --------------------------------------------------------- 29. заваренная переборка */
  Cine.setSealedBulkhead = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const S = Simplex();
    const n = new S(991);
    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#080d12', 0.5, '#0c151b', 1, '#04080b']
    }));
    // рёбра стен
    for (let i = 0; i < 9; i++) {
      const x = -60 + i * 160;
      g.add(new (K().Path)({
        data: 'M' + x + ' 60 L' + (x + 54) + ' 60 L' + (x + 54) + ' 1500 L' + x + ' 1500 Z',
        fill: '#0a141a', stroke: '#14232b', strokeWidth: 2, opacity: 0.9
      }));
    }
    // переборка
    g.add(new (K().Path)({
      data: 'M190 120 L1010 120 L1010 1470 L190 1470 Z',
      fillLinearGradientStartPoint: { x: 190, y: 0 },
      fillLinearGradientEndPoint: { x: 1010, y: 0 },
      fillLinearGradientColorStops: [0, '#121f26', 0.5, '#1a2c34', 1, '#0d181e'],
      stroke: '#254048', strokeWidth: 8
    }));
    // контур двери внутри переборки
    g.add(new (K().Path)({
      data: 'M330 250 C480 190 720 190 870 250 L880 1400 L320 1400 Z',
      fill: '#16262d', stroke: '#2b4a54', strokeWidth: 5
    }));
    // сварные швы: рваные полосы
    for (let i = 0; i < 5; i++) {
      const yy = 340 + i * 210;
      g.add(new (K().Path)({
        data: 'M300 ' + yy + ' C' + (400 + i * 30) + ' ' + (yy - 18) + ' ' + (700 - i * 20) + ' ' + (yy + 20) + ' 900 ' + (yy - 4),
        stroke: '#3a5b63', strokeWidth: 12, lineCap: 'round', opacity: 0.75
      }));
      for (let k = 0; k < 14; k++) {
        const x = 310 + k * 42;
        g.add(new (K().Line)({
          points: [x, yy - 6 + Math.abs(n.noise2D(i * 3 + k, 7)) * 14, x + 16, yy + 4],
          stroke: '#5d838a', strokeWidth: 2, opacity: 0.5
        }));
      }
    }
    // заварка по периметру
    g.add(new (K().Path)({
      data: 'M300 240 C420 186 740 186 900 244',
      stroke: '#456b72', strokeWidth: 16, lineCap: 'round', fillEnabled: false
    }));
    g.add(new (K().Path)({
      data: 'M300 240 C420 186 740 186 900 244',
      stroke: 'rgba(255,170,110,0.25)', strokeWidth: 5, lineCap: 'round', fillEnabled: false
    }));
    // знак «не открывать»: треугольник и полосы
    g.add(new (K().Path)({
      data: 'M600 690 L690 850 L510 850 Z',
      fill: '#1a2126', stroke: '#d9a441', strokeWidth: 6
    }));
    g.add(new (K().Path)({
      data: 'M600 726 L600 792',
      stroke: '#d9a441', strokeWidth: 9, lineCap: 'round', fillEnabled: false
    }));
    g.add(new (K().Circle)({ x: 600, y: 816, radius: 7, fill: '#d9a441' }));
    // трафаретная надпись — прямоугольные штрихи вместо букв
    for (let i = 0; i < 9; i++) {
      g.add(new (K().Line)({
        points: [452 + i * 34, 900, 452 + i * 34 + 22, 900],
        stroke: 'rgba(217,164,65,0.5)', strokeWidth: 8, lineCap: 'butt'
      }));
    }
    // автоген: резаная полоса и искры
    const cut = new (K().Group)();
    cut.add(new (K().Path)({
      data: 'M330 1180 C450 1130 760 1130 872 1180',
      stroke: '#ff9a5c', strokeWidth: 5, lineCap: 'round', fillEnabled: false
    }));
    cut.add(new (K().Path)({
      data: 'M330 1180 C450 1130 760 1130 872 1180',
      stroke: 'rgba(255,240,180,0.5)', strokeWidth: 2, lineCap: 'round', fillEnabled: false
    }));
    for (let i = 0; i < 16; i++) {
      cut.add(new (K().Circle)({
        x: 340 + ((i * 61) % 520), y: 1120 + ((i * 37) % 90),
        radius: 1.6 + (i % 3), fill: i % 3 ? '#ffd166' : '#ffffff',
        shadowColor: '#ff9a5c', shadowBlur: 12, opacity: 0.9
      }));
    }
    g.add(cut);
    // ржавые потёки под швами
    for (let i = 0; i < 16; i++) {
      const x = 300 + i * 36;
      const yy = 340 + (i % 5) * 210;
      g.add(new (K().Path)({
        data: 'M' + x + ' ' + yy + ' C' + (x + 4) + ' ' + (yy + 40) + ' ' + (x - 3) + ' ' + (yy + 70) + ' ' + (x + 2) + ' ' + (yy + 96),
        stroke: 'rgba(140,80,45,0.18)', strokeWidth: 5, lineCap: 'round', fillEnabled: false
      }));
    }
    // сигнальная полоса по низу переборки
    for (let i = 0; i < 18; i++) {
      g.add(new (K().Path)({
        data: 'M' + (200 + i * 45) + ' 1400 L' + (238 + i * 45) + ' 1400 L' + (222 + i * 45) + ' 1452 L' + (184 + i * 45) + ' 1452 Z',
        fill: i % 2 ? 'rgba(217,164,65,0.20)' : 'rgba(20,24,26,0.5)'
      }));
    }
    // маховик-запор сбоку
    g.add(new (K().Circle)({ x: 940, y: 700, radius: 62, fillEnabled: false, stroke: '#3a5b63', strokeWidth: 10 }));
    g.add(new (K().Circle)({ x: 940, y: 700, radius: 16, fill: '#2a444b' }));
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      g.add(new (K().Line)({
        points: [940 + Math.cos(a) * 16, 700 + Math.sin(a) * 16, 940 + Math.cos(a) * 62, 700 + Math.sin(a) * 62],
        stroke: '#3a5b63', strokeWidth: 7, lineCap: 'round'
      }));
    }
    // пол
    g.add(new (K().Path)({
      data: 'M-200 1470 L' + (W + 200) + ' 1470 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1470 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0a1419', 0.5, '#050b0e', 1, '#020507']
    }));
    // мусор: обрезки, болты, брошенный инструмент
    for (let i = 0; i < 14; i++) {
      const x = 90 + ((i * 173) % 1020);
      const yy = 1520 + ((i * 97) % 200);
      g.add(new (K().Path)({
        data: 'M' + x + ' ' + yy + ' L' + (x + 40 + (i % 3) * 22) + ' ' + (yy - 8) + ' L' + (x + 46) + ' ' + (yy + 10) + ' L' + (x + 6) + ' ' + (yy + 14) + ' Z',
        fill: '#132026', stroke: '#1e3440', strokeWidth: 2
      }));
    }
    for (let i = 0; i < 9; i++) {
      g.add(new (K().Circle)({
        x: 140 + ((i * 263) % 900), y: 1640 + ((i * 71) % 110), radius: 5,
        fill: '#243a44', stroke: '#0b1418', strokeWidth: 2
      }));
    }
    for (let i = 0; i < 12; i++) {
      g.add(new (K().Line)({
        points: [120 + i * 90, 1480, 90 + i * 96, 1760],
        stroke: '#132026', strokeWidth: 3
      }));
    }
    // отсвет искр на полу
    g.add(new (K().Ellipse)({
      x: 600, y: 1500, radiusX: 340, radiusY: 46,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 340,
      fillRadialGradientColorStops: [0, 'rgba(255,150,90,0.14)', 1, 'rgba(255,150,90,0)']
    }));
    return { cut: cut, door: { x: 600, y: 1470 } };
  };

  /* --------------------------------------------------------- 30. отсек с криокамерой */
  Cine.setCryoBay = function (root, p) {
    const g = new (K().Group)();
    root.add(g);
    const S = Simplex();
    const n = new S(2024);
    const co = 'rgba(190,240,255,';

    g.add(new (K().Path)({
      data: 'M-200 -200 L' + (W + 200) + ' -200 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#061019', 0.42, '#0b1c25', 0.72, '#08151c', 1, '#02070a']
    }));

    // иней по стенам — ветвистые наросты
    for (let i = 0; i < 26; i++) {
      const x = -40 + i * 50;
      const len = 90 + Math.abs(n.noise2D(i, 4)) * 220;
      g.add(new (K().Path)({
        data: 'M' + x + ' -40 L' + r(x + n.noise2D(i, 9) * 40) + ' ' + r(len) + ' L' + r(x + 26) + ' ' + r(len * 0.5),
        stroke: co + '0.12)', strokeWidth: 3, lineCap: 'round'
      }));
    }
    // трубы
    for (let i = 0; i < 3; i++) {
      g.add(new (K().Path)({
        data: 'M-60 ' + (150 + i * 46) + ' L1260 ' + (140 + i * 46),
        stroke: '#132832', strokeWidth: 18 - i * 3, opacity: 0.9
      }));
      g.add(new (K().Path)({
        data: 'M-60 ' + (150 + i * 46) + ' L1260 ' + (140 + i * 46),
        stroke: co + '0.10)', strokeWidth: 6 - i
      }));
    }
    // вентиляционные решётки
    [[90, 700], [1030, 760]].forEach(function (v) {
      g.add(new (K().Path)({
        data: 'M' + v[0] + ' ' + v[1] + ' L' + (v[0] + 130) + ' ' + v[1] + ' L' + (v[0] + 130) + ' ' + (v[1] + 300) + ' L' + v[0] + ' ' + (v[1] + 300) + ' Z',
        fill: '#091820', stroke: '#1b3340', strokeWidth: 4
      }));
      for (let i = 0; i < 9; i++) {
        g.add(new (K().Line)({
          points: [v[0] + 12, v[1] + 22 + i * 30, v[0] + 118, v[1] + 22 + i * 30],
          stroke: '#173240', strokeWidth: 5
        }));
      }
    });

    // боковая камера справа (частично в кадре)
    g.add(new (K().Path)({
      data: 'M980 430 C1040 400 1140 400 1180 430 L1180 1440 L980 1440 Z',
      fillLinearGradientStartPoint: { x: 980, y: 0 },
      fillLinearGradientEndPoint: { x: 1180, y: 0 },
      fillLinearGradientColorStops: [0, '#16333d', 0.5, '#0f262e', 1, '#081820'],
      stroke: '#26454f', strokeWidth: 5
    }));
    g.add(new (K().Circle)({
      x: 1084, y: 760, radius: 74,
      fillLinearGradientStartPoint: { x: 0, y: 686 },
      fillLinearGradientEndPoint: { x: 0, y: 834 },
      fillLinearGradientColorStops: [0, '#0b2a33', 1, '#061a20']
    }));
    g.add(new (K().Circle)({ x: 1084, y: 760, radius: 74, fillEnabled: false, stroke: co + '0.28)', strokeWidth: 6 }));

    // главная камера
    g.add(new (K().Path)({
      data: 'M250 1520 L300 470 C310 300 460 214 600 214 C740 214 890 300 900 470 L950 1520 Z',
      fillLinearGradientStartPoint: { x: 250, y: 0 },
      fillLinearGradientEndPoint: { x: 950, y: 0 },
      fillLinearGradientColorStops: [0, '#0a1d26', 0.24, '#1d4350', 0.5, '#27575f', 0.76, '#173540', 1, '#08181f'],
      stroke: '#2d5560', strokeWidth: 6
    }));
    // стекло
    g.add(new (K().Path)({
      data: 'M330 1470 L372 512 C382 372 486 306 600 306 C714 306 818 372 828 512 L870 1470 Z',
      fillLinearGradientStartPoint: { x: 330, y: 300 },
      fillLinearGradientEndPoint: { x: 870, y: 1470 },
      fillLinearGradientColorStops: [0, 'rgba(120,200,220,0.20)', 0.35, 'rgba(30,80,100,0.42)', 1, 'rgba(6,26,34,0.75)']
    }));
    // внутренний холодный свет
    g.add(new (K().Ellipse)({
      x: 600, y: 900, radiusX: 210, radiusY: 420,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 400,
      fillRadialGradientColorStops: [0, 'rgba(120,220,255,0.14)', 1, 'rgba(120,220,255,0)']
    }));
    // иней по стеклу снизу: сплошная полоса с рваным верхним краем
    (function () {
      let d = 'M348 1466';
      for (let i = 0; i <= 20; i++) {
        const x = 348 + i * 26;
        const hh = 54 + Math.abs(n.noise2D(i * 1.7, 12)) * 120;
        d += ' L' + r(x) + ' ' + r(1466 - hh);
      }
      d += ' L872 1466 Z';
      g.add(new (K().Path)({
        data: d,
        fillLinearGradientStartPoint: { x: 0, y: 1466 },
        fillLinearGradientEndPoint: { x: 0, y: 1200 },
        fillLinearGradientColorStops: [0, 'rgba(190,240,255,0.34)', 0.5, 'rgba(170,225,250,0.16)', 1, 'rgba(150,210,240,0)']
      }));
      // редкие сосульки вверх
      for (let i = 0; i < 9; i++) {
        const x = 372 + i * 56;
        g.add(new (K().Path)({
          data: 'M' + x + ' 1400 L' + (x + 9) + ' ' + r(1330 - (i % 4) * 34) + ' L' + (x + 20) + ' 1402 Z',
          fill: 'rgba(200,245,255,0.14)'
        }));
      }
    })();
    // рама, болты
    g.add(new (K().Path)({
      data: 'M250 1520 L300 470 C310 300 460 214 600 214 C740 214 890 300 900 470 L950 1520 Z',
      stroke: '#38636e', strokeWidth: 4, fillEnabled: false, opacity: 0.7
    }));
    [298, 902].forEach(function (bx, side) {
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const x = bx + (side ? -1 : 1) * t * 22;
        const y = 560 + i * 108;
        g.add(new (K().Circle)({
          x: r(x), y: r(y), radius: 7,
          fill: '#2a4f59', stroke: '#0a1c22', strokeWidth: 2
        }));
      }
    });
    // нижняя тумба
    g.add(new (K().Path)({
      data: 'M232 1440 L968 1440 L1000 1600 L200 1600 Z',
      fillLinearGradientStartPoint: { x: 0, y: 1440 },
      fillLinearGradientEndPoint: { x: 0, y: 1600 },
      fillLinearGradientColorStops: [0, '#1b3640', 0.5, '#0e2129', 1, '#061117'],
      stroke: '#26454f', strokeWidth: 4
    }));
    for (let i = 0; i < 5; i++) {
      g.add(new (K().Circle)({
        x: 300 + i * 150, y: 1520, radius: 9,
        fill: i === 2 ? '#8affd6' : '#2b4f59', opacity: 0.8,
        shadowColor: '#8affd6', shadowBlur: i === 2 ? 14 : 0
      }));
    }

    // пол: лёд и наледь
    g.add(new (K().Path)({
      data: 'M-200 1600 L' + (W + 200) + ' 1600 L' + (W + 200) + ' ' + (H + 200) + ' L-200 ' + (H + 200) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: 1600 },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, '#0d212a', 0.35, '#071219', 1, '#02060a']
    }));
    for (let i = 0; i < 9; i++) {
      const x = 80 + i * 130;
      g.add(new (K().Path)({
        data: 'M' + x + ' 1620 L' + (x + 60) + ' 1612 L' + (x + 40) + ' 1690 L' + (x - 14) + ' 1698 Z',
        fill: 'rgba(150,220,245,0.07)'
      }));
    }
    // пар: плоские шлейфы у пола
    const mist = new (K().Group)();
    for (let i = 0; i < 4; i++) {
      mist.add(new (K().Ellipse)({
        x: 160 + i * 300, y: 1620 + (i % 2) * 40,
        radiusX: 300, radiusY: 34,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 300,
        fillRadialGradientColorStops: [0, 'rgba(200,240,255,0.10)', 1, 'rgba(200,240,255,0)']
      }));
    }
    for (let i = 0; i < 5; i++) {
      mist.add(new (K().Path)({
        data: 'M' + (120 + i * 230) + ' 1600 C' + (170 + i * 230) + ' 1520 ' + (90 + i * 230) + ' 1440 ' + (150 + i * 230) + ' 1350',
        stroke: 'rgba(200,240,255,0.07)', strokeWidth: 26, lineCap: 'round', fillEnabled: false
      }));
    }
    g.add(mist);
    return { pod: { x: 600, y: 900 }, mist: mist };
  };

  /** переднее стекло криокамеры — рисовать в s.frame поверх фигуры */
  Cine.cryoPodFront = function (o) {
    o = o || {};
    const g = new (K().Group)();
    const co = 'rgba(200,245,255,';
    // стекло с бликом
    g.add(new (K().Path)({
      data: 'M330 1470 L372 512 C382 372 486 306 600 306 C714 306 818 372 828 512 L870 1470 Z',
      fill: 'rgba(120,200,225,0.07)'
    }));
    // блик по левой стороне
    g.add(new (K().Path)({
      data: 'M382 1420 C388 900 400 620 470 470 C500 410 540 372 580 352',
      stroke: 'rgba(230,255,255,0.16)', strokeWidth: 26, lineCap: 'round', fillEnabled: false
    }));
    g.add(new (K().Path)({
      data: 'M430 1400 C436 940 450 700 508 540',
      stroke: 'rgba(230,255,255,0.10)', strokeWidth: 12, lineCap: 'round', fillEnabled: false
    }));
    // наледь по низу стекла
    for (let i = 0; i < 16; i++) {
      const x = 356 + i * 32;
      const h = 60 + Math.abs(Math.sin(i * 2.3)) * 180;
      g.add(new (K().Path)({
        data: 'M' + x + ' 1472 L' + (x + 6) + ' ' + r(1472 - h) + ' L' + (x + 16) + ' ' + r(1472 - h * 0.6),
        stroke: co + '0.22)', strokeWidth: 3, lineCap: 'round'
      }));
    }
    // рама уже нарисована в самом сете — здесь только лёгкая внутренняя кромка
    g.add(new (K().Path)({
      data: 'M330 1470 L372 512 C382 372 486 306 600 306 C714 306 818 372 828 512 L870 1470',
      stroke: 'rgba(200,245,255,0.16)', strokeWidth: 5, fillEnabled: false
    }));
    // струйки конденсата
    for (let i = 0; i < 7; i++) {
      const x = 380 + i * 70;
      g.add(new (K().Path)({
        data: 'M' + x + ' ' + (520 + (i % 3) * 60) + ' C' + (x + 4) + ' ' + (640 + i * 20) + ' ' + (x - 6) + ' ' + (760 + i * 30) + ' ' + (x + 2) + ' ' + (900 + i * 24),
        stroke: co + '0.14)', strokeWidth: 3, fillEnabled: false
      }));
    }
    return g;
  };

})(window);
