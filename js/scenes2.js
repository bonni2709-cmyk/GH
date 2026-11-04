/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — сцены тома 01 (страницы 6–10)
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const C = PG.C;
  const W = PG.W, H = PG.H;
  const S = PG.S;
  const F = PG.fig;

  /* =========================================================== СТРАНИЦА 06
     Кракентаус колотит в стекло. Нуллар поворачивает ключ.
     ======================================================================== */
  S.p06 = function () {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, [0, '#0b0a10', 0.35, '#140a0c', 0.7, '#0d0507', 1, '#050203']));
    // тревожный свет
    g.add(PG.rect(0, 0, W, H, undefined, PG.radial(900, [0, 'rgba(255,61,51,0.20)', 0.45, 'rgba(180,30,20,0.10)', 1, 'rgba(0,0,0,0)'], 600, 900)));

    // корпус камеры: рама
    g.add(PG.rect(0, 0, W, H, undefined, PG.vgrad([0, 'rgba(10,30,36,0.5)', 1, 'rgba(2,6,8,0.9)'], H)));
    const gx = 70, gy = 190, gw = 700, gh = 1080;
    g.add(PG.rect(gx - 34, gy - 34, gw + 68, gh + 68, '#0e2a32'));
    g.add(PG.rect(gx - 34, gy - 34, gw + 68, 16, C.steel3));
    g.add(PG.rivets(gx - 34, gy - 34, gw + 68, gh + 68, C.steel3, 52));
    g.add(PG.rect(gx - 18, gy - 18, gw + 36, gh + 36, '#02080a'));
    g.add(PG.rect(gx, gy, gw, gh, undefined, PG.vgrad([0, 'rgba(40,90,100,0.5)', 1, 'rgba(4,14,18,0.9)'], gh)));

    // Кракентаус внутри, бьёт по стеклу
    g.add(PG.glow(gx + 360, gy + 800, 520, C.teal, 0.16));
    g.add(F.krakentaus({ x: gx + 360, y: gy + 1010, scale: 1.24, rim: C.teal, tentacles: 6, look: 0.55, tentAlpha: 0.9 }));
    // кулак ударен в стекло
    g.add(PG.ellipse(gx + 470, gy + 520, 74, 58, 'rgba(157,246,255,0.14)'));
    // брызги/вмятины
    g.add(PG.burst(gx + 470, gy + 520, 150, 14, C.ice, 0.5));

    // разбитое стекло: белая паутина
    const cracks = [
      'M470 520 L430 430 L450 340', 'M470 520 L540 450 L600 400',
      'M470 520 L560 560 L650 540', 'M470 520 L420 600 L380 680',
      'M470 520 L500 640 L520 740', 'M470 520 L380 500 L300 470',
      'M470 520 L400 560 L340 540'
    ];
    cracks.forEach(function (d, i) {
      g.add(PG.path(d, PG.rgba(C.ice, 0.55 - i * 0.04), 2.6));
    });
    g.add(PG.rings(gx + 470, gy + 520, 3, 44, C.ice, 0.25));

    // рама: перекладины
    [0.34, 0.68].forEach(function (t) {
      g.add(PG.rect(gx, gy + gh * t, gw, 14, '#0a2028'));
    });
    g.add(PG.rect(gx + gw * 0.5, gy, 10, gh, PG.rgba(C.steel3, 0.5)));
    g.add(PG.glass(gx, gy, gw, gh));

    // отражение Нуллара в стекле — маленькая фигура справа
    g.add(F.nullar({ x: 980, y: 1520, scale: 1.22, rim: C.violet, eye: C.violet, look: -0.6 }));

    // пульт с ключом перед ним
    g.add(PG.panel(820, 1080, 340, 300, { fill: '#0b2229', edge: C.steel3, rivets: true, grad: [0, '#123039', 1, '#061418'] }));
    g.add(PG.rect(840, 1100, 300, 90, C.ink));
    g.add(PG.waveform(850, 1120, 280, 50, PG.rgba(C.red, 0.7), 9, 30));
    g.add(PG.rect(860, 1230, 260, 10, PG.rgba(C.amber, 0.35)));
    // ключ
    g.add(PG.rect(940, 1260, 46, 80, C.steel2));
    g.add(PG.rect(948, 1268, 30, 20, C.red, { shadowColor: C.red, shadowBlur: 26 }));
    g.add(PG.circle(963, 1338, 9, C.ink));

    // рука Нуллара на ключе
    g.add(PG.path('M1150 1560 C1140 1500 1120 1440 1040 1400 C1000 1380 980 1360 976 1340', '#1d3a40', 40));
    g.add(PG.circle(978, 1336, 22, '#25454c'));

    // аварийный текст на стене (геометрия/трафарет, без диегетических подписей сюжета)
    g.add(PG.corners(830, 200, 316, 150, 22, C.red, 0.5));
    g.add(PG.rect(860, 260, 260, 6, PG.rgba(C.red, 0.7)));
    g.add(PG.rect(860, 280, 180, 4, PG.rgba(C.red, 0.4)));

    // пар
    g.add(PG.murk(0, 0, W, H, '#3a2020', 8, 17, 0.12));
    g.add(PG.scanlines({ alpha: 0.10, gap: 6 }));
    g.add(PG.vignette(0.95, '#1a0204'));
    g.add(PG.rect(26, 26, W - 52, H - 52, undefined, { stroke: 'rgba(255,61,51,0.28)', strokeWidth: 3 }));
    g.add(PG.rect(38, 38, W - 76, H - 76, undefined, { stroke: 'rgba(255,61,51,0.10)', strokeWidth: 1 }));
    return g;
  };

  /* =========================================================== СТРАНИЦА 07
     Взрыв. Ударная волна сминает коридор.
     ======================================================================== */
  S.p07 = function () {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, [0, '#f4f6ef', 0.18, '#c9d6cf', 0.34, '#5f6b66', 0.55, '#1c1d1b', 0.8, '#0a0806', 1, '#030202']));

    // ядро взрыва
    const cx = 600, cy = 760;
    g.add(PG.glow(cx, cy, 900, C.gold, 0.55));
    g.add(PG.glow(cx, cy, 420, C.white, 0.75));
    g.add(PG.burst(cx, cy, 900, 46, C.gold, 0.55));
    g.add(PG.burst(cx, cy, 620, 34, C.white, 0.6));
    g.add(PG.rings(cx, cy, 7, 110, C.gold, 0.35));
    g.add(PG.group({ x: cx, y: cy }).add(PG.circle(0, 0, 150, undefined, PG.radial(150, [
      0, 'rgba(255,255,255,1)', 0.5, 'rgba(255,224,138,0.85)', 1, 'rgba(255,122,47,0)'
    ]))));

    // сминаемый коридор
    const vx = 600, vy = 900;
    g.add(PG.poly([0, 0, W, 0, vx + 120, vy - 300, vx - 120, vy - 300], '#3a4440'));
    g.add(PG.poly([0, H, W, H, vx + 120, vy + 300, vx - 120, vy + 300], '#20241f'));
    g.add(PG.poly([0, 0, vx - 120, vy - 300, vx - 120, vy + 300, 0, H], '#2b302b'));
    g.add(PG.poly([W, 0, vx + 120, vy - 300, vx + 120, vy + 300, W, H], '#1b1f1b'));

    // рваные листы металла
    [[80, 180, -30], [1020, 120, 22], [140, 1500, 18], [1060, 1440, -25]].forEach(function (p) {
      g.add(PG.poly([p[0], p[1] - 140, p[0] + 210, p[1] - 60, p[0] + 150, p[1] + 120, p[0] - 40, p[1] + 60], '#2f3a36', { rotation: p[2] }));
      g.add(PG.poly([p[0], p[1] - 140, p[0] + 210, p[1] - 60, p[0] + 150, p[1] + 120, p[0] - 40, p[1] + 60], undefined, {
        stroke: 'rgba(255,224,138,0.35)', strokeWidth: 3, rotation: p[2]
      }));
    });
    // летящие обломки
    const rr = PG.rng(87);
    for (let i = 0; i < 46; i++) {
      const a = rr() * Math.PI * 2;
      const r = 220 + rr() * 760;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.85;
      const s = 6 + rr() * 30;
      g.add(PG.poly([x, y, x + s, y - s * 0.5, x + s * 0.7, y + s * 0.8, x - s * 0.2, y + s * 0.4], i % 5 === 0 ? '#6a3a1a' : '#232a26', { rotation: rr() * 90 }));
      if (i % 4 === 0) g.add(PG.glow(x, y, s * 3, C.gold, 0.2));
    }

    // силуэт Хантера, отброшенного волной
    g.add(PG.glow(310, 1270, 300, C.gold, 0.18));
    g.add(PG.group({ x: 300, y: 1330, scaleX: 1.22, scaleY: 1.22, rotation: -26 }).add(
      F.hunter({ scale: 1, sil: '#0a1214', rim: C.gold, eye: C.gold, rifle: true, shadow: false })
    ));

    // волна
    g.add(PG.rings(cx, cy, 11, 82, '#ffffff', 0.30));
    g.add(PG.scanlines({ alpha: 0.06, gap: 7, color: '#000' }));
    g.add(PG.speckles({ x0: 0, y0: 0, x1: W, y1: H, count: 140, seed: 19, color: '#fff8e0', minA: 0.05, maxA: 0.5, minR: 0.6, maxR: 3 }));
    g.add(PG.vignette(0.9, '#0a0503'));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 08
     Медотсек. Лира с забинтованной головой слышит станцию.
     ======================================================================== */
  S.p08 = function () {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, [0, '#061418', 0.4, '#04100e', 1, '#020807']));

    // стены лазарета
    for (let x = 0; x < W; x += 120) {
      g.add(PG.rect(x, 0, 3, H, 'rgba(43,107,120,0.12)'));
    }
    for (let y = 120; y < H; y += 120) {
      g.add(PG.rect(0, y, W, 3, 'rgba(43,107,120,0.08)'));
    }
    g.add(PG.rect(0, 0, W, 520, undefined, PG.vgrad([0, 'rgba(43,107,120,0.16)', 1, 'rgba(0,0,0,0)'], 520)));

    // койка
    g.add(PG.rect(120, 1080, 960, 60, '#0d2830'));
    g.add(PG.rect(120, 1140, 960, 80, '#081a20'));
    g.add(PG.rect(120, 1220, 40, 420, C.steel));
    g.add(PG.rect(1040, 1220, 40, 420, C.steel));
    g.add(PG.rect(160, 1200, 880, 20, PG.rgba(C.steel3, 0.4)));
    g.add(PG.ellipse(300, 1060, 90, 34, '#e6eff0', { opacity: 0.18 }));

    // капельница
    g.add(PG.line([1000, 300, 1000, 900], C.steel3, 4));
    g.add(PG.rect(968, 300, 64, 120, undefined, { stroke: C.steel3, strokeWidth: 3 }));
    g.add(PG.rect(974, 330, 52, 84, PG.rgba(C.teal, 0.25)));
    g.add(PG.path('M1000 420 C1000 520 960 640 940 740', PG.rgba(C.teal, 0.4), 3));

    // Лира сидит на койке
    g.add(PG.glow(520, 930, 300, C.cyan, 0.14));
    g.add(F.lyra({ x: 520, y: 1090, scale: 1.5, rim: C.cyan, look: 0.2, sonar: true }));

    // бинт на голове
    g.add(PG.path('M430 890 C470 860 560 856 600 884', '#e3ecec', 16, { opacity: 0.9 }));
    g.add(PG.path('M440 910 C480 884 556 880 596 904', '#cfdada', 10, { opacity: 0.7 }));

    // «эхо» станции: концентрические дуги, план станции
    const ex = 520, ey = 850;
    g.add(PG.rings(ex, ey, 6, 108, C.cyan, 0.15));
    g.add(PG.rings(ex, ey, 11, 54, C.cyan, 0.07));
    // схема станции из линий
    g.add(PG.circle(880, 420, 120, undefined, { stroke: PG.rgba(C.cyan, 0.25), strokeWidth: 2 }));
    g.add(PG.circle(880, 420, 78, undefined, { stroke: PG.rgba(C.cyan, 0.18), strokeWidth: 2 }));
    g.add(PG.line([760, 420, 1000, 420], PG.rgba(C.cyan, 0.18), 2));
    g.add(PG.line([880, 300, 880, 540], PG.rgba(C.cyan, 0.18), 2));
    g.add(PG.rect(980, 340, 120, 60, undefined, { stroke: PG.rgba(C.cyan, 0.22), strokeWidth: 2 }));
    g.add(PG.rect(700, 560, 90, 50, undefined, { stroke: PG.rgba(C.cyan, 0.2), strokeWidth: 2 }));
    // звуковые «нити» от стен к голове
    g.add(PG.path('M120 300 C300 380 380 640 470 820', PG.rgba(C.cyan, 0.25), 2));
    g.add(PG.path('M1080 280 C900 380 800 600 640 800', PG.rgba(C.cyan, 0.22), 2));
    g.add(PG.path('M60 900 C240 900 340 900 420 880', PG.rgba(C.cyan, 0.2), 2));

    // медицинский монитор слева
    g.add(PG.panel(60, 560, 300, 220, { fill: '#071a1f', edge: C.steel3, rivets: true }));
    g.add(PG.rect(80, 580, 260, 150, '#020a0c'));
    g.add(PG.waveform(90, 620, 240, 70, PG.rgba(C.teal, 0.85), 3, 40));
    g.add(PG.rect(90, 700, 120, 4, PG.rgba(C.teal, 0.35)));

    // пятна крови на полу
    g.add(PG.ellipse(760, 1660, 120, 26, 'rgba(90,10,10,0.35)'));
    g.add(PG.ellipse(300, 1700, 90, 20, 'rgba(90,10,10,0.25)'));

    g.add(PG.murk(0, 1380, W, 420, '#0a2c2c', 6, 27, 0.14));
    g.add(PG.vignette(0.92));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 09
     Кракентаус и его первое щупальце. Осколок зеркала.
     ======================================================================== */
  S.p09 = function () {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, [0, '#04110f', 0.42, '#061a17', 0.72, '#030d0b', 1, '#010605']));

    // кафель лаборатории
    for (let x = 0; x < W; x += 118) {
      g.add(PG.rect(x, 0, 3, 1480, 'rgba(43,107,120,0.10)'));
    }
    for (let y = 0; y < 1480; y += 118) {
      g.add(PG.rect(0, y, W, 3, 'rgba(43,107,120,0.08)'));
    }
    g.add(PG.drips(0, 0, W, 420, '#0b2a26', 91, 16));
    g.add(PG.cracks({ x: 120, y: 60, w: 420, h: 500, lines: 3, color: '#2b6b78', alpha: 0.16, seed: 19, width: 1.6 }));

    // аварийная лампа слева
    g.add(PG.rect(180, 150, 96, 16, C.steel));
    g.add(PG.circle(228, 176, 12, C.red, { shadowColor: C.red, shadowBlur: 34 }));
    g.add(PG.glow(228, 176, 520, C.red, 0.16));

    // раковина-стойка (слева), зеркало (справа)
    // --- зеркало
    const mx = 646, my = 226, mw = 470, mh = 720;
    g.add(PG.rect(mx - 26, my - 26, mw + 52, mh + 52, '#0c242a'));
    g.add(PG.rect(mx - 14, my - 14, mw + 28, mh + 28, C.ink));
    g.add(PG.rect(mx, my, mw, mh, undefined, PG.vgrad([0, 'rgba(120,200,206,0.16)', 0.6, 'rgba(30,80,86,0.20)', 1, 'rgba(6,20,22,0.6)'], mh)));
    g.add(PG.rivets(mx - 26, my - 26, mw + 52, mh + 52, C.steel3, 58));
    // отражение: тёмный лик, расколотый надвое
    const fx = mx + mw * 0.46, fy = my + mh * 0.42;
    g.add(PG.ellipse(fx, fy, 78, 100, 'rgba(8,22,20,0.55)'));
    g.add(PG.ellipse(fx, fy - 4, 64, 86, 'rgba(120,150,140,0.14)'));
    g.add(PG.path('M' + (fx - 64) + ' ' + (fy - 10) + ' C' + (fx - 60) + ' ' + (fy - 86) + ' ' + (fx + 60) + ' ' + (fy - 90) + ' ' + (fx + 64) + ' ' + (fy - 8), 'rgba(200,230,220,0.10)', 2));
    // единственный глаз в тени
    g.add(PG.ellipse(fx - 24, fy - 16, 15, 9, 'rgba(2,8,7,0.85)'));
    g.add(PG.circle(fx - 24, fy - 16, 3.2, 'rgba(200,255,246,0.5)'));
    g.add(PG.ellipse(fx + 26, fy - 18, 13, 8, 'rgba(2,8,7,0.7)'));
    // раскол: линия проходит прямо через отражение
    g.add(PG.line([fx - 6, my + 20, fx + 2, fy - 40, fx - 8, fy + 20, fx + 6, fy + 76], 'rgba(217,251,255,0.35)', 3));
    g.add(PG.line([fx + 2, fy - 40, fx + 52, fy - 70], 'rgba(217,251,255,0.18)', 1.6));
    g.add(PG.line([fx - 8, fy + 20, fx - 58, fy + 44], 'rgba(217,251,255,0.16)', 1.4));
    // щупальце в отражении — за стеклом, размытое
    g.add(PG.path('M' + (fx + 60) + ' ' + (my + 80) + ' C' + (fx + 140) + ' ' + (my + 180) + ' ' + (fx + 70) + ' ' + (my + 300) + ' ' + (fx + 160) + ' ' + (my + 440), 'rgba(57,224,210,0.20)', 20));
    g.add(PG.path('M' + (fx + 60) + ' ' + (my + 80) + ' C' + (fx + 140) + ' ' + (my + 180) + ' ' + (fx + 70) + ' ' + (my + 300) + ' ' + (fx + 160) + ' ' + (my + 440), 'rgba(157,246,255,0.22)', 3));
    // трещины по стеклу
    const ck = [
      [mx + 250, my + 120, mx + 210, my + 300, mx + 260, my + 470, mx + 205, my + 640],
      [mx + 250, my + 120, mx + 340, my + 210, mx + 420, my + 250],
      [mx + 250, my + 120, mx + 160, my + 200, mx + 90, my + 230],
      [mx + 260, my + 470, mx + 360, my + 520, mx + 440, my + 505]
    ];
    ck.forEach(function (q, i) {
      g.add(PG.line(q, 'rgba(217,251,255,' + (0.30 - i * 0.04) + ')', 2));
    });
    g.add(PG.burst(mx + 250, my + 120, 60, 8, C.ice, 0.16));
    // блик
    g.add(PG.poly([mx + 20, my, mx + 170, my, mx + 60, my + mh, mx + 20, my + mh], 'rgba(217,251,255,0.045)'));

    // --- стойка с раковиной под зеркалом
    g.add(PG.rect(560, 946, 620, 34, '#143039'));
    g.add(PG.rect(560, 980, 620, 130, '#0a2027'));
    g.add(PG.rect(600, 990, 520, 96, '#041216'));
    g.add(PG.rect(600, 990, 520, 10, 'rgba(43,107,120,0.4)'));
    g.add(PG.circle(860, 1038, 20, C.ink));
    g.add(PG.circle(860, 1038, 8, 'rgba(57,224,210,0.25)'));
    // кран
    g.add(PG.path('M900 946 L900 880 L960 880 L960 906', C.steel3, 12));
    g.add(PG.circle(960, 912, 7, C.ink));
    g.add(PG.line([962, 920, 962, 946], 'rgba(157,246,255,0.45)', 2));
    g.add(PG.ellipse(962, 950, 16, 5, 'rgba(157,246,255,0.18)'));
    // осколки на стойке
    [[700, 960], [760, 972], [1080, 966]].forEach(function (p, i) {
      g.add(PG.poly([p[0], p[1], p[0] + 26, p[1] - 6, p[0] + 18, p[1] + 4], 'rgba(217,251,255,0.30)'));
    });

    // --- Кракентаус у раковины, в красном аварийном свете
    g.add(PG.glow(420, 1180, 380, C.red, 0.10));
    g.add(F.krakentaus({ x: 420, y: 1520, scale: 1.38, rim: C.teal, tentacles: 0, look: 0.6 }));

    // разорванный рукав и щупальце из предплечья
    g.add(PG.poly([500, 1200, 556, 1188, 548, 1252, 500, 1264], '#243430', { rotation: -12 }));
    g.add(PG.burst(536, 1188, 78, 9, C.teal, 0.55));
    g.add(PG.glow(540, 1150, 260, C.teal, 0.26));
    g.add(F.tentacle(534, 1196, 300, 1, 44, PG.rgba(C.teal, 0.9), 1));
    g.add(PG.path('M520 1230 C528 1290 518 1340 532 1390', PG.rgba(C.blood, 0.85), 9));
    g.add(PG.circle(534, 1396, 5, PG.rgba(C.blood, 0.8)));
    g.add(PG.circle(542, 1424, 3.4, PG.rgba(C.blood, 0.7)));

    // пол
    g.add(PG.rect(0, 1480, W, 320, '#04100e'));
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      g.add(PG.rect(0, 1480 + t * t * 320, W, 2, 'rgba(43,107,120,0.10)'));
    }
    g.add(PG.ellipse(470, 1600, 170, 34, 'rgba(70,8,8,0.38)'));
    g.add(PG.ellipse(900, 1560, 90, 22, 'rgba(70,8,8,0.22)'));
    g.add(PG.poly([740, 1540, 772, 1532, 764, 1544], 'rgba(217,251,255,0.22)'));
    g.add(PG.poly([1000, 1580, 1030, 1570, 1022, 1586], 'rgba(217,251,255,0.16)'));

    // пар у пола
    g.add(PG.murk(0, 1300, W, 500, '#0d3a34', 6, 31, 0.12));
    g.add(PG.vignette(0.95));
    S.frame(g);
    return g;
  };

  /* =========================================================== СТРАНИЦА 10
     Тронный зал. Нуллар над толпой мутантов.
     ======================================================================== */
  S.p10 = function () {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, [0, '#0a0610', 0.35, '#0d0812', 0.7, '#050208', 1, '#020104']));

    // дальняя стена: реакторное окно
    g.add(PG.circle(600, 640, 330, undefined, { stroke: 'rgba(43,107,120,0.4)', strokeWidth: 26 }));
    g.add(PG.circle(600, 640, 330, undefined, PG.radial(330, [0, 'rgba(255,179,71,0.10)', 0.7, 'rgba(60,18,40,0.4)', 1, 'rgba(0,0,0,0)'])));
    g.add(PG.rings(600, 640, 4, 60, C.amber, 0.16));
    // рёбра свода
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.08 + i * 0.105);
      g.add(PG.line([600 + Math.cos(a) * 200, 640 + Math.sin(a) * 200, 600 + Math.cos(a) * 1100, 640 + Math.sin(a) * 1100], 'rgba(43,107,120,0.14)', 3));
    }
    // колонны
    [110, 250, 950, 1090].forEach(function (x, i) {
      g.add(PG.rect(x - 34, 300, 68, H - 300, '#0a1e24'));
      g.add(PG.rect(x - 34, 300, 10, H - 300, 'rgba(57,224,210,0.12)'));
      g.add(PG.rect(x - 46, 300, 92, 30, '#0e2c33'));
      g.add(PG.glow(x, 420, 180, C.violet, 0.10));
    });

    // ступени к трону
    for (let i = 0; i < 6; i++) {
      g.add(PG.rect(330 - i * 46, 940 + i * 46, 540 + i * 92, 46, i % 2 ? '#0b1e24' : '#0d242b'));
      g.add(PG.rect(330 - i * 46, 940 + i * 46, 540 + i * 92, 4, 'rgba(57,224,210,0.10)'));
    }
    // светящаяся кромка ступеней
    g.add(PG.rect(284, 1170, 632, 4, PG.rgba(C.violet, 0.35)));

    // трон
    const tx = 600, ty = 940;
    g.add(PG.glow(tx, ty - 180, 420, C.violet, 0.22));
    g.add(PG.poly([tx - 150, ty, tx - 190, ty - 330, tx - 120, ty - 420, tx - 40, ty - 350, tx, ty - 470, tx + 40, ty - 350, tx + 120, ty - 420, tx + 190, ty - 330, tx + 150, ty], '#0b141c'));
    g.add(PG.poly([tx - 130, ty, tx - 160, ty - 300, tx - 90, ty - 360, tx - 20, ty - 300, tx, ty - 400, tx + 20, ty - 300, tx + 90, ty - 360, tx + 160, ty - 300, tx + 130, ty], undefined, {
      stroke: PG.rgba(C.violet, 0.4), strokeWidth: 3
    }));
    g.add(PG.rect(tx - 150, ty - 20, 300, 30, '#131a22'));
    // трубки трона
    for (let i = 0; i < 4; i++) {
      g.add(PG.path('M' + (tx - 160 - i * 20) + ' ' + (ty - 300 + i * 40) + ' C' + (tx - 260) + ' ' + (ty - 280 + i * 40) + ' ' + (tx - 240) + ' ' + (ty - 100 + i * 30) + ' ' + (tx - 330) + ' ' + (ty - 60 + i * 30), PG.rgba(C.steel3, 0.7), 6));
    }

    // Нуллар на троне
    g.add(F.nullar({ x: tx, y: ty + 10, scale: 1.04, rim: C.violet, eye: C.violet }));
    // Метеор рядом на ступенях
    g.add(F.meteor({ x: 900, y: 1240, scale: 1.0, rim: C.ember, rocks: true }));

    // толпа внизу — спинами
    g.add(F.crowd({
      people: [
        { x: 90, y: 1800, s: 1.5, flip: false }, { x: 230, y: 1770, s: 1.62, flip: false },
        { x: 380, y: 1810, s: 1.45, flip: false }, { x: 520, y: 1780, s: 1.58, flip: false },
        { x: 670, y: 1810, s: 1.4, flip: true }, { x: 830, y: 1770, s: 1.6, flip: true },
        { x: 980, y: 1800, s: 1.5, flip: true }, { x: 1120, y: 1780, s: 1.55, flip: true }
      ]
    }));
    // глаза в темноте
    [[90, 1500], [230, 1470], [380, 1510], [520, 1480], [670, 1510], [830, 1470], [980, 1500], [1120, 1480]].forEach(function (p, i) {
      const col = i % 3 === 0 ? C.amber : (i % 3 === 1 ? C.teal : C.red);
      g.add(PG.circle(p[0] - 9, p[1], 3, col, { shadowColor: col, shadowBlur: 14 }));
      g.add(PG.circle(p[0] + 9, p[1], 3, col, { shadowColor: col, shadowBlur: 14 }));
    });

    // дым/пар
    g.add(PG.murk(0, 900, W, 600, '#3a2050', 8, 37, 0.12));
    g.add(PG.speckles({ x0: 0, y0: 0, x1: W, y1: H, count: 60, seed: 44, color: C.lilac, minA: 0.03, maxA: 0.18 }));
    g.add(PG.vignette(1.0));
    S.frame(g);
    return g;
  };

})(window);
