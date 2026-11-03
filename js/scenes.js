/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — сцены тома 01 (страницы 1–5)
   Каждая сцена — Konva.Group 1200×1800 из примитивов.
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const C = PG.C;
  const W = PG.W, H = PG.H;
  const S = PG.S = PG.S || {};
  const F = PG.fig;

  /* ---------------------------------------------------------------- обёртка */
  S.shell = function (stops, seed) {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, stops));
    g.add(PG.speckles({
      x0: 0, y0: 0, x1: W, y1: H, count: 70, seed: seed || 5,
      color: C.cyan, minA: 0.02, maxA: 0.16, minR: 0.6, maxR: 2.2
    }));
    return g;
  };

  S.frame = function (g) {
    g.add(PG.rect(26, 26, W - 52, H - 52, undefined, {
      stroke: 'rgba(157,246,255,0.16)', strokeWidth: 2
    }));
    g.add(PG.rect(38, 38, W - 76, H - 76, undefined, {
      stroke: 'rgba(157,246,255,0.07)', strokeWidth: 1
    }));
    [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(function (p) {
      g.add(PG.pip(p[0], p[1], 2.2, 'rgba(157,246,255,0.5)'));
    });
  };

  function tag(g, x, y, w, color) {
    g.add(PG.rect(x, y, w, 4, PG.rgba(color, 0.55)));
    g.add(PG.rect(x, y + 9, w * 0.55, 3, PG.rgba(color, 0.28)));
  }

  /* =========================================================== СТРАНИЦА 01
     Тихий океан. Глубина 10 994 м. Станция — искра внизу.
     ======================================================================== */
  S.p01 = function () {
    const g = S.shell([
      0, '#0a2530', 0.16, '#071a23', 0.42, '#04121a', 0.75, '#020b11', 1, '#010508'
    ], 101);

    // столбы света сверху
    const rays = PG.group();
    const rr = PG.rng(31);
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * 135 + rr() * 60;
      const w = 40 + rr() * 110;
      rays.add(PG.poly([x, -20, x + w, -20, x + w * 2.4 + 120, 900, x + 20, 900], undefined, {
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: 900 },
        fillLinearGradientColorStops: [0, PG.rgba(C.cyan, 0.10 + rr() * 0.07), 1, PG.rgba(C.cyan, 0)]
      }));
    }
    g.add(rays);

    // поверхность — волнистая кромка света
    g.add(PG.waves({ x: 0, y: 40, w: W, rows: 4, gap: 16, amp: 7, color: C.ice, alpha: 0.22, wl: 210, seed: 4 }));

    // взвесь
    g.add(PG.speckles({
      x0: 0, y0: 100, x1: W, y1: 1500, count: 160, seed: 77,
      color: C.ice, minA: 0.03, maxA: 0.3, minR: 0.5, maxR: 2.6, halo: true
    }));

    // склоны жёлоба
    g.add(PG.poly([0, 1020, 150, 1120, 90, 1280, 210, 1420, 120, 1600, 0, 1660], '#020c11'));
    g.add(PG.poly([0, 1180, 160, 1240, 120, 1400, 220, 1520, 130, 1800, 0, 1800], '#010709'));
    g.add(PG.poly([W, 980, 1040, 1100, 1110, 1240, 980, 1390, 1070, 1570, W, 1640], '#020c11'));
    g.add(PG.poly([W, 1160, 1030, 1230, 1080, 1380, 960, 1510, 1050, 1800, W, 1800], '#010709'));
    // светящиеся кромки склонов
    g.add(PG.path('M0 1020 L150 1120 L90 1280 L210 1420', 'rgba(57,224,210,0.18)', 2));
    g.add(PG.path('M1200 980 L1040 1100 L1110 1240 L980 1390', 'rgba(57,224,210,0.16)', 2));

    // станция на дне — крошечная искра
    const st = PG.group({ x: 610, y: 1360 });
    st.add(PG.glow(0, 0, 190, C.teal, 0.3));
    st.add(PG.glow(0, 0, 70, C.ice, 0.4));
    st.add(PG.rect(-46, -16, 92, 20, '#07171d'));
    st.add(PG.rect(-30, -34, 22, 18, '#0a1e25'));
    st.add(PG.rect(14, -30, 16, 14, '#0a1e25'));
    st.add(PG.circle(0, -40, 14, undefined, { stroke: PG.rgba(C.teal, 0.6), strokeWidth: 2 }));
    st.add(PG.line([-60, 4, 60, 4], PG.rgba(C.steel3, 0.5), 2));
    [[-40, -6], [-14, -10], [12, -8], [36, -12], [0, -46]].forEach(function (p) {
      st.add(PG.circle(p[0], p[1], 2.2, C.gold, { shadowColor: C.gold, shadowBlur: 10 }));
    });
    g.add(st);
    g.add(PG.rings(610, 1360, 3, 90, C.teal, 0.10));
    g.add(PG.bubbles(610, 1340, 14, { height: 420, spread: 90, maxR: 6, seed: 8 }));

    // дальняя живность: контурные тени в толще воды
    const life = PG.group({ opacity: 0.5 });
    life.add(PG.path('M120 620 C170 600 230 606 250 620 C230 634 170 640 120 620 Z', { fill: '#02090d' }, 0, { closed: true, fill: '#02090d' }));
    life.add(PG.poly([250, 620, 300, 596, 292, 620, 300, 644], '#02090d'));
    life.add(PG.path('M900 500 C960 476 1030 484 1054 500 C1030 516 960 524 900 500 Z', { fill: '#02090d' }, 0, { closed: true, fill: '#02090d' }));
    life.add(PG.poly([1054, 500, 1108, 474, 1098, 500, 1108, 526], '#02090d'));
    g.add(life);
    // приманка глубоководной твари
    g.add(PG.path('M1080 1290 C1040 1250 1000 1260 980 1290', 'rgba(4,18,22,0.9)', 26));
    g.add(PG.circle(978, 1292, 6, C.teal, { shadowColor: C.teal, shadowBlur: 30 }));
    g.add(PG.glow(978, 1292, 90, C.teal, 0.18));
    // донный ил
    g.add(PG.murk(0, 1420, W, 380, '#0a2a30', 8, 12, 0.16));
    g.add(PG.speckles({ x0: 0, y0: 1450, x1: W, y1: 1800, count: 90, seed: 44, color: C.fog, minA: 0.03, maxA: 0.14 }));
    g.add(PG.vignette(0.9));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 02
     Станция «Генезис-1» снаружи. Реактор, кольцо, прожекторы.
     ======================================================================== */
  S.p02 = function () {
    const g = S.shell([0, '#020a0e', 0.5, '#04121a', 1, '#010609'], 202);

    // скала за станцией
    g.add(PG.poly([-40, 1800, -40, 300, 180, 210, 400, 340, 520, 250, 700, 420, 960, 300, 1120, 480, 1240, 380, 1240, 1800], '#030d12'));
    g.add(PG.poly([-40, 1800, -40, 520, 260, 620, 420, 540, 640, 760, 900, 700, 1080, 900, 1240, 860, 1240, 1800], '#020a0f'));
    g.add(PG.cracks({ x: 60, y: 560, w: 1100, h: 700, lines: 9, color: C.steel, alpha: 0.22, seed: 61, width: 2.4 }));

    // корпус: центральная сфера реактора
    const cx = 690, cy = 780;
    g.add(PG.line([cx, cy - 210, cx, cy - 70], C.steel2, 16));      // подвес
    g.add(PG.circle(cx, cy, 250, '#08202a'));
    g.add(PG.circle(cx, cy, 250, undefined, PG.radial(250, [0, 'rgba(57,224,210,0.16)', 0.72, 'rgba(6,26,32,0.6)', 1, 'rgba(3,10,14,0.95)'])));
    g.add(PG.circle(cx, cy, 250, undefined, { stroke: C.steel3, strokeWidth: 4 }));
    g.add(PG.circle(cx, cy, 226, undefined, { stroke: 'rgba(43,107,120,0.5)', strokeWidth: 2 }));
    // меридианы сферы
    [-150, -90, -30, 30, 90, 150].forEach(function (dx) {
      g.add(PG.ellipse(cx, cy, Math.abs(dx) + 10, 226, undefined, {
        stroke: 'rgba(57,224,210,0.10)', strokeWidth: 1.6
      }));
    });
    g.add(PG.ellipse(cx, cy, 226, 60, undefined, { stroke: 'rgba(57,224,210,0.12)', strokeWidth: 1.6 }));
    // окна реактора
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      g.add(PG.circle(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, 15, C.ink));
      g.add(PG.circle(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, 7, C.teal, { shadowColor: C.teal, shadowBlur: 22 }));
    }
    g.add(PG.glow(cx, cy, 330, C.teal, 0.16));

    // жилое кольцо
    g.add(PG.ellipse(cx, cy + 90, 470, 150, undefined, { stroke: C.steel, strokeWidth: 30 }));
    g.add(PG.ellipse(cx, cy + 90, 470, 150, undefined, { stroke: 'rgba(43,107,120,0.55)', strokeWidth: 4 }));
    g.add(PG.ellipse(cx, cy + 90, 470, 150, undefined, { stroke: C.ink, strokeWidth: 8 }));
    // модули на кольце
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.12 + i * 0.32;
      const px = cx + Math.cos(a) * 470;
      const py = cy + 90 + Math.sin(a) * 150;
      g.add(PG.rect(px - 26, py - 20, 52, 44, '#0c2832'));
      g.add(PG.rect(px - 18, py - 8, 36, 5, PG.rgba(C.gold, 0.75)));
    }
    // надстройка + мачта
    g.add(PG.panel(cx - 120, cy + 220, 240, 190, { fill: '#0a232c', edge: C.steel3, rivets: true, grad: [0, '#0e2c36', 1, '#071a21'] }));
    g.add(PG.rect(cx - 40, cy + 300, 80, 110, '#04141a'));
    g.add(PG.rect(cx - 30, cy + 310, 60, 8, PG.rgba(C.amber, 0.5)));
    g.add(PG.line([cx + 70, cy + 230, cx + 70, cy - 220], C.steel2, 10));
    g.add(PG.line([cx - 70, cy + 230, cx - 70, cy - 180], C.steel, 6));
    g.add(PG.circle(cx + 70, cy - 232, 12, C.red, { shadowColor: C.red, shadowBlur: 30 }));
    g.add(PG.circle(cx - 70, cy - 190, 7, C.gold, { shadowColor: C.gold, shadowBlur: 18 }));
    g.add(PG.rings(cx + 70, cy - 232, 4, 26, C.red, 0.18));

    // причальная ферма слева
    g.add(PG.truss(60, 980, 380, 90, C.steel, 76));
    g.add(PG.line([60, 1024, -40, 1080], C.steel2, 12));
    g.add(PG.line([440, 1024, 560, 1080], C.steel2, 12));
    g.add(PG.panel(80, 860, 120, 110, { fill: '#0a2029', edge: C.steel3, rivets: true }));
    g.add(PG.rect(96, 880, 88, 10, PG.rgba(C.cyan, 0.5)));

    // прожекторы в воду
    [[300, 780, -0.9], [980, 700, 0.5], [1060, 1120, 0.2]].forEach(function (p) {
      g.add(PG.circle(p[0], p[1], 13, C.ink));
      g.add(PG.circle(p[0], p[1], 7, C.ice, { shadowColor: C.ice, shadowBlur: 30 }));
      const len = 760;
      g.add(PG.poly([
        p[0] - 20, p[1],
        p[0] + 20, p[1],
        p[0] + Math.sin(p[2] + 0.22) * len, p[1] + Math.cos(p[2] + 0.22) * len,
        p[0] + Math.sin(p[2] - 0.22) * len, p[1] + Math.cos(p[2] - 0.22) * len
      ], undefined, {
        fillLinearGradientStartPoint: { x: p[0], y: p[1] },
        fillLinearGradientEndPoint: { x: p[0], y: p[1] + len },
        fillLinearGradientColorStops: [0, 'rgba(217,251,255,0.13)', 1, 'rgba(217,251,255,0)']
      }));
    });

    // пузыри от станции
    g.add(PG.bubbles(760, 1220, 26, { height: 900, spread: 420, maxR: 9, seed: 55 }));
    g.add(PG.bubbles(300, 1080, 12, { height: 700, spread: 220, maxR: 6, seed: 56 }));

    // рыба-тень вдали
    g.add(PG.path('M1040 470 C1080 450 1130 458 1150 470 C1130 482 1080 490 1040 470 Z', PG.rgba('#031015', 0.9), 0, { closed: true, fill: '#031015' }));
    g.add(PG.poly([1150, 470, 1186, 448, 1180, 470, 1186, 492], '#031015'));

    g.add(PG.murk(0, 1200, W, 600, '#061e26', 7, 15, 0.16));
    g.add(PG.vignette(0.95));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 03
     Коридор. Два брата идут к реактору.
     ======================================================================== */
  S.p03 = function () {
    const g = S.shell([0, '#061720', 0.5, '#041018', 1, '#02080c'], 303);
    const vx = 640, vy = 830;

    // перспектива коридора
    g.add(PG.room({
      vx: vx, vy: vy, backW: 340, backH: 520,
      backFill: '#0a2630', ceil: '#04121a', floor: '#061620',
      left: '#071c25', right: '#051820',
      backGrad: [0, '#0e3340', 0.55, '#082029', 1, '#041218']
    }));
    // пол: блик
    g.add(PG.poly([vx - 170, vy + 260, vx + 170, vy + 260, W, H, 0, H], undefined, PG.vgrad([0, 'rgba(57,224,210,0.16)', 1, 'rgba(57,224,210,0)'], 700)));
    // рёбра
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const x0 = PG.lerp(0, vx - 170, t), x1 = PG.lerp(W, vx + 170, t);
      const yTop = PG.lerp(0, vy - 260, t), yBot = PG.lerp(H, vy + 260, t);
      g.add(PG.rect(x0, yTop, x1 - x0, 16, '#0a2a34'));
      g.add(PG.rect(x0, yBot - 16, x1 - x0, 16, '#071e26'));
      g.add(PG.rect(x0, yTop, 16, yBot - yTop, '#092430', { opacity: 0.7 }));
      g.add(PG.rect(x1 - 16, yTop, 16, yBot - yTop, '#071f28', { opacity: 0.7 }));
      if (i > 1) {
        g.add(PG.glow(x0 + (x1 - x0) / 2, yTop + 6, 180 - i * 12, C.cyan, 0.10));
      }
    }
    // лампы на потолке
    [0.18, 0.38, 0.56, 0.7].forEach(function (t, i) {
      const x0 = PG.lerp(0, vx - 170, t), x1 = PG.lerp(W, vx + 170, t);
      const y = PG.lerp(0, vy - 260, t) + 8;
      g.add(PG.rect(x0 + 60, y - 6, (x1 - x0) * 0.44, 10, PG.rgba(C.ice, 0.75), { shadowColor: C.cyan, shadowBlur: 30 }));
    });
    // трубы по стенам
    g.add(PG.pipes([0, 250, 190, 510, 190, 760, 420, 700], 12, C.steel2));
    g.add(PG.pipes([0, 380, 210, 600, 210, 860, 380, 940], 8, C.steel));
    g.add(PG.pipes([W, 200, 1000, 500, 1000, 720, 860, 690], 14, C.steel2));
    g.add(PG.pipes([W, 1420, 1010, 1180, 880, 1140], 10, C.steel));
    // стойки с кабелями
    for (let i = 0; i < 5; i++) {
      const t = 0.15 + i * 0.17;
      const y = PG.lerp(H, vy + 260, t);
      const xl = PG.lerp(0, vx - 170, t);
      const xr = PG.lerp(W, vx + 170, t);
      g.add(PG.line([xl + 20, y, xl + 20, y - 260 * (1 - t) - 90], C.steel, 4, { opacity: 0.5 }));
      g.add(PG.line([xr - 20, y, xr - 20, y - 260 * (1 - t) - 90], C.steel, 4, { opacity: 0.4 }));
    }
    // пар и мгла
    g.add(PG.murk(0, 1200, W, 600, '#0a3d46', 6, 19, 0.14));

    // аварийные лампы
    [260, 1000].forEach(function (x, i) {
      g.add(PG.circle(x, 300, 9, C.red, { shadowColor: C.red, shadowBlur: 26 }));
      g.add(PG.glow(x, 300, 120, C.red, 0.18));
    });

    // фигуры идут к реактору, спинами к нам
    // световой карман у шлюза — чтобы силуэты читались
    g.add(PG.glow(vx, vy + 210, 520, C.amber, 0.16, { scaleY: 0.5 }));
    g.add(PG.glow(560, 1180, 420, C.cyan, 0.10));
    g.add(F.nullar({ x: 700, y: 1290, scale: 0.8, flip: true, rim: C.violet, eye: C.violet }));
    g.add(F.krakentaus({ x: 520, y: 1310, scale: 0.82, rim: C.teal, tentacles: 3, tentAlpha: 0.55 }));
    // их отражения/тени в полу
    g.add(PG.ellipse(520, 1320, 90, 16, 'rgba(0,0,0,0.5)'));
    g.add(PG.ellipse(700, 1300, 90, 16, 'rgba(0,0,0,0.5)'));
    // дверь-шлюз в конце
    g.add(PG.doorway(vx - 80, vy - 130, 160, 300, { fill: '#020a0e', glow: C.amber }));
    g.add(PG.circle(vx, vy + 60, 26, undefined, { stroke: PG.rgba(C.amber, 0.6), strokeWidth: 4 }));

    g.add(PG.vignette(0.92));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 04
     Реакторный зал. Нуллар сверху, Кракентаус на нижнем ярусе.
     ======================================================================== */
  S.p04 = function () {
    const g = S.shell([0, '#0a1a1e', 0.4, '#061114', 1, '#020708'], 404);

    // реактор — вертикальный цилиндр
    const cx = 600, top = 180, bot = 1180, hw = 210;
    g.add(PG.glow(cx, (top + bot) / 2, 520, C.amber, 0.16));
    g.add(PG.rect(cx - hw - 50, top - 40, (hw + 50) * 2, bot - top + 90, '#0a1c20'));
    g.add(PG.rect(cx - hw, top, hw * 2, bot - top, undefined, PG.hgrad([
      0, '#06161a', 0.2, '#0d2b31', 0.5, '#123a41', 0.8, '#0a2228', 1, '#050f13'
    ], hw * 2)));
    g.add(PG.rect(cx - 26, top + 40, 52, bot - top - 80, PG.rgba(C.amber, 0.75), { shadowColor: C.amber, shadowBlur: 60 }));
    g.add(PG.rect(cx - 93, top + 40, 24, bot - top - 80, PG.rgba(C.amber, 0.3), { shadowColor: C.amber, shadowBlur: 30 }));
    g.add(PG.rect(cx + 69, top + 40, 24, bot - top - 80, PG.rgba(C.amber, 0.3), { shadowColor: C.amber, shadowBlur: 30 }));
    // сегменты корпуса
    for (let y = top + 20; y < bot; y += 120) {
      g.add(PG.rect(cx - hw - 14, y, hw * 2 + 28, 18, '#123037'));
      g.add(PG.rect(cx - hw - 14, y, hw * 2 + 28, 4, 'rgba(120,180,190,0.25)'));
      g.add(PG.rivets(cx - hw - 14, y, hw * 2 + 28, 18, C.steel3, 34));
    }
    // верхний купол
    g.add(PG.ellipse(cx, top, hw + 40, 90, '#0b242b'));
    g.add(PG.ellipse(cx, top, hw + 40, 90, undefined, { stroke: C.steel3, strokeWidth: 3 }));
    g.add(PG.rect(cx - 60, top - 150, 120, 150, '#0a2026'));
    g.add(PG.rect(cx - 40, top - 140, 80, 12, PG.rgba(C.amber, 0.5)));
    // основание
    g.add(PG.rect(cx - hw - 90, bot, (hw + 90) * 2, 90, '#081a1f'));
    g.add(PG.rect(cx - hw - 90, bot, (hw + 90) * 2, 10, PG.rgba(C.amber, 0.35)));

    // верхний ярус — мостки
    g.add(PG.rect(0, 430, 380, 26, '#0a2228'));
    g.add(PG.truss(0, 456, 380, 60, C.steel, 64));
    g.add(PG.line([380, 443, cx - hw - 40, 443], C.steel, 8));
    g.add(PG.rect(0, 410, 380, 10, PG.rgba(C.cyan, 0.3)));
    // нижние мостки
    g.add(PG.rect(760, 1160, 440, 28, '#0a2228'));
    g.add(PG.truss(760, 1188, 440, 70, C.steel, 70));
    g.add(PG.line([760, 1174, cx + hw + 40, 1174], C.steel, 8));
    // перила
    for (let i = 0; i < 10; i++) {
      g.add(PG.line([30 + i * 38, 430, 30 + i * 38, 350], 'rgba(43,107,120,0.8)', 3));
      g.add(PG.line([770 + i * 44, 1160, 770 + i * 44, 1080], 'rgba(43,107,120,0.8)', 3));
    }
    g.add(PG.line([20, 350, 390, 350], 'rgba(57,224,210,0.4)', 3));
    g.add(PG.line([760, 1080, 1200, 1080], 'rgba(57,224,210,0.35)', 3));

    // лестницы
    for (let i = 0; i < 12; i++) {
      g.add(PG.rect(300 + i * 12, 470 + i * 60, 120, 8, '#0d2b33', { opacity: 0.9 }));
    }
    // подъёмный кран-балка
    g.add(PG.rect(0, 130, W, 26, '#0a2026'));
    g.add(PG.text('', 0, 0));
    g.add(PG.line([cx, 156, cx, 180], C.steel, 8));

    // аварийное освещение
    [[140, 250], [1060, 250], [240, 1240], [1020, 1300]].forEach(function (p) {
      g.add(PG.circle(p[0], p[1], 10, C.red, { shadowColor: C.red, shadowBlur: 30 }));
      g.add(PG.glow(p[0], p[1], 150, C.red, 0.2));
    });
    g.add(PG.rect(0, 0, W, H, undefined, PG.radial(760, [0, 'rgba(255,179,71,0.10)', 0.5, 'rgba(120,40,20,0.05)', 1, 'rgba(0,0,0,0)'], 600, 760)));

    // фигуры: Нуллар наверху, Кракентаус внизу
    // контровой свет от реактора
    g.add(PG.glow(300, 330, 300, C.violet, 0.22));
    g.add(PG.glow(930, 1070, 320, C.teal, 0.20));
    g.add(F.nullar({ x: 262, y: 430, scale: 0.98, rim: C.violet, eye: C.violet }));
    g.add(F.krakentaus({ x: 918, y: 1162, scale: 1.02, flip: true, rim: C.teal, tentacles: 4, bleedTent: true }));

    // пар у пола
    g.add(PG.murk(0, 1320, W, 400, '#2a2018', 7, 23, 0.18));
    g.add(PG.drips(80, 0, W - 160, 160, '#2a1a10', 41, 10));
    g.add(PG.vignette(0.9));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 05
     Кракентаус заперт за стеклом. Нуллар у метеорита.
     ======================================================================== */
  S.p05 = function () {
    const g = S.shell([0, '#071d22', 0.45, '#041116', 1, '#020709'], 505);

    // лаборатория: панельная стена
    g.add(PG.rect(0, 0, W, H, undefined, PG.vgrad([0, '#082028', 1, '#030d11'], H)));
    for (let x = 0; x < W; x += 96) {
      g.add(PG.rect(x, 0, 2, H, 'rgba(43,107,120,0.16)'));
    }
    for (let y = 0; y < H; y += 96) {
      g.add(PG.rect(0, y, W, 2, 'rgba(43,107,120,0.12)'));
    }
    // кафель с грязью
    g.add(PG.drips(0, 0, W, 300, '#123', 71, 16));

    // стеклянная камера справа: Кракентаус внутри
    const gx = 620, gy = 430, gw = 500, gh = 780;
    g.add(PG.glow(gx + gw / 2, gy + gh / 2, 520, C.red, 0.14));
    g.add(PG.rect(gx - 30, gy - 30, gw + 60, gh + 60, '#0c252c'));
    g.add(PG.rect(gx - 14, gy - 14, gw + 28, gh + 28, C.ink));
    g.add(PG.rect(gx, gy, gw, gh, undefined, PG.vgrad([0, 'rgba(20,60,70,0.55)', 1, 'rgba(5,16,20,0.85)'], gh)));
    // прутья решётки
    for (let i = 1; i < 6; i++) {
      g.add(PG.rect(gx + (gw / 6) * i, gy, 4, gh, PG.rgba(C.steel3, 0.35)));
    }
    g.add(PG.glass(gx, gy, gw, gh));
    // Кракентаус за стеклом, бьёт ладонью
    g.add(F.krakentaus({ x: gx + 250, y: gy + gh - 30, scale: 0.86, rim: C.teal, tentacles: 5, look: -0.6, bleedTent: false }));
    g.add(PG.glow(gx + 250, gy + gh - 30, 240, C.teal, 0.16));
    // трещина стекла
    g.add(PG.path('M' + (gx + 300) + ' ' + (gy + 380) + ' L' + (gx + 270) + ' ' + (gy + 440) + ' L' + (gx + 320) + ' ' + (gy + 500) + ' L' + (gx + 280) + ' ' + (gy + 560), 'rgba(217,251,255,0.4)', 2));
    g.add(PG.path('M' + (gx + 300) + ' ' + (gy + 380) + ' L' + (gx + 350) + ' ' + (gy + 430), 'rgba(217,251,255,0.25)', 1.6));
    // отпечаток ладони
    g.add(PG.ellipse(gx + 300, gy + 560, 30, 38, 'rgba(157,246,255,0.12)'));
    // рама
    g.add(PG.rect(gx - 30, gy - 30, gw + 60, 12, C.steel3));
    g.add(PG.rect(gx - 30, gy + gh + 18, gw + 60, 12, C.steel3));

    // консоль блокировки справа от камеры
    g.add(PG.panel(1080, 700, 120, 260, { fill: '#0d2830', edge: C.steel3, rivets: true }));
    g.add(PG.rect(1096, 720, 88, 44, C.ink));
    g.add(PG.rect(1104, 728, 72, 28, PG.rgba(C.red, 0.35)));
    g.add(PG.circle(1106, 820, 9, C.red, { shadowColor: C.red, shadowBlur: 24 }));
    g.add(PG.rect(1120, 812, 52, 6, C.steel2));
    g.add(PG.rect(1120, 860, 52, 6, C.steel2));

    // Нуллар у пьедестала слева
    g.add(F.nullar({ x: 300, y: 1480, scale: 0.98, rim: C.violet, eye: C.violet, look: 0.4 }));

    // метеорит на пьедестале
    const mx = 250, my = 1080;
    g.add(PG.rect(mx - 130, my + 200, 260, 220, '#0a2228'));
    g.add(PG.rect(mx - 150, my + 190, 300, 24, '#12343c'));
    g.add(PG.glow(mx, my, 300, C.teal, 0.2));
    g.add(PG.poly([
      mx - 120, my + 150, mx - 150, my + 40, mx - 70, my - 60, mx + 10, my - 90,
      mx + 100, my - 40, mx + 140, my + 60, mx + 60, my + 150
    ], '#101c1f'));
    g.add(PG.poly([
      mx - 90, my + 120, mx - 110, my + 30, mx - 40, my - 30, mx + 20, my - 50,
      mx + 80, my - 10, mx + 90, my + 70, mx + 30, my + 120
    ], '#16272b'));
    // светящиеся вкрапления
    const rr = PG.rng(33);
    for (let i = 0; i < 18; i++) {
      const px = mx - 90 + rr() * 170;
      const py = my - 40 + rr() * 130;
      g.add(PG.circle(px, py, 1.4 + rr() * 3, PG.rgba(C.teal, 0.35 + rr() * 0.55), { shadowColor: C.teal, shadowBlur: 12 }));
    }
    g.add(PG.rings(mx, my + 20, 4, 70, C.teal, 0.14));
    // манипулятор-сканер над метеоритом
    g.add(PG.line([mx + 210, 0, mx + 210, my - 120], C.steel, 12));
    g.add(PG.line([mx + 210, my - 120, mx + 40, my - 120], C.steel, 10));
    g.add(PG.rect(mx - 20, my - 140, 120, 40, '#123039'));
    g.add(PG.rect(mx - 8, my - 128, 96, 8, PG.rgba(C.teal, 0.75), { shadowColor: C.teal, shadowBlur: 24 }));

    // аварийная подсветка
    g.add(PG.rect(0, 0, W, H, undefined, PG.radial(900, [0, 'rgba(255,61,51,0.10)', 1, 'rgba(0,0,0,0)'], 860, 820)));
    g.add(PG.vignette(0.9));
    S.frame(g);
    return g;
  };

})(window);
