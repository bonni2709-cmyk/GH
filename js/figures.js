/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — персонажи
   Каждый герой собран из геометрических примитивов Konva.
   Локальные координаты: (0,0) — точка опоры (ноги), фигура растёт вверх (-y).
   Опции:  x, y, scale, flip, look (-1..1, куда смотрит), sil (цвет силуэта),
           rim (цвет контрового света), glow (общий ореол)
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const C = PG.C;
  const F = PG.fig = {};

  /* --------------------------------------------------------------- примитивы */
  function tube(pts, w, fill, rimC, rimW) {
    const g = PG.group();
    g.add(PG.line(pts, fill, w, { lineCap: 'round', lineJoin: 'round' }));
    if (rimC) {
      g.add(PG.line(pts, rimC, rimW || Math.max(2, w * 0.16), {
        x: -w * 0.22, y: -w * 0.22, opacity: 0.55
      }));
    }
    return g;
  }

  function eye(x, y, r, color, dark) {
    const g = PG.group();
    g.add(PG.glow(x, y, r * 5, color, 0.5));
    g.add(PG.ellipse(x, y, r * 1.25, r * 0.8, dark || '#05090b'));
    g.add(PG.circle(x, y, r * 0.62, color));
    g.add(PG.circle(x, y, r * 0.28, C.white, { opacity: 0.9 }));
    return g;
  }

  function shadowUnder(w) {
    return PG.ellipse(0, 2, w, 12, 'rgba(0,0,0,0.55)');
  }

  function rimLine(pts, color, width, alpha) {
    return PG.path(pts, PG.rgba(color, alpha == null ? 0.65 : alpha), width || 2.4);
  }

  /* ------------------------------------------------------------------ ХАНТЕР */
  F.hunter = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const sil = o.sil || '#0d1b1f';
    const suit = o.sil || '#16333a';
    const rim = o.rim || C.teal;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(110));

    // ноги
    g.add(tube([-26, -150, -34, -60, -30, -8], 34, sil, rim));
    g.add(tube([26, -150, 36, -60, 34, -8], 34, sil, rim));
    g.add(PG.rect(-56, -18, 50, 20, C.ink));   // ботинки
    g.add(PG.rect(10, -18, 54, 20, C.ink));
    g.add(PG.rect(-56, -22, 50, 6, C.steel));
    g.add(PG.rect(10, -22, 54, 6, C.steel));

    // торс — бронепластина
    g.add(PG.poly([-46, -258, 48, -258, 58, -196, 40, -146, -40, -146, -58, -196], suit));
    g.add(PG.poly([-38, -250, 40, -250, 46, -204, 26, -172, -26, -172, -46, -204], C.ink, { opacity: 0.55 }));
    g.add(PG.rect(-34, -244, 26, 10, C.steel3));  // застёжки
    g.add(PG.rect(-34, -224, 26, 10, C.steel3));
    g.add(PG.rect(-34, -204, 26, 10, C.steel3));
    g.add(PG.line([-30, -250, 22, -160], 'rgba(20,40,46,0.95)', 6)); // ремень
    g.add(PG.rect(-46, -184, 40, 26, '#0a1a1f'));  // подсумок
    g.add(PG.rect(-42, -180, 32, 6, 'rgba(90,140,150,0.3)'));
    g.add(PG.rect(-10, -246, 8, 92, PG.rgba(rim, 0.5)));  // светящийся шов
    g.add(PG.circle(30, -212, 9, C.ink));
    g.add(PG.circle(30, -212, 4, C.amber, { shadowColor: C.amber, shadowBlur: 16 }));

    // наплечники
    g.add(PG.poly([-58, -258, -30, -272, -4, -260, -6, -240, -60, -238], C.steel));
    g.add(PG.poly([58, -258, 30, -272, 4, -260, 6, -240, 60, -238], C.steel2));
    g.add(rimLine('M-58 -256 L-30 -270 L-6 -258', rim, 3));

    // руки
    g.add(tube([-50, -248, -70, -190, -54, -150], 26, sil, rim));
    g.add(tube([50, -248, 74, -196, 60, -152], 26, sil, rim));
    g.add(PG.circle(-52, -148, 13, C.ink));      // перчатки
    g.add(PG.circle(62, -150, 13, C.ink));

    // шея + голова
    g.add(PG.rect(-12, -286, 24, 34, C.ink));
    g.add(PG.ellipse(0, -312, 28, 33, o.sil ? o.sil : '#1d3a40'));
    // капюшон
    g.add(PG.path('M-40 -300 C-46 -348 -18 -368 2 -368 C26 -368 46 -346 40 -300 C30 -326 16 -336 0 -336 C-16 -336 -30 -326 -40 -300 Z', C.ink));
    g.add(PG.path('M-40 -300 C-46 -348 -18 -368 2 -368 C26 -368 46 -346 40 -300', PG.rgba(rim, 0.55), 2.6));
    // лицо в тени
    g.add(PG.ellipse(0, -310, 22, 25, '#040b0d'));
    g.add(eye(-9 + look * 4, -314, 4.4, o.eye || C.cyan, '#020607'));
    g.add(PG.rect(-14 + look * 4, -302, 26, 4, PG.rgba(C.steel3, 0.8))); // шрам
    // визор-нашлемник (опционально)
    if (o.visor) {
      g.add(PG.rect(-26, -330, 52, 7, PG.rgba(o.visor, 0.85), { shadowColor: o.visor, shadowBlur: 22 }));
    }

    // винтовка (диагональ через грудь)
    if (o.rifle !== false) {
      const r = PG.group({ x: 6, y: -196, rotation: -24 });
      r.add(PG.rect(-96, -9, 172, 18, C.steel));
      r.add(PG.rect(-96, -9, 60, 18, C.ink));
      r.add(PG.rect(40, -13, 34, 26, C.steel2));
      r.add(PG.circle(58, 0, 9, C.teal, { shadowColor: C.teal, shadowBlur: 26 }));
      r.add(PG.rect(-40, -16, 26, 32, C.ink));
      r.add(PG.rect(76, -5, 26, 10, C.steel3));
      r.add(PG.poly([-4, 9, 22, 9, 16, 46, -2, 46], C.ink)); // магазин
      r.add(PG.rect(-70, -4, 150, 3, PG.rgba(C.cyan, 0.55)));
      g.add(r);
      g.add(PG.bubbles(58, -206, 3, { height: 60, spread: 40, maxR: 4, seed: 4 }));
    }
    if (o.glow) g.add(PG.glow(0, -240, 210, o.glow, 0.28));
    return g;
  };

  /* ------------------------------------------------------------------ НУЛЛАР */
  F.nullar = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const sil = o.sil || '#0a1014';
    const rim = o.rim || C.violet;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(130));

    // длинный плащ
    g.add(PG.path('M-52 -300 L52 -300 L46 -196 L96 -10 L34 -24 L0 -6 L-34 -24 L-96 -10 L-46 -196 Z', o.sil || '#0b141a'));
    g.add(PG.path('M-52 -300 L-46 -196 L-96 -10 L-34 -24 L-6 -8', '#050a0d', 0, { closed: true, fill: '#050a0d', opacity: 0.65 }));
    // воротник-стойка
    g.add(PG.poly([-56, -318, -20, -300, -14, -352, -46, -360], sil));
    g.add(PG.poly([56, -318, 20, -300, 14, -352, 46, -360], sil));
    g.add(rimLine('M-56 -318 L-20 -300 L-14 -352', rim, 2.4, 0.6));
    g.add(rimLine('M56 -318 L20 -300 L14 -352', rim, 2.4, 0.6));

    // торс
    g.add(PG.poly([-44, -302, 44, -302, 52, -220, 30, -186, -30, -186, -52, -220], '#10222b'));
    g.add(PG.rect(-6, -298, 12, 108, PG.rgba(rim, 0.4)));
    // руки
    g.add(tube([-46, -286, -74, -220, -58, -160], 24, sil, rim));
    g.add(tube([46, -286, 78, -216, 74, -150], 24, sil, rim));
    g.add(PG.circle(-60, -156, 12, C.ink));
    g.add(PG.circle(76, -148, 12, C.ink));
    // кисть с жезлом
    g.add(PG.line([76, -148, 96, -292], C.steel, 6, { lineCap: 'round' }));
    g.add(PG.circle(96, -300, 12, undefined, { stroke: PG.rgba(rim, 0.9), strokeWidth: 3, shadowColor: rim, shadowBlur: 26 }));
    g.add(PG.circle(96, -300, 4, rim, { shadowColor: rim, shadowBlur: 22 }));

    // голова
    g.add(PG.rect(-11, -330, 22, 30, '#0b141a'));
    g.add(PG.ellipse(0, -352, 24, 29, o.sil ? o.sil : '#1b3540'));
    g.add(PG.path('M-25 -356 C-25 -380 25 -380 25 -356 C16 -368 6 -370 0 -370 C-8 -370 -18 -366 -25 -356 Z', '#070d11'));
    // скулы и впалые щёки
    g.add(PG.ellipse(-14 + look * 3, -342, 6, 9, '#142b33', { opacity: 0.7 }));
    g.add(PG.ellipse(14 + look * 3, -342, 6, 9, '#142b33', { opacity: 0.7 }));
    g.add(PG.path('M-7 -334 C-3 -331 3 -331 7 -334', 'rgba(10,20,26,0.9)', 2.4));
    g.add(PG.path('M-20 -360 C-16 -364 -10 -365 -6 -363', 'rgba(8,16,20,0.9)', 2));
    g.add(PG.path('M20 -360 C16 -364 10 -365 6 -363', 'rgba(8,16,20,0.9)', 2));
    // глаза
    g.add(eye(-9 + look * 4, -354, 4, o.eye || C.violet, '#03070a'));
    g.add(eye(9 + look * 4, -354, 4, o.eye || C.violet, '#03070a'));
    // «корона» из кабелей
    [[-22, -376, -34, -424], [-10, -382, -14, -438], [2, -384, 4, -448], [14, -380, 22, -432], [24, -372, 38, -410]].forEach(function (p, i) {
      g.add(PG.path('M' + p[0] + ' ' + p[1] + ' Q' + (p[0] + (i - 2) * 6) + ' ' + ((p[1] + p[3]) / 2) + ' ' + p[2] + ' ' + p[3], C.steel, 3));
      g.add(PG.circle(p[2], p[3], 3.4, rim, { shadowColor: rim, shadowBlur: 18 }));
    });
    if (o.glow !== false) g.add(PG.glow(0, -330, 250, rim, 0.22));
    return g;
  };

  /* ------------------------------------------------------------- КРАКЕНТАУС */
  F.krakentaus = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const skin = o.sil || '#8fa79a';
    const coat = o.sil || '#c9d6cf';
    const rim = o.rim || C.teal;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(115));

    // щупальца за спиной
    const tents = o.tentacles == null ? 4 : o.tentacles;
    for (let i = 0; i < tents; i++) {
      const side = i % 2 ? 1 : -1;
      const s = 1 + (i % 3) * 0.22;
      g.add(F.tentacle(side * (34 + i * 10), -210 - i * 12, 230 * s, side, 30 * s, PG.rgba(rim, 0.75), o.tentAlpha));
    }

    // ноги под халатом
    g.add(PG.rect(-30, -70, 22, 70, '#1d2a26'));
    g.add(PG.rect(8, -70, 22, 70, '#1d2a26'));
    g.add(PG.rect(-40, -10, 34, 12, C.ink));
    g.add(PG.rect(6, -10, 34, 12, C.ink));

    // рваный халат
    g.add(PG.path('M-56 -286 L56 -286 L62 -210 L54 -120 L40 -96 L30 -140 L16 -88 L4 -136 L-8 -86 L-22 -138 L-34 -94 L-46 -142 L-58 -110 L-62 -200 Z', coat, { opacity: 0.95 }));
    g.add(PG.path('M-56 -286 L-30 -232 L-38 -140 L-58 -110 L-62 -200 Z', '#93a49c', { opacity: 0.5 }));
    g.add(PG.path('M-4 -286 L-4 -150 L4 -150 L4 -286 Z', '#5a6b63', { opacity: 0.45 }));
    // пятна на халате
    g.add(PG.circle(-24, -190, 16, 'rgba(70,90,60,0.35)'));
    g.add(PG.circle(26, -150, 10, 'rgba(120,40,30,0.35)'));
    g.add(PG.circle(14, -246, 7, 'rgba(120,40,30,0.3)'));

    // торс: сутулые плечи, впалая грудь
    g.add(PG.poly([-48, -306, -22, -322, 22, -322, 48, -306, 44, -246, 0, -232, -44, -246], skin));
    g.add(PG.poly([-26, -306, 26, -306, 20, -252, 0, -244, -20, -252], '#5f776c', { opacity: 0.55 }));
    // ключицы и рёбра
    g.add(PG.path('M-34 -304 C-18 -298 18 -298 34 -304', 'rgba(70,95,85,0.7)', 2));
    g.add(PG.path('M-24 -286 C-10 -280 -2 -280 0 -282', 'rgba(70,95,85,0.5)', 1.6));
    g.add(PG.path('M24 -286 C10 -280 2 -280 0 -282', 'rgba(70,95,85,0.4)', 1.6));
    // шея с жилами
    g.add(PG.path('M-8 -322 C-12 -314 -12 -308 -8 -300', 'rgba(70,95,85,0.55)', 1.6));
    g.add(PG.path('M8 -322 C12 -314 12 -308 8 -300', 'rgba(70,95,85,0.45)', 1.4));
    // руки
    g.add(tube([-46, -292, -66, -232, -52, -170], 22, skin, rim));
    g.add(tube([46, -292, 64, -236, 62, -176], 22, skin, rim));
    g.add(PG.circle(-52, -166, 12, skin));
    g.add(PG.circle(62, -172, 12, skin));
    // вены на предплечьях
    g.add(rimLine('M-60 -246 Q-52 -226 -56 -204', '#3f5a50', 1.6, 0.8));
    g.add(rimLine('M54 -248 Q60 -226 56 -206', '#3f5a50', 1.6, 0.8));

    // голова: вытянутый череп, впалые глаза
    g.add(PG.rect(-9, -320, 18, 26, '#5d746a'));
    g.add(PG.ellipse(0, -342, 23, 30, skin));
    g.add(PG.ellipse(0, -344, 22, 27, '#93a99c', { opacity: 0.85 }));
    // черепная тень и надбровье
    g.add(PG.ellipse(0, -352, 21, 18, '#6b8277', { opacity: 0.55 }));
    g.add(PG.path('M-19 -352 C-12 -360 12 -360 19 -352', '#54695f', 4));
    // впалые щёки
    g.add(PG.ellipse(-13 + look * 3, -330, 7, 9, '#6f877b', { opacity: 0.75 }));
    g.add(PG.ellipse(13 + look * 3, -330, 7, 9, '#6f877b', { opacity: 0.75 }));
    // глазные впадины: тень, а не «точки»
    g.add(PG.ellipse(-10 + look * 4, -345, 10, 7, 'rgba(28,42,36,0.55)'));
    g.add(PG.ellipse(10 + look * 4, -345, 9, 6, 'rgba(28,42,36,0.5)'));
    g.add(PG.ellipse(-10 + look * 4, -345, 4.6, 2.4, '#060c0a'));
    g.add(PG.ellipse(10 + look * 4, -345, 3.8, 2.2, '#060c0a'));
    g.add(PG.circle(-11 + look * 4, -346, 1.5, PG.rgba(o.eye || C.ice, 0.85), { shadowColor: o.eye || C.ice, shadowBlur: 12 }));
    g.add(PG.circle(9 + look * 4, -345, 1.2, PG.rgba(o.eye || C.ice, 0.7)));
    // тяжёлое надбровье и провал переносицы
    g.add(PG.path('M-20 -352 C-14 -357 -4 -356 -1 -352', '#5a7066', 3));
    g.add(PG.path('M20 -352 C14 -357 4 -356 1 -352', '#5a7066', 3));
    g.add(PG.ellipse(0, -340, 3, 6, 'rgba(60,80,70,0.5)'));
    // рот: тонкая скорбная линия, подбородок тяжелее
    g.add(PG.path('M-9 -321 C-4 -318 4 -318 9 -322', 'rgba(24,36,32,0.9)', 2.2));
    g.add(PG.ellipse(0, -311, 8, 5, '#78937f'));
    g.add(PG.path('M-6 -306 C-2 -308 2 -308 6 -306', 'rgba(60,80,70,0.5)', 1.6));
    // жилы на виске
    g.add(PG.path('M-18 -350 C-24 -342 -20 -334 -26 -326', 'rgba(70,100,90,0.8)', 1.6));
    g.add(PG.path('M17 -346 C23 -338 19 -332 24 -324', 'rgba(70,100,90,0.7)', 1.4));
    // вздутия/наросты
    g.add(PG.circle(-15, -364, 5, '#7f9789'));
    g.add(PG.circle(-13, -364, 2, '#9db3a5', { opacity: 0.7 }));
    g.add(PG.circle(12, -366, 4.5, '#7f9789'));
    g.add(PG.circle(-6, -316, 5, '#7f9789'));
    // редкие волосы
    g.add(PG.path('M-16 -368 C-22 -382 -10 -390 0 -388 C10 -390 20 -382 15 -368', 'rgba(40,55,50,0.7)', 3));
    if (o.bleedTent !== false) {
      g.add(PG.path('M42 -300 C54 -290 40 -276 52 -266 C60 -258 48 -248 56 -240', PG.rgba(C.blood, 0.7), 2));
    }
    if (o.glow) g.add(PG.glow(0, -240, 240, o.glow, 0.3));
    return g;
  };

  F.tentacle = function (x, y, len, dir, width, color, alpha) {
    const g = PG.group();
    const w = width || 30;
    const d = 'M' + x + ' ' + y +
      ' C' + (x + dir * len * 0.5) + ' ' + (y - len * 0.34) + ',' +
      (x + dir * len * 0.42) + ' ' + (y - len * 0.66) + ',' +
      (x + dir * len * 0.9) + ' ' + (y - len * 0.82) +
      ' S' + (x + dir * len * 0.5) + ' ' + (y - len * 0.98) + ',' +
      (x + dir * len * 0.78) + ' ' + (y - len * 1.06);
    g.add(PG.path(d, '#26332e', w, { opacity: alpha == null ? 0.95 : alpha, lineCap: 'round' }));
    g.add(PG.path(d, color, Math.max(2, w * 0.16), { opacity: 0.7 }));
    for (let i = 1; i < 6; i++) {
      const t = i / 7;
      const cx = x + dir * len * (0.2 + t * 0.62);
      const cy = y - len * (0.1 + t * 0.86);
      g.add(PG.circle(cx, cy, w * (0.2 - t * 0.05), PG.rgba('#8fa79a', 0.35)));
    }
    return g;
  };

  /* -------------------------------------------------------------------- ЛИРА */
  F.lyra = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const sil = o.sil || '#132b33';
    const rim = o.rim || C.cyan;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(90));

    // ноги
    g.add(tube([-18, -150, -22, -70, -20, -10], 26, sil, rim));
    g.add(tube([18, -150, 24, -70, 22, -10], 26, sil, rim));
    g.add(PG.rect(-42, -16, 40, 16, C.ink));
    g.add(PG.rect(4, -16, 44, 16, C.ink));
    // комбинезон
    g.add(PG.poly([-34, -282, 34, -282, 40, -214, 28, -142, -28, -142, -40, -214], sil));
    g.add(PG.poly([-34, -282, 34, -282, 36, -262, 0, -252, -36, -262], '#0d2129'));
    g.add(PG.rect(-3, -276, 6, 130, PG.rgba(rim, 0.45)));
    g.add(PG.rect(-30, -236, 60, 4, PG.rgba(rim, 0.35)));
    // ремни и подсумки
    g.add(PG.line([-30, -276, 18, -152], 'rgba(30,52,58,0.9)', 7));
    g.add(PG.rect(-34, -196, 46, 12, '#0e2630'));
    g.add(PG.rect(-34, -170, 22, 16, C.steel));  // карман с инструментами
    g.add(PG.line([-27, -170, -27, -154], C.steel3, 3));
    g.add(PG.rect(12, -206, 18, 12, C.steel3));
    // нашивка связиста
    g.add(PG.rect(14, -258, 16, 10, PG.rgba(rim, 0.35), { stroke: PG.rgba(rim, 0.7), strokeWidth: 1 }));
    // руки: правая прижата к виску
    g.add(tube([-40, -268, -62, -220, -52, -172], 20, sil, rim));
    g.add(tube([40, -268, 56, -286, 34, -308], 20, sil, rim));
    g.add(PG.circle(-52, -168, 10, '#c9a58f'));
    g.add(PG.circle(28, -312, 10, '#c9a58f'));
    // голова
    g.add(PG.rect(-8, -308, 16, 28, '#a8806c'));
    g.add(PG.ellipse(0, -332, 22, 26, o.sil ? o.sil : '#c9a58f'));
    g.add(PG.path('M-22 -338 C-24 -366 24 -370 22 -338 C16 -352 8 -354 -2 -352 C-12 -350 -18 -346 -22 -338 Z', '#1b2a2a'));
    g.add(PG.path('M-20 -344 C-34 -352 -38 -334 -30 -320 C-34 -334 -26 -342 -18 -344 Z', '#1b2a2a'));
    g.add(PG.path('M-30 -318 C-36 -302 -30 -292 -22 -288', '#1b2a2a', 7)); // хвост
    g.add(PG.path('M-9 -334 C-7 -337 -4 -337 -2 -334', 'rgba(40,52,52,0.9)', 2)); // бровь
    g.add(eye(-9 + look * 3, -332, 3.6, o.eye || C.cyan, '#0b1214'));
    g.add(eye(7 + look * 3, -332, 3.2, o.eye || C.cyan, '#0b1214'));
    g.add(PG.path('M-6 -320 C-2 -317 3 -317 6 -319', 'rgba(90,50,50,0.8)', 2));
    g.add(PG.ellipse(-2, -324, 3, 4, 'rgba(150,100,90,0.25)'));
    // гарнитура
    g.add(PG.rect(-28, -344, 10, 22, C.steel));
    g.add(PG.circle(-26, -334, 6, C.steel2));
    g.add(PG.circle(-26, -334, 3, rim, { shadowColor: rim, shadowBlur: 20 }));
    g.add(PG.path('M-24 -346 Q0 -364 22 -344', C.steel3, 3));
    // кабели от гарнитуры
    g.add(PG.path('M-26 -346 C-40 -320 -34 -290 -44 -270', PG.rgba(rim, 0.5), 2));
    if (o.sonar) {
      g.add(PG.rings(-26, -334, 4, 26, rim, 0.5));
      g.add(PG.waveform(60, -250, 120, 40, PG.rgba(rim, 0.6), 12, 22));
    }
    return g;
  };

  /* ---------------------------------------------------------------- КВАНТУМ */
  F.quantum = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const sil = o.sil || '#1a2436';
    const rim = o.rim || C.violet;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(85));

    g.add(tube([-16, -150, -24, -66, -18, -8], 22, sil, rim));
    g.add(tube([16, -150, 26, -66, 20, -8], 22, sil, rim));
    g.add(PG.rect(-40, -14, 34, 14, C.ink));
    g.add(PG.rect(6, -14, 38, 14, C.ink));
    // сутулый торс
    g.add(PG.poly([-34, -272, 34, -272, 38, -200, 26, -144, -26, -144, -36, -200], sil));
    g.add(PG.rect(-3, -268, 6, 120, PG.rgba(rim, 0.4)));
    g.add(PG.rect(-26, -218, 52, 3, PG.rgba(rim, 0.3)));
    // лабораторный халат поверх
    g.add(PG.path('M-36 -272 L-6 -272 L-10 -150 L-30 -150 Z', '#c7d2d8', { opacity: 0.28 }));
    g.add(PG.path('M36 -272 L6 -272 L10 -150 L30 -150 Z', '#c7d2d8', { opacity: 0.22 }));
    // руки
    g.add(tube([-38, -262, -58, -206, -44, -160], 18, sil, rim));
    g.add(tube([38, -262, 62, -212, 48, -164], 18, sil, rim));
    g.add(PG.circle(-44, -156, 9, '#c9a58f'));
    g.add(PG.circle(48, -160, 9, '#c9a58f'));
    // голова
    g.add(PG.rect(-8, -300, 16, 24, '#a8806c'));
    g.add(PG.ellipse(0, -322, 21, 25, o.sil ? o.sil : '#c9a58f'));
    g.add(PG.path('M-22 -326 C-26 -352 4 -364 20 -344 C12 -348 2 -346 -6 -342 C-14 -338 -20 -332 -22 -326 Z', '#2a2320'));
    g.add(PG.path('M-20 -340 C-26 -356 -14 -366 -8 -372', '#2a2320', 6));
    g.add(eye(-8 + look * 3, -324, 3.4, o.eye || C.violet, '#0b1214'));
    g.add(eye(7 + look * 3, -324, 3, o.eye || C.violet, '#0b1214'));
    // очки на лбу
    g.add(PG.circle(-9, -344, 8, undefined, { stroke: C.steel3, strokeWidth: 2.4 }));
    g.add(PG.circle(8, -344, 8, undefined, { stroke: C.steel3, strokeWidth: 2.4 }));
    g.add(PG.rect(-2, -346, 4, 3, C.steel3));
    if (o.gogglesOn) {
      g.add(PG.circle(-8 + look * 3, -324, 9, undefined, { stroke: C.violet, strokeWidth: 2.6, shadowColor: C.violet, shadowBlur: 18 }));
      g.add(PG.circle(7 + look * 3, -324, 9, undefined, { stroke: C.violet, strokeWidth: 2.6, shadowColor: C.violet, shadowBlur: 18 }));
    }
    if (o.bleed) {
      g.add(PG.path('M' + (look * 3) + ' -314 L' + (look * 3 - 2) + ' -298', PG.rgba(C.blood, 0.9), 3));
      g.add(PG.circle(look * 3 - 2, -296, 3, PG.rgba(C.blood, 0.8)));
    }
    if (o.sparks) {
      g.add(PG.burst(-60, -170, 60, 8, rim, 0.8));
      g.add(PG.burst(62, -172, 52, 7, rim, 0.7));
      g.add(PG.glow(0, -230, 170, rim, 0.3));
    }
    if (o.tear) {
      g.add(PG.path('M' + (look * 3) + ' -312 L' + (look * 3 + 12) + ' -298', PG.rgba(rim, 0.75), 3));
    }
    return g;
  };

  /* ----------------------------------------------------------------- БАСТИОН */
  F.bastion = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const metal = o.sil || '#20404a';
    const dark = o.sil || '#132a32';
    const rim = o.rim || C.amber;
    if (o.shadow !== false) g.add(shadowUnder(140));

    // гидравлические ноги
    g.add(tube([-40, -140, -48, -60, -44, -10], 48, dark, rim));
    g.add(tube([40, -140, 50, -60, 46, -10], 48, dark, rim));
    g.add(PG.rect(-76, -22, 62, 24, C.ink));
    g.add(PG.rect(14, -22, 66, 24, C.ink));
    g.add(PG.rect(-72, -30, 10, 26, C.steel3));
    g.add(PG.rect(18, -30, 10, 26, C.steel3));
    g.add(PG.circle(-62, -90, 10, C.steel2));
    g.add(PG.circle(62, -90, 10, C.steel2));
    // корпус
    g.add(PG.poly([-62, -252, 62, -252, 72, -176, 54, -126, -54, -126, -72, -176], metal));
    g.add(PG.rect(-46, -246, 92, 26, C.ink));
    g.add(PG.rect(-30, -222, 60, 8, PG.rgba(rim, 0.7), { shadowColor: rim, shadowBlur: 20 }));
    g.add(PG.circle(-40, -196, 12, C.ink));
    g.add(PG.circle(-40, -196, 5, C.teal));
    g.add(PG.circle(40, -196, 12, C.ink));
    g.add(PG.circle(40, -196, 5, C.red));
    g.add(PG.rivets(-62, -252, 124, 126, C.steel3, 30));
    // плечи-броня
    g.add(PG.poly([-78, -250, -40, -280, -6, -262, -8, -226, -80, -220], C.steel));
    g.add(PG.poly([78, -250, 40, -280, 6, -262, 8, -226, 80, -220], C.steel2));
    // руки
    g.add(tube([-72, -240, -98, -180, -86, -128], 40, metal, rim));
    g.add(tube([72, -240, 100, -184, 92, -132], 40, metal, rim));
    // гидроцилиндры на предплечьях
    g.add(PG.rect(-108, -206, 12, 62, C.steel3));
    g.add(PG.rect(98, -210, 12, 62, C.steel3));
    // кулак-клешня
    g.add(PG.circle(-88, -122, 22, dark));
    g.add(PG.poly([-108, -122, -84, -146, -66, -128, -70, -102, -104, -100], C.steel));
    g.add(PG.circle(94, -126, 20, dark));
    g.add(PG.rect(76, -142, 34, 12, C.steel));
    // шлем
    g.add(PG.rect(-14, -290, 28, 34, dark));
    g.add(PG.ellipse(0, -312, 32, 28, metal));
    g.add(PG.rect(-26, -320, 52, 16, C.ink));
    g.add(PG.rect(-24, -318, 48, 5, PG.rgba(rim, 0.95), { shadowColor: rim, shadowBlur: 26 }));
    g.add(PG.rect(-6, -336, 12, 10, C.steel2));
    // трубки
    g.add(PG.path('M12 -296 C40 -300 46 -270 40 -246', C.steel2, 6));
    g.add(PG.path('M-12 -296 C-40 -300 -46 -270 -40 -246', C.steel2, 6));
    if (o.blow) {
      g.add(PG.bubbles(30, -300, 6, { height: 120, spread: 60, maxR: 7, seed: 33 }));
      g.add(PG.glow(0, -300, 140, C.cyan, 0.2));
    }
    return g;
  };

  /* ----------------------------------------------------------------- МЕТЕОР */
  F.meteor = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const rock = o.sil || '#15181c';
    const rim = o.rim || C.ember;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(130));

    // «плавающие» камни вокруг
    if (o.rocks) {
      [[-170, -300, 26, 0], [168, -240, 18, 1], [150, -420, 12, 0], [-130, -440, 10, 1]].forEach(function (p) {
        g.add(PG.poly([p[0] - p[2], p[1], p[0] - p[2] * 0.3, p[1] - p[2], p[0] + p[2], p[1] - p[2] * 0.4, p[0] + p[2] * 0.6, p[1] + p[2] * 0.8, p[0] - p[2] * 0.5, p[1] + p[2] * 0.7], '#191d22'));
        g.add(PG.path('M' + (p[0] - p[2] * 0.4) + ' ' + p[1] + ' L' + p[0] + ' ' + (p[1] - p[2] * 0.3) + ' L' + (p[0] + p[2] * 0.5) + ' ' + p[1], PG.rgba(rim, 0.7), 2));
        g.add(PG.glow(p[0], p[1], p[2] * 2.4, rim, 0.25));
      });
    }

    // ноги-обломки
    g.add(tube([-26, -160, -34, -70, -30, -8], 40, rock, null, 0));
    g.add(tube([26, -160, 34, -70, 30, -8], 40, rock, null, 0));
    // трещины на ногах
    g.add(rimLine('M-40 -140 L-30 -100 L-38 -60 L-28 -20', rim, 2.2, 0.75));
    g.add(rimLine('M34 -150 L24 -110 L34 -70 L26 -26', rim, 2, 0.65));

    // торс — глыба
    g.add(PG.poly([-56, -292, -20, -306, 24, -304, 60, -282, 68, -212, 46, -166, -8, -172, -52, -196, -66, -244], rock));
    g.add(PG.poly([-40, -286, -12, -296, 22, -292, 40, -272, 28, -238, -8, -246, -34, -262], '#1d2126'));
    // светящиеся трещины: ядро ярче, к краям — тлеющий жар
    const rr = PG.rng(77);
    for (let i = 0; i < 9; i++) {
      let x = -50 + rr() * 104, y = -288 + rr() * 112;
      const pts = [x, y];
      for (let s = 0; s < 4; s++) { x += (rr() - 0.5) * 34; y += 9 + rr() * 14; pts.push(x, y); }
      g.add(PG.line(pts, rim, 1.2 + rr() * 1.4, { shadowColor: rim, shadowBlur: 22, opacity: 0.9 }));
      g.add(PG.line(pts, 'rgba(255,240,200,0.55)', 0.8));
    }
    // расплавленные карманы
    [-30, -8, 22].forEach(function (cx, i) {
      g.add(PG.glow(cx, -250 + i * 24, 46, rim, 0.4));
      g.add(PG.circle(cx, -250 + i * 24, 4 + i, 'rgba(255,236,190,0.85)'));
    });
    g.add(PG.glow(4, -230, 130, rim, 0.3));
    // руки
    g.add(tube([-56, -276, -84, -220, -74, -160], 34, rock, null, 0));
    g.add(tube([56, -276, 86, -224, 78, -164], 34, rock, null, 0));
    g.add(PG.circle(-76, -156, 20, rock));
    g.add(PG.circle(80, -160, 20, rock));
    g.add(rimLine('M-84 -250 L-74 -216 L-80 -186', rim, 2, 0.7));
    g.add(rimLine('M84 -246 L92 -212 L84 -186', rim, 2, 0.6));
    // голова — обсидиановая глыба с расколотым лицом
    g.add(PG.poly([-25, -346, -9, -362, 17, -358, 31, -336, 25, -304, -3, -296, -25, -312], rock));
    g.add(PG.poly([-17, -342, 1, -352, 17, -344, 11, -328, -13, -326], '#0d1013'));
    g.add(PG.path('M-17 -342 L-13 -326 L-2 -352', PG.rgba(rim, 0.5), 1.4));
    g.add(PG.path('M17 -344 L11 -328 L-1 -350', PG.rgba(rim, 0.35), 1.2));
    g.add(eye(-8 + look * 4, -338, 4, o.eye || C.ember, '#0a0b0d'));
    g.add(eye(9 + look * 4, -336, 3.4, o.eye || C.ember, '#0a0b0d'));
    g.add(rimLine('M-18 -352 L-10 -330 L-16 -308', rim, 1.8, 0.7));
    g.add(rimLine('M18 -350 L26 -330 L20 -310', rim, 1.6, 0.6));
    if (o.glow !== false) g.add(PG.glow(0, -240, 260, rim, 0.26));
    return g;
  };

  /* ------------------------------------------------------------------ МНЕМА */
  F.mnema = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const dress = o.sil || '#d8d3e6';
    const rim = o.rim || C.lilac;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(105));

    // длинное платье
    g.add(PG.path('M-34 -290 L34 -290 L42 -206 L72 -6 L40 -18 L0 -2 L-40 -18 L-72 -6 L-42 -206 Z', o.sil ? o.sil : '#cfcbdd'));
    g.add(PG.path('M-34 -290 L34 -290 L42 -206 L10 -210 L0 -290 Z', '#e6e2f0', { opacity: 0.5 }));
    g.add(PG.path('M0 -290 L10 -210 L72 -6 L40 -18 L0 -2 Z', '#b3aec6', { opacity: 0.35 }));
    // руки
    g.add(tube([-34, -274, -58, -216, -46, -168], 20, o.sil || '#e6e2f0', rim));
    g.add(tube([34, -274, 58, -220, 52, -170], 20, o.sil || '#e6e2f0', rim));
    g.add(PG.circle(-46, -164, 10, '#e8e4f2'));
    g.add(PG.circle(52, -166, 10, '#e8e4f2'));
    // голова и вуаль
    g.add(PG.ellipse(0, -326, 22, 26, o.sil ? o.sil : '#eae6f4'));
    g.add(PG.path('M-30 -340 C-34 -384 34 -390 30 -338 C24 -362 0 -368 -12 -358 C-22 -350 -26 -344 -30 -340 Z', '#ece9f6'));
    g.add(PG.path('M-32 -336 C-40 -300 -36 -270 -44 -240', PG.rgba('#e6e2f0', 0.45), 14));
    g.add(PG.path('M32 -336 C40 -300 36 -270 44 -240', PG.rgba('#e6e2f0', 0.4), 14));
    // маска: гладкая, два провала
    g.add(PG.ellipse(0, -322, 17, 20, '#f3f0fa', { opacity: 0.92 }));
    g.add(PG.ellipse(-7 + look * 3, -326, 4.2, 5.4, '#0d0b14'));
    g.add(PG.ellipse(7 + look * 3, -326, 4.2, 5.4, '#0d0b14'));
    g.add(PG.rect(-3 + look * 3, -310, 12, 2.2, PG.rgba('#6b6580', 0.6)));
    // «нити памяти» из пальцев
    if (o.threads) {
      g.add(PG.path('M-46 -164 C-70 -140 -60 -110 -96 -96', PG.rgba(rim, 0.55), 2));
      g.add(PG.path('M52 -166 C80 -146 72 -118 108 -110', PG.rgba(rim, 0.5), 2));
      g.add(PG.circle(-96, -96, 3, rim, { shadowColor: rim, shadowBlur: 18 }));
      g.add(PG.circle(108, -110, 3, rim, { shadowColor: rim, shadowBlur: 18 }));
    }
    if (o.glow) g.add(PG.glow(0, -300, 200, rim, 0.22));
    return g;
  };

  /* ----------------------------------------------------------------- СИРИУС */
  F.sirius = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const body = o.sil || '#b8c6cc';
    const dark = '#1a2b33';
    const rim = o.rim || C.ice;
    const look = o.look == null ? 0 : o.look;
    if (o.shadow !== false) g.add(shadowUnder(95));

    g.add(tube([-18, -154, -22, -70, -20, -10], 24, '#8f9ea5', rim));
    g.add(tube([18, -154, 22, -70, 20, -10], 24, '#8f9ea5', rim));
    g.add(PG.rect(-40, -14, 36, 14, C.ink));
    g.add(PG.rect(4, -14, 40, 14, C.ink));
    // торс
    g.add(PG.poly([-36, -280, 36, -280, 42, -206, 30, -146, -30, -146, -42, -206], body));
    g.add(PG.rect(-28, -268, 56, 4, C.steel2));
    g.add(PG.rect(-28, -240, 56, 4, C.steel2));
    g.add(PG.rect(-28, -212, 56, 4, C.steel2));
    g.add(PG.rect(-2, -280, 4, 134, PG.rgba(rim, 0.6)));
    // «сердце»-реактор
    g.add(PG.circle(0, -196, 12, C.ink));
    g.add(PG.circle(0, -196, 7, rim, { shadowColor: rim, shadowBlur: 26 }));
    g.add(PG.rings(0, -196, 3, 14, rim, 0.35));
    // руки
    g.add(tube([-38, -272, -54, -216, -44, -162], 18, body, rim));
    g.add(tube([38, -272, 54, -216, 48, -164], 18, body, rim));
    g.add(PG.circle(-44, -158, 8, dark));
    g.add(PG.circle(48, -160, 8, dark));
    // шея
    g.add(PG.rect(-8, -298, 16, 24, C.steel2));
    // голова-экран
    g.add(PG.rect(-26, -348, 52, 52, dark, { cornerRadius: 8 }));
    g.add(PG.rect(-20, -342, 40, 38, '#050d12', { cornerRadius: 4 }));
    g.add(PG.waveform(-18, -326, 36, 16, rim, 5, 16));
    g.add(PG.rect(-18, -338, 22, 2, PG.rgba(rim, 0.5)));
    g.add(PG.rect(-18, -310, 14, 2, PG.rgba(rim, 0.4)));
    g.add(PG.rect(-28, -350, 56, 3, PG.rgba(rim, 0.35)));
    if (o.data) {
      for (let i = 0; i < 6; i++) {
        g.add(PG.rect(-60 + i * 22, -400 - (i % 3) * 18, 3, 30, PG.rgba(rim, 0.35)));
      }
      g.add(PG.glow(0, -320, 200, rim, 0.2));
    }
    return g;
  };

  /* -------------------------------------------------------------- АРХИВАРИУС */
  F.archivist = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const coat = o.sil || '#2a3f46';
    const rim = o.rim || C.ice;
    if (o.shadow !== false) g.add(shadowUnder(120));

    // тяжёлые ботинки
    g.add(PG.rect(-46, -24, 44, 24, C.ink));
    g.add(PG.rect(4, -24, 48, 24, C.ink));
    g.add(tube([-24, -150, -28, -70, -24, -20], 30, '#1e2f35', rim));
    g.add(tube([24, -150, 28, -70, 26, -20], 30, '#1e2f35', rim));
    // пуховик
    g.add(PG.poly([-58, -286, 58, -286, 66, -206, 56, -140, -56, -140, -66, -206], coat));
    for (let i = 0; i < 4; i++) {
      g.add(PG.rect(-56, -276 + i * 30, 112, 6, 'rgba(0,0,0,0.35)'));
    }
    g.add(PG.rect(-4, -286, 8, 146, '#1b2b31'));
    // капюшон с мехом
    g.add(PG.path('M-52 -286 C-64 -340 -34 -368 0 -368 C34 -368 64 -340 52 -286 C30 -300 12 -306 0 -306 C-12 -306 -30 -300 -52 -286 Z', coat));
    g.add(PG.path('M-56 -338 C-64 -360 -28 -382 0 -382 C28 -382 64 -360 56 -338 C34 -356 12 -362 0 -362 C-12 -362 -34 -356 -56 -338 Z', '#cfe2e6', { opacity: 0.75 }));
    [[-44, -352], [-26, -364], [-8, -370], [12, -368], [30, -360], [44, -348]].forEach(function (p) {
      g.add(PG.circle(p[0], p[1], 8, '#e6f4f7', { opacity: 0.8 }));
    });
    // лицо в тени капюшона, обмороженное
    g.add(PG.rect(-10, -308, 20, 22, '#9fb4b9'));
    g.add(PG.ellipse(0, -330, 21, 25, o.sil ? o.sil : '#b9ccd1'));
    g.add(PG.ellipse(0, -322, 16, 15, 'rgba(10,20,24,0.55)'));
    g.add(eye(-7, -332, 3.4, o.eye || C.ice, '#08131a'));
    g.add(eye(7, -332, 3, o.eye || C.ice, '#08131a'));
    g.add(PG.path('M-8 -314 C-2 -312 4 -314 8 -318', 'rgba(40,60,70,0.7)', 2));
    // иней на бороде
    g.add(PG.path('M-12 -316 C-8 -300 -2 -296 2 -300 C6 -296 10 -304 12 -314', PG.rgba(C.ice, 0.5), 6));
    // руки
    g.add(tube([-60, -280, -84, -224, -70, -168], 26, coat, rim));
    g.add(tube([60, -280, 86, -226, 78, -170], 26, coat, rim));
    g.add(PG.circle(-72, -162, 12, '#1e2f35'));
    g.add(PG.circle(80, -164, 12, '#1e2f35'));
    // связка ключей
    g.add(PG.circle(78, -150, 4, C.steel3));
    g.add(PG.line([78, -150, 74, -118], C.steel3, 2.4));
    g.add(PG.rect(70, -120, 8, 10, C.steel3));
    g.add(PG.line([78, -150, 86, -124], C.steel3, 2.4));
    g.add(PG.rect(84, -126, 8, 10, C.steel3));
    if (o.frost) {
      g.add(PG.glow(0, -330, 120, C.ice, 0.28));
      g.add(PG.path('M20 -308 C30 -300 22 -290 30 -282', PG.rgba(C.ice, 0.45), 3));
    }
    return g;
  };

  /* ------------------------------------------------------------- СИЛУЭТ/ТОЛПА */
  F.silhouette = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scaleX: o.flip ? -(o.scale || 1) : (o.scale || 1), scaleY: o.scale || 1 });
    const c = o.sil || '#04090c';
    g.add(PG.poly([-26, -150, 26, -150, 34, -60, 30, 0, 12, 0, 10, -70, -8, -70, -10, 0, -30, 0, -34, -60], c));
    g.add(PG.poly([-30, -156, 30, -156, 36, -240, 20, -268, -20, -268, -36, -240], c));
    g.add(PG.ellipse(0, -292, 24, 28, c));
    g.add(PG.poly([-34, -256, -44, -196, -40, -150, -26, -150, -24, -196, -22, -240], c));
    g.add(PG.poly([34, -256, 44, -196, 40, -150, 26, -150, 24, -196, 22, -240], c));
    return g;
  };

  F.crowd = function (o) {
    o = o || {};
    const g = PG.group();
    const arr = o.people || [];
    arr.forEach(function (p, i) {
      g.add(F.silhouette({
        x: p.x, y: p.y, scale: p.s || 1, flip: p.flip,
        sil: p.c || (i % 3 === 0 ? '#020608' : '#050d11')
      }));
      if (p.eye) {
        g.add(PG.circle(p.x + (p.flip ? -8 : 8) * (p.s || 1), p.y - 296 * (p.s || 1), 2.6, p.eye));
        g.add(PG.circle(p.x + (p.flip ? -16 : 16) * (p.s || 1), p.y - 296 * (p.s || 1), 2.6, p.eye));
      }
    });
    return g;
  };

  /* ------------------------------------------------------- «скрим» — кадр-титр */
  F.helmetGlass = function (o) {
    o = o || {};
    const g = PG.group({ x: o.x || 0, y: o.y || 0, scale: o.scale || 1 });
    const r = o.r || 210;
    g.add(PG.circle(0, 0, r + 18, C.steel));
    g.add(PG.circle(0, 0, r + 8, C.ink));
    g.add(PG.circle(0, 0, r, undefined, PG.radial(r, [0, 'rgba(60,140,150,0.10)', 0.7, 'rgba(10,30,36,0.55)', 1, 'rgba(4,10,14,0.9)'])));
    g.add(PG.circle(0, 0, r, undefined, { stroke: PG.rgba(C.cyan, 0.35), strokeWidth: 3 }));
    // блики
    g.add(PG.path('M' + (-r * 0.62) + ' ' + (-r * 0.2) + ' A' + r + ' ' + r + ' 0 0 1 ' + (-r * 0.15) + ' ' + (-r * 0.86), PG.rgba(C.ice, 0.22), 22));
    g.add(PG.path('M' + (-r * 0.5) + ' ' + (r * 0.2) + ' A' + r + ' ' + r + ' 0 0 0 ' + (r * 0.1) + ' ' + (r * 0.88), PG.rgba(C.ice, 0.1), 12));
    // трещины
    g.add(PG.path('M' + (r * 0.2) + ' ' + (-r * 0.7) + ' L' + (r * 0.1) + ' ' + (-r * 0.2) + ' L' + (r * 0.34) + ' ' + (r * 0.1), PG.rgba(C.ice, 0.25), 1.6));
    // капли
    for (let i = 0; i < 12; i++) {
      const rr = PG.rng(i + 3);
      g.add(PG.ellipse((rr() - 0.5) * r * 1.6, (rr() - 0.5) * r * 1.5, 3 + rr() * 8, 4 + rr() * 12, PG.rgba(C.cyan, 0.12 + rr() * 0.12)));
    }
    return g;
  };

})(window);
