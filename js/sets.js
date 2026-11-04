/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — библиотека локаций
   Каждая локация — функция (g, o), рисующая «мир» вокруг точки (600, 900).
   Мир рисуется с запасом за края, чтобы камера могла панорамировать и зумить.
   Параметры: tone (палитра), seed, water (уровень воды), fog, crowd, broken
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const C = PG.C;
  const W = PG.W, H = PG.H;
  const SET = PG.sets = {};

  /* ------------------------------------------------------------------ тона */
  PG.tone = function (name) {
    const T = {
      teal:   { top: '#07222b', mid: '#04121a', bot: '#010609', light: '#39e0d2', warm: '#9df6ff', panel: '#0b2830', ink: '#020a0e' },
      deep:   { top: '#03151d', mid: '#020d13', bot: '#010407', light: '#2fb9c4', warm: '#9df6ff', panel: '#082028', ink: '#010609' },
      violet: { top: '#150e26', mid: '#0a0716', bot: '#04020a', light: '#9a7bff', warm: '#cbb6ff', panel: '#171129', ink: '#06030d' },
      amber:  { top: '#22170a', mid: '#130c05', bot: '#070402', light: '#ffb347', warm: '#ffe08a', panel: '#1d1409', ink: '#0a0603' },
      red:    { top: '#230a0c', mid: '#130507', bot: '#070203', light: '#ff3d33', warm: '#ff9a8f', panel: '#1d0a0c', ink: '#0a0304' },
      ice:    { top: '#0a2230', mid: '#05141d', bot: '#020a0f', light: '#9df6ff', warm: '#d9fbff', panel: '#0b2634', ink: '#02090e' },
      green:  { top: '#0a2018', mid: '#04120d', bot: '#010705', light: '#9ef01a', warm: '#d7ff8a', panel: '#0b2418', ink: '#020a06' },
      bone:   { top: '#1d2126', mid: '#101418', bot: '#05070a', light: '#dcebee', warm: '#ffffff', panel: '#1a2026', ink: '#04060a' }
    };
    return T[name] || T.teal;
  };

  PG.bg = function (toneName, seed) {
    const t = PG.tone(toneName);
    const g = PG.group();
    g.add(PG.grect(-200, -200, W + 400, H + 400, [
      0, t.top, 0.45, t.mid, 1, t.bot
    ]));
    g.add(PG.speckles({
      x0: -100, y0: -100, x1: W + 100, y1: H + 100, count: 80, seed: seed || 5,
      color: t.warm, minA: 0.02, maxA: 0.14, minR: 0.6, maxR: 2.2
    }));
    return g;
  };

  /* --------------------------------------------------------------- утилиты */
  function wallPanels(g, t, o) {
    const step = o.step || 150;
    for (let x = -300; x < W + 300; x += step) {
      g.add(PG.rect(x, -300, 3, H + 600, PG.rgba(t.light, 0.06)));
    }
    for (let y = -300; y < H + 600; y += step) {
      g.add(PG.rect(-300, y, W + 600, 3, PG.rgba(t.light, 0.045)));
    }
  }

  function floorGrate(g, t, y) {
    g.add(PG.rect(-300, y, W + 600, H, '#040c0f'));
    for (let i = 0; i < 14; i++) {
      const yy = y + i * 30;
      g.add(PG.rect(-300, yy, W + 600, 6, PG.rgba(t.panel, 0.8)));
      g.add(PG.rect(-300, yy, W + 600, 1.5, PG.rgba(t.light, 0.12)));
    }
    for (let x = -280; x < W + 300; x += 90) {
      g.add(PG.rect(x, y, 5, 120, PG.rgba(t.panel, 0.9)));
    }
  }

  function lightsRow(g, t, y, n, color) {
    for (let i = 0; i < (n || 3); i++) {
      const x = 150 + i * ((W - 300) / Math.max(1, (n - 1) || 1));
      g.add(PG.rect(x - 90, y, 180, 12, PG.rgba(color || t.warm, 0.75), {
        shadowColor: color || t.warm, shadowBlur: 40
      }));
      g.add(PG.glow(x, y + 6, 220, color || t.warm, 0.12, { scaleY: 0.4 }));
    }
  }

  function alarm(g, x, y, color) {
    g.add(PG.circle(x, y, 11, color, { shadowColor: color, shadowBlur: 34 }));
    g.add(PG.glow(x, y, 280, color, 0.16));
    g.add(PG.arc(x, y, 26, 60, PG.rgba(color, 0.5), { rotation: -120, innerRadius: 18 }));
  }

  function pipesAlong(g, t, side) {
    const x = side === 'left' ? 90 : W - 90;
    for (let i = 0; i < 3; i++) {
      const xx = x + (side === 'left' ? i * 26 : -i * 26);
      g.add(PG.rect(xx, -200, 16, H + 400, t.panel));
      g.add(PG.rect(xx, -200, 4, H + 400, PG.rgba(t.light, 0.14)));
      for (let y = 100; y < H; y += 240) {
        g.add(PG.rect(xx - 6, y, 28, 14, t.ink));
        g.add(PG.rect(xx - 6, y, 28, 3, PG.rgba(t.light, 0.2)));
      }
    }
  }

  function fogLayer(g, t, amount, seed) {
    // туман — низкий и разреженный, чтобы не замыливать кадр
    const a = Math.min(0.075, 0.045 * (amount || 1));
    g.add(PG.murk(-200, 1180, W + 400, 700, t.light, Math.round(3 * (amount || 1)) + 1, seed || 21, a));
    g.add(PG.speckles({
      x0: 0, y0: 520, x1: W, y1: H, count: Math.round(24 * (amount || 1)), seed: (seed || 3) + 7,
      color: t.warm, minA: 0.02, maxA: 0.14, minR: 0.5, maxR: 2.0, halo: true
    }));
  }

  function waterLine(g, t, y, seed) {
    g.add(PG.rect(-200, y, W + 400, H - y + 300, undefined, PG.vgrad([
      0, PG.rgba('#0a3a44', 0.55), 1, PG.rgba('#02161c', 0.85)
    ], H - y)));
    g.add(PG.waves({ x: -100, y: y, w: W + 200, rows: 6, gap: 34, amp: 10, color: t.light, alpha: 0.16, wl: 210, seed: seed || 9 }));
    g.add(PG.speckles({ x0: 0, y0: y, x1: W, y1: H, count: 70, seed: (seed || 9) + 4, color: t.warm, minA: 0.03, maxA: 0.22, minR: 0.6, maxR: 2.6 }));
  }

  function crowdBack(g, n, seed, color) {
    const r = PG.rng(seed || 4);
    for (let i = 0; i < (n || 12); i++) {
      const x = -40 + r() * (W + 80);
      const y = 1480 + r() * 260;
      const s = 0.8 + r() * 0.5;
      g.add(PG.group({ opacity: 0.75 }).add(PG.fig.silhouette({
        x: x, y: y, scale: s, flip: r() > 0.5, sil: color || '#03080b'
      })));
    }
  }

  function debris(g, n, seed, color) {
    const r = PG.rng(seed || 31);
    for (let i = 0; i < (n || 20); i++) {
      const x = r() * W, y = 900 + r() * 800, s = 6 + r() * 26;
      g.add(PG.poly([x, y, x + s, y - s * 0.6, x + s * 1.1, y + s * 0.5, x - s * 0.2, y + s * 0.4], color || '#1a2226', { rotation: r() * 80 }));
    }
  }

  /* ============================================================ ЛОКАЦИИ */

  /** коридор: рёбра, лампы, шлюз в конце */
  SET.corridor = function (g, o) {
    const t = PG.tone(o.tone || 'teal');
    const vx = o.vx || 600, vy = o.vy || 820;
    g.add(PG.room({
      vx: vx, vy: vy, backW: o.backW || 360, backH: o.backH || 540,
      backFill: '#0a2630', ceil: '#041217', floor: '#05141a',
      left: '#071c24', right: '#061a22',
      backGrad: [0, '#0e3340', 0.55, '#082029', 1, '#041218']
    }));
    for (let i = 0; i < 7; i++) {
      const k = i / 7;
      const x0 = PG.lerp(-100, vx - 180, k), x1 = PG.lerp(W + 100, vx + 180, k);
      const yTop = PG.lerp(-100, vy - 270, k), yBot = PG.lerp(H + 100, vy + 270, k);
      g.add(PG.rect(x0, yTop, x1 - x0, 18, t.panel));
      g.add(PG.rect(x0, yBot - 18, x1 - x0, 18, t.panel));
      g.add(PG.rect(x0, yTop, 16, yBot - yTop, t.panel, { opacity: 0.75 }));
      g.add(PG.rect(x1 - 16, yTop, 16, yBot - yTop, t.panel, { opacity: 0.6 }));
      g.add(PG.rect(x0, yTop, x1 - x0, 2, PG.rgba(t.light, 0.16)));
      if (i > 0 && i < 5) {
        g.add(PG.rect(x0 + (x1 - x0) * 0.36, yTop + 12, (x1 - x0) * 0.28, 8, PG.rgba(t.warm, 0.5), { shadowColor: t.warm, shadowBlur: 26 }));
      }
    }
    pipesAlong(g, t, 'left');
    pipesAlong(g, t, 'right');
    g.add(PG.poly([vx - 180, vy + 270, vx + 180, vy + 270, W + 200, H + 200, -200, H + 200], undefined, PG.vgrad([
      0, PG.rgba(t.light, 0.13), 1, PG.rgba(t.light, 0)
    ], 900)));
    if (o.door !== false) {
      g.add(PG.doorway(vx - 90, vy - 140, 180, 320, { fill: '#020a0e', glow: o.doorGlow || t.light }));
      g.add(PG.circle(vx, vy + 70, 28, undefined, { stroke: PG.rgba(t.light, 0.5), strokeWidth: 4 }));
    }
    if (o.alarm !== false) alarm(g, 210, 330, o.alarmColor || C.red);
    if (o.crowd) crowdBack(g, o.crowd, (o.seed || 3) + 11);
    fogLayer(g, t, o.fog == null ? 1 : o.fog, o.seed || 7);
    g.add(PG.drips(0, -40, W, 260, t.ink, (o.seed || 3) + 5, 12));
  };

  /** реакторный зал */
  SET.reactor = function (g, o) {
    const t = PG.tone(o.tone || 'amber');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    const cx = o.cx || 600, top = 120, bot = 1260, hw = o.hw || 210;
    g.add(PG.glow(cx, 700, 760, t.light, 0.16));
    g.add(PG.rect(cx - hw - 60, top - 60, (hw + 60) * 2, bot - top + 140, '#0a1c20'));
    g.add(PG.rect(cx - hw, top, hw * 2, bot - top, undefined, PG.hgrad([
      0, '#06161a', 0.2, '#0d2b31', 0.5, '#123a41', 0.8, '#0a2228', 1, '#050f13'
    ], hw * 2)));
    g.add(PG.rect(cx - 26, top + 40, 52, bot - top - 80, PG.rgba(t.light, 0.8), { shadowColor: t.light, shadowBlur: 70 }));
    g.add(PG.rect(cx - 96, top + 40, 24, bot - top - 80, PG.rgba(t.light, 0.28), { shadowColor: t.light, shadowBlur: 40 }));
    g.add(PG.rect(cx + 72, top + 40, 24, bot - top - 80, PG.rgba(t.light, 0.28), { shadowColor: t.light, shadowBlur: 40 }));
    for (let y = top + 20; y < bot; y += 120) {
      g.add(PG.rect(cx - hw - 16, y, hw * 2 + 32, 18, '#123037'));
      g.add(PG.rect(cx - hw - 16, y, hw * 2 + 32, 3, PG.rgba(t.warm, 0.25)));
      g.add(PG.rivets(cx - hw - 16, y, hw * 2 + 32, 18, C.steel3, 34));
    }
    g.add(PG.ellipse(cx, top, hw + 46, 96, '#0b242b'));
    g.add(PG.ellipse(cx, top, hw + 46, 96, undefined, { stroke: C.steel3, strokeWidth: 3 }));
    g.add(PG.rect(cx - 70, top - 170, 140, 170, '#0a2026'));
    g.add(PG.rect(cx - 46, top - 158, 92, 14, PG.rgba(t.light, 0.55)));
    g.add(PG.rect(cx - hw - 100, bot, (hw + 100) * 2, 110, '#081a1f'));
    g.add(PG.rect(cx - hw - 100, bot, (hw + 100) * 2, 10, PG.rgba(t.light, 0.4)));

    // мостки
    if (o.catwalk !== false) {
      g.add(PG.rect(-200, 440, 520, 26, '#0a2228'));
      g.add(PG.truss(-200, 466, 520, 60, C.steel, 64));
      g.add(PG.line([320, 453, cx - hw - 40, 453], C.steel, 8));
      g.add(PG.rect(880, 1180, 520, 28, '#0a2228'));
      g.add(PG.truss(880, 1208, 520, 70, C.steel, 70));
      g.add(PG.line([880, 1194, cx + hw + 40, 1194], C.steel, 8));
      for (let i = 0; i < 12; i++) {
        g.add(PG.line([-160 + i * 40, 440, -160 + i * 40, 356], PG.rgba(C.steel3, 0.8), 3));
        g.add(PG.line([890 + i * 44, 1180, 890 + i * 44, 1096], PG.rgba(C.steel3, 0.8), 3));
      }
      g.add(PG.line([-200, 356, 330, 356], PG.rgba(t.light, 0.4), 3));
      g.add(PG.line([880, 1096, 1220, 1096], PG.rgba(t.light, 0.35), 3));
    }
    // лестница
    for (let i = 0; i < 13; i++) {
      g.add(PG.rect(300 + i * 12, 470 + i * 62, 130, 8, '#0d2b33', { opacity: 0.9 }));
    }
    g.add(PG.rect(-200, 110, W + 400, 28, '#0a2026'));
    alarm(g, 150, 260, C.red);
    alarm(g, 1050, 260, C.red);
    if (o.broken) {
      g.add(PG.cracks({ x: 80, y: 700, w: 900, h: 700, lines: 8, color: '#5a3418', alpha: 0.5, seed: 44, width: 3 }));
      debris(g, 22, 55, '#33221a');
    }
    fogLayer(g, t, o.fog == null ? 1 : o.fog, (o.seed || 5) + 3);
  };

  /** лаборатория: плитка, стеклянная камера, пульты */
  SET.lab = function (g, o) {
    const t = PG.tone(o.tone || 'teal');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 96 });
    g.add(PG.rect(-200, -200, W + 400, 520, undefined, PG.vgrad([0, PG.rgba(t.panel, 0.8), 1, PG.rgba(t.panel, 0)], 520)));
    if (o.tank !== false) {
      const gx = o.tankX || 620, gy = 380, gw = o.tankW || 480, gh = 820;
      g.add(PG.glow(gx + gw / 2, gy + gh / 2, 620, o.tankGlow || t.light, 0.16));
      g.add(PG.rect(gx - 34, gy - 34, gw + 68, gh + 68, '#0c252c'));
      g.add(PG.rect(gx - 16, gy - 16, gw + 32, gh + 32, C.ink));
      g.add(PG.rect(gx, gy, gw, gh, undefined, PG.vgrad([0, PG.rgba('#143c46', 0.55), 1, PG.rgba('#051014', 0.9)], gh)));
      for (let i = 1; i < 6; i++) {
        g.add(PG.rect(gx + (gw / 6) * i, gy, 4, gh, PG.rgba(C.steel3, 0.3)));
      }
      g.add(PG.glass(gx, gy, gw, gh));
      g.add(PG.cracks({ x: gx + gw * 0.4, y: gy + 120, w: gw * 0.4, h: gh * 0.6, lines: 3, color: '#9df6ff', alpha: 0.22, seed: 12, width: 2 }));
      g.add(PG.rect(gx - 34, gy - 34, gw + 68, 12, C.steel3));
      g.add(PG.rect(gx - 34, gy + gh + 22, gw + 68, 12, C.steel3));
      for (let i = 0; i < 4; i++) {
        g.add(PG.rect(gx + gw * 0.2 + i * gw * 0.2, gy + gh + 8, 46, 22, C.steel));
      }
    }
    if (o.console !== false) {
      const px = o.consoleX || 920, py = o.consoleY || 1080;
      g.add(PG.panel(px, py, 240, 220, { fill: t.panel, edge: C.steel3, rivets: true }));
      g.add(PG.rect(px + 16, py + 18, 208, 100, '#020a0c'));
      g.add(PG.waveform(px + 24, py + 50, 190, 40, PG.rgba(t.light, 0.7), 9, 26));
      g.add(PG.rect(px + 16, py + 136, 100, 6, PG.rgba(t.light, 0.3)));
      g.add(PG.circle(px + 200, py + 170, 8, t.light, { shadowColor: t.light, shadowBlur: 20 }));
    }
    if (o.cells) {
      for (let i = 1; i < 5; i++) {
        g.add(PG.line([i * 300 - 200, -200, i * 300 - 200, 1400], PG.rgba(t.light, 0.08), 2));
      }
    }
    floorGrate(g, t, 1460);
    fogLayer(g, t, o.fog == null ? 0.8 : o.fog, (o.seed || 8) + 2);
    g.add(PG.drips(0, -40, W, 340, t.ink, (o.seed || 8) + 1, 14));
  };

  /** медотсек */
  SET.medbay = function (g, o) {
    const t = PG.tone(o.tone || 'teal');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 120 });
    g.add(PG.rect(-200, -200, W + 400, 420, undefined, PG.vgrad([0, PG.rgba(t.panel, 0.85), 1, PG.rgba(0, 0, 0, 0)], 420)));
    g.add(PG.rect(-200, 1440, W + 400, 500, '#061416'));
    for (let i = 0; i < 8; i++) g.add(PG.rect(-200, 1440 + i * 46, W + 400, 3, PG.rgba(t.light, 0.07)));
    // койки
    const beds = o.beds || [300, 850];
    beds.forEach(function (bx, i) {
      const by = 1080 + (i % 2) * 40;
      g.add(PG.rect(bx - 210, by, 420, 54, '#0d2830'));
      g.add(PG.rect(bx - 210, by + 54, 420, 76, '#081a20'));
      g.add(PG.rect(bx - 210, by + 130, 34, 400, C.steel));
      g.add(PG.rect(bx + 176, by + 130, 34, 400, C.steel));
      g.add(PG.ellipse(bx - 90, by + 10, 74, 26, '#e6eff0', { opacity: 0.16 }));
    });
    if (o.drip !== false) {
      g.add(PG.line([1000, 260, 1000, 940], C.steel3, 4));
      g.add(PG.rect(968, 260, 64, 120, undefined, { stroke: C.steel3, strokeWidth: 3 }));
      g.add(PG.rect(974, 290, 52, 84, PG.rgba(t.light, 0.22)));
      g.add(PG.path('M1000 380 C1000 500 960 640 940 760', PG.rgba(t.light, 0.35), 3));
    }
    g.add(PG.panel(60, 520, 280, 210, { fill: t.panel, edge: C.steel3, rivets: true }));
    g.add(PG.rect(78, 540, 244, 140, '#020a0c'));
    g.add(PG.waveform(86, 578, 228, 66, PG.rgba(t.light, 0.8), 3, 36));
    fogLayer(g, t, o.fog == null ? 0.7 : o.fog, (o.seed || 4) + 6);
  };

  /** тронный зал */
  SET.throne = function (g, o) {
    const t = PG.tone(o.tone || 'violet');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    g.add(PG.circle(600, 620, 360, undefined, { stroke: PG.rgba(C.steel3, 0.4), strokeWidth: 28 }));
    g.add(PG.circle(600, 620, 360, undefined, PG.radial(360, [0, PG.rgba(t.light, 0.12), 0.7, PG.rgba(t.top, 0.3), 1, 'rgba(0,0,0,0)'])));
    g.add(PG.rings(600, 620, 4, 64, t.light, 0.12));
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.08 + i * 0.105);
      g.add(PG.line([600 + Math.cos(a) * 220, 620 + Math.sin(a) * 220, 600 + Math.cos(a) * 1400, 620 + Math.sin(a) * 1400], PG.rgba(t.light, 0.10), 3));
    }
    [110, 250, 950, 1090].forEach(function (x) {
      g.add(PG.rect(x - 34, 260, 68, H, '#0a1e24'));
      g.add(PG.rect(x - 34, 260, 10, H, PG.rgba(t.light, 0.10)));
      g.add(PG.rect(x - 46, 260, 92, 30, '#0e2c33'));
    });
    for (let i = 0; i < 6; i++) {
      g.add(PG.rect(330 - i * 46, 980 + i * 46, 540 + i * 92, 46, i % 2 ? '#0b1e24' : '#0d242b'));
      g.add(PG.rect(330 - i * 46, 980 + i * 46, 540 + i * 92, 3, PG.rgba(t.light, 0.10)));
    }
    if (o.throne !== false) {
      const tx = 600, ty = 980;
      g.add(PG.glow(tx, ty - 190, 500, t.light, 0.2));
      g.add(PG.poly([tx - 150, ty, tx - 190, ty - 330, tx - 120, ty - 420, tx - 40, ty - 350, tx, ty - 470, tx + 40, ty - 350, tx + 120, ty - 420, tx + 190, ty - 330, tx + 150, ty], '#0b141c'));
      g.add(PG.poly([tx - 130, ty, tx - 160, ty - 300, tx - 90, ty - 360, tx - 20, ty - 300, tx, ty - 400, tx + 20, ty - 300, tx + 90, ty - 360, tx + 160, ty - 300, tx + 130, ty], undefined, {
        stroke: PG.rgba(t.light, 0.4), strokeWidth: 3
      }));
      for (let i = 0; i < 4; i++) {
        g.add(PG.path('M' + (tx - 160 - i * 20) + ' ' + (ty - 300 + i * 40) + ' C' + (tx - 260) + ' ' + (ty - 280 + i * 40) + ' ' + (tx - 240) + ' ' + (ty - 100 + i * 30) + ' ' + (tx - 330) + ' ' + (ty - 60 + i * 30), PG.rgba(C.steel3, 0.7), 6));
      }
    }
    if (o.crowd !== false) crowdBack(g, o.crowd === true ? 10 : o.crowd, (o.seed || 6) + 2);
    fogLayer(g, t, o.fog == null ? 1.1 : o.fog, (o.seed || 6) + 1);
  };

  /** бездна / океан */
  SET.abyss = function (g, o) {
    const t = PG.tone(o.tone || 'deep');
    g.add(PG.grect(-200, -200, W + 400, H + 400, [0, '#0b2a34', 0.18, '#071a23', 0.46, '#04121a', 1, '#010508']));
    const rays = PG.group();
    const r = PG.rng((o.seed || 31) + 7);
    for (let i = 0; i < 10; i++) {
      const x = -100 + i * 140 + r() * 70;
      const wd = 40 + r() * 120;
      rays.add(PG.poly([x, -200, x + wd, -200, x + wd * 2.4 + 140, 1100, x + 20, 1100], undefined, {
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: 1100 },
        fillLinearGradientColorStops: [0, PG.rgba(t.warm, 0.09 + r() * 0.07), 1, PG.rgba(t.warm, 0)]
      }));
    }
    g.add(rays);
    g.add(PG.waves({ x: -100, y: 30, w: W + 200, rows: 4, gap: 16, amp: 7, color: t.warm, alpha: 0.2, wl: 210, seed: 4 }));
    if (o.station) {
      const sx = o.station[0], sy = o.station[1], ss = o.station[2] || 1;
      const st = PG.group({ x: sx, y: sy, scale: ss });
      st.add(PG.glow(0, 0, 220, t.light, 0.3));
      st.add(PG.glow(0, 0, 70, t.warm, 0.4));
      st.add(PG.rect(-46, -16, 92, 20, '#07171d'));
      st.add(PG.rect(-30, -34, 22, 18, '#0a1e25'));
      st.add(PG.rect(14, -30, 16, 14, '#0a1e25'));
      st.add(PG.circle(0, -44, 16, undefined, { stroke: PG.rgba(t.light, 0.6), strokeWidth: 2 }));
      [[-40, -6], [-14, -10], [12, -8], [36, -12], [0, -50]].forEach(function (p) {
        st.add(PG.circle(p[0], p[1], 2.4, t.warm, { shadowColor: t.warm, shadowBlur: 12 }));
      });
      g.add(st);
      g.add(PG.rings(sx, sy, 3, 100 * ss, t.light, 0.10));
      g.add(PG.bubbles(sx, sy - 20, 14, { height: 420, spread: 100, maxR: 6, seed: 8 }));
    }
    if (o.trench !== false) {
      g.add(PG.poly([-200, 1100, 150, 1180, 90, 1340, 240, 1480, 120, 1900, -200, 1900], '#020c11'));
      g.add(PG.poly([-200, 1260, 170, 1310, 120, 1470, 250, 1600, 140, 1900, -200, 1900], '#010709'));
      g.add(PG.poly([W + 200, 1060, 1040, 1160, 1110, 1300, 970, 1450, 1080, 1620, W + 200, 1700], '#020c11'));
      g.add(PG.poly([W + 200, 1230, 1030, 1290, 1080, 1440, 950, 1570, 1060, 1900, W + 200, 1900], '#010709'));
      g.add(PG.path('M-200 1100 L150 1180 L90 1340 L240 1480', PG.rgba(t.light, 0.16), 2));
      g.add(PG.path('M1220 1060 L1040 1160 L1110 1300 L970 1450', PG.rgba(t.light, 0.14), 2));
    }
    if (o.fish) {
      const fr = PG.rng((o.seed || 3) + 21);
      for (let i = 0; i < 6; i++) {
        const fx = 80 + fr() * 1040, fy = 300 + fr() * 700;
        g.add(PG.path('M' + fx + ' ' + fy + ' C' + (fx + 50) + ' ' + (fy - 20) + ' ' + (fx + 110) + ' ' + (fy - 14) + ' ' + (fx + 130) + ' ' + fy + ' C' + (fx + 110) + ' ' + (fy + 14) + ' ' + (fx + 50) + ' ' + (fy + 20) + ' ' + fx + ' ' + fy + ' Z', 'rgba(2,10,14,0.9)', 0, { closed: true, fill: 'rgba(2,10,14,0.9)' }));
        g.add(PG.poly([fx + 130, fy, fx + 168, fy - 16, fx + 160, fy, fx + 168, fy + 16], 'rgba(2,10,14,0.9)'));
      }
    }
    if (o.creature) {
      const cr = PG.rng((o.seed || 5) + 33);
      g.add(PG.glow(o.creature[0], o.creature[1], 300, t.light, 0.12));
      for (let i = 0; i < 6; i++) {
        const x0 = o.creature[0] + (i - 2.5) * 60;
        g.add(PG.path('M' + x0 + ' ' + o.creature[1] + ' C' + (x0 + 40) + ' ' + (o.creature[1] + 90) + ' ' + (x0 - 30) + ' ' + (o.creature[1] + 170) + ' ' + (x0 + 20) + ' ' + (o.creature[1] + 260), 'rgba(3,14,18,0.95)', 18 + cr() * 16));
      }
      g.add(PG.circle(o.creature[0], o.creature[1], 4, t.warm, { shadowColor: t.warm, shadowBlur: 24 }));
    }
    fogLayer(g, t, o.fog == null ? 1.2 : o.fog, (o.seed || 3) + 4);
  };

  /** криокамера */
  SET.cryo = function (g, o) {
    const t = PG.tone(o.tone || 'ice');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 140 });
    g.add(PG.rect(-200, -200, W + 400, 300, undefined, PG.vgrad([0, PG.rgba(t.panel, 0.9), 1, PG.rgba(0, 0, 0, 0)], 300)));
    const pods = o.pods || 6;
    for (let i = 0; i < pods; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const px = 120 + col * 360 + (row % 2) * 40;
      const py = 380 + row * 520;
      const pw = 260, ph = 420;
      g.add(PG.glow(px + pw / 2, py + ph / 2, 300, t.light, 0.12));
      g.add(PG.rect(px - 16, py - 16, pw + 32, ph + 32, '#0d2733'));
      g.add(PG.rect(px, py, pw, ph, undefined, PG.vgrad([0, 'rgba(157,246,255,0.16)', 0.6, 'rgba(40,110,130,0.14)', 1, 'rgba(4,16,22,0.6)'], ph)));
      g.add(PG.rect(px, py, pw, ph, undefined, { stroke: 'rgba(157,246,255,0.25)', strokeWidth: 2 }));
      // силуэт внутри
      if (o.bodies !== false) {
        g.add(PG.group({ opacity: 0.45 }).add(PG.fig.silhouette({ x: px + pw / 2, y: py + ph - 40, scale: 0.62, sil: '#0a1c22' })));
      }
      g.add(PG.rect(px + 10, py + 10, pw - 20, 16, PG.rgba(t.warm, 0.35)));
      g.add(PG.rect(px + 10, py + ph - 26, pw - 20, 8, PG.rgba(t.warm, 0.2)));
      g.add(PG.rect(px - 16, py + ph + 16, pw + 32, 14, C.steel3));
      if (o.frost !== false) {
        g.add(PG.path('M' + (px + 20) + ' ' + (py + 40) + ' C' + (px + 70) + ' ' + (py + 120) + ' ' + (px + 40) + ' ' + (py + 220) + ' ' + (px + 92) + ' ' + (py + 300), PG.rgba('#d9fbff', 0.22), 4));
        g.add(PG.circle(px + 200, py + 90, 22, PG.rgba('#d9fbff', 0.1)));
      }
    }
    floorGrate(g, t, 1520);
    fogLayer(g, t, o.fog == null ? 0.7 : o.fog, (o.seed || 9) + 2);
  };

  /** серверная */
  SET.server = function (g, o) {
    const t = PG.tone(o.tone || 'ice');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 100 });
    const rows = o.rows || [90, 420, 750];
    rows.forEach(function (rx, ri) {
      for (let i = 0; i < 3; i++) {
        const y = 260 + i * 380;
        g.add(PG.rect(rx, y, 240, 340, '#0a1f26'));
        g.add(PG.rect(rx + 8, y + 8, 224, 324, undefined, { stroke: PG.rgba(t.light, 0.12), strokeWidth: 1 }));
        for (let k = 0; k < 9; k++) {
          g.add(PG.rect(rx + 20, y + 24 + k * 34, 200, 22, '#061419'));
          g.add(PG.circle(rx + 34, y + 35 + k * 34, 3, (k + i) % 3 === 0 ? C.lime : t.light, { shadowColor: (k + i) % 3 === 0 ? C.lime : t.light, shadowBlur: 10 }));
          g.add(PG.rect(rx + 52, y + 30 + k * 34, 120, 3, PG.rgba(t.warm, 0.14)));
        }
      }
    });
    // кабели под потолком
    const r = PG.rng((o.seed || 4) + 17);
    for (let i = 0; i < 14; i++) {
      const x = r() * W;
      g.add(PG.path('M' + x + ' -40 C' + (x + 40) + ' 200 ' + (x - 30) + ' 420 ' + (x + 60) + ' 620', PG.rgba(C.steel3, 0.35), 4));
    }
    if (o.core) {
      g.add(PG.glow(600, 900, 420, t.light, 0.2));
      g.add(PG.circle(600, 900, 150, undefined, { stroke: PG.rgba(t.light, 0.5), strokeWidth: 6 }));
      g.add(PG.rings(600, 900, 4, 40, t.light, 0.2));
      g.add(PG.waveform(480, 880, 240, 60, t.warm, 5, 30));
    }
    floorGrate(g, t, 1500);
    fogLayer(g, t, o.fog == null ? 0.5 : o.fog, (o.seed || 6) + 3);
  };

  /** сонарная рубка */
  SET.sonar = function (g, o) {
    const t = PG.tone(o.tone || 'ice');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 130 });
    g.add(PG.circle(600, 560, 400, '#02141a'));
    g.add(PG.circle(600, 560, 400, undefined, { stroke: PG.rgba(t.light, 0.35), strokeWidth: 6 }));
    g.add(PG.circle(600, 560, 340, undefined, { stroke: PG.rgba(t.light, 0.15), strokeWidth: 2 }));
    g.add(PG.grid({ x: 260, y: 220, w: 680, h: 680, step: 68, alpha: 0.06, color: t.light }));
    g.add(PG.rings(600, 560, 4, 80, t.light, 0.18));
    g.add(PG.waveform(300, 620, 600, 120, PG.rgba(t.light, 0.5), 11, 48));
    g.add(PG.arc(600, 560, 340, 46, PG.rgba(t.light, 0.12), { rotation: -150 }));
    // пульт
    g.add(PG.panel(140, 1020, 380, 240, { fill: t.panel, edge: C.steel3, rivets: true }));
    g.add(PG.rect(160, 1042, 340, 130, '#020a0c'));
    g.add(PG.rings(330, 1100, 4, 24, t.light, 0.3));
    g.add(PG.panel(720, 1020, 340, 240, { fill: t.panel, edge: C.steel3, rivets: true }));
    g.add(PG.rect(740, 1042, 300, 130, '#020a0c'));
    g.add(PG.waveform(750, 1070, 280, 70, PG.rgba(t.warm, 0.6), 7, 30));
    floorGrate(g, t, 1360);
    fogLayer(g, t, o.fog == null ? 0.5 : o.fog, (o.seed || 2) + 8);
  };

  /** шлюз / затопленный отсек */
  SET.airlock = function (g, o) {
    const t = PG.tone(o.tone || 'teal');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 110 });
    // круглая гермодверь
    const cx = o.cx || 600, cy = o.cy || 620, r = o.r || 330;
    g.add(PG.circle(cx, cy, r + 40, C.steel));
    g.add(PG.circle(cx, cy, r + 24, C.ink));
    g.add(PG.circle(cx, cy, r, undefined, PG.radial(r, [0, 'rgba(20,60,70,0.55)', 1, 'rgba(3,10,14,0.9)'])));
    g.add(PG.circle(cx, cy, r, undefined, { stroke: PG.rgba(t.light, 0.4), strokeWidth: 4 }));
    g.add(PG.circle(cx, cy, r * 0.62, undefined, { stroke: PG.rgba(t.light, 0.16), strokeWidth: 2 }));
    // штурвал
    g.add(PG.circle(cx, cy, 90, undefined, { stroke: C.steel3, strokeWidth: 12 }));
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      g.add(PG.line([cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, cx + Math.cos(a) * 96, cy + Math.sin(a) * 96], C.steel3, 8));
    }
    g.add(PG.circle(cx, cy, 26, C.steel));
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      g.add(PG.circle(cx + Math.cos(a) * (r + 26), cy + Math.sin(a) * (r + 26), 5, PG.rgba(t.warm, 0.5)));
    }
    if (o.water != null) waterLine(g, t, o.water, (o.seed || 5) + 2);
    if (o.leak) {
      g.add(PG.path('M' + (cx + 120) + ' ' + (cy + 40) + ' C' + (cx + 190) + ' ' + (cy + 200) + ' ' + (cx + 140) + ' ' + (cy + 380) + ' ' + (cx + 230) + ' ' + (cy + 560), PG.rgba(t.warm, 0.25), 10));
      g.add(PG.bubbles(cx + 190, cy + 500, 14, { height: 500, spread: 160, maxR: 7, seed: 12 }));
    }
    if (o.alarm !== false) alarm(g, 180, 260, o.alarmColor || C.red);
    floorGrate(g, t, 1460);
    fogLayer(g, t, o.fog == null ? 1 : o.fog, (o.seed || 5) + 5);
  };

  /** руины: обрушенный зал */
  SET.ruins = function (g, o) {
    const t = PG.tone(o.tone || 'bone');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    g.add(PG.poly([-200, 1200, 120, 980, 300, 1100, 460, 840, 700, 1080, 900, 900, 1100, 1120, 1400, 980, 1400, 2000, -200, 2000], '#0a0f12'));
    g.add(PG.poly([-200, 2000, -200, 900, 200, 760, 340, 980, 220, 2000], '#0b1114'));
    // балки
    for (let i = 0; i < 5; i++) {
      const x = 120 + i * 240;
      g.add(PG.poly([x, 2000, x + 40, 2000, x + 20, 380 + (i % 2) * 90], '#141c20'));
      g.add(PG.poly([x + 20, 380 + (i % 2) * 90, x + 300, 240 + (i % 3) * 60, x + 316, 268 + (i % 3) * 60, x + 40, 420 + (i % 2) * 90], '#101a1e'));
    }
    // свисающие кабели
    const r = PG.rng((o.seed || 7) + 13);
    for (let i = 0; i < 12; i++) {
      const x = r() * W;
      g.add(PG.path('M' + x + ' 120 C' + (x + 30) + ' ' + (300 + r() * 200) + ' ' + (x - 20) + ' ' + (420 + r() * 200) + ' ' + (x + 40) + ' ' + (560 + r() * 200), PG.rgba(C.steel3, 0.3), 3));
    }
    debris(g, 26, (o.seed || 7) + 2, '#161f24');
    if (o.fire) {
      [[260, 1240], [980, 1180]].forEach(function (p) {
        g.add(PG.glow(p[0], p[1], 260, C.ember, 0.3));
        g.add(PG.burst(p[0], p[1], 90, 10, C.ember, 0.4));
      });
      g.add(PG.murk(-200, 900, W + 400, 700, '#3a1d0a', 8, 41, 0.18));
    }
    if (o.water != null) waterLine(g, t, o.water, (o.seed || 7) + 6);
    fogLayer(g, t, o.fog == null ? 1.2 : o.fog, (o.seed || 7) + 4);
  };

  /** купол / био-сад с мутантами */
  SET.dome = function (g, o) {
    const t = PG.tone(o.tone || 'green');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    g.add(PG.circle(600, 900, 760, undefined, PG.radial(760, [0, PG.rgba(t.light, 0.14), 0.6, 'rgba(3,14,10,0.6)', 1, 'rgba(0,0,0,0)'])));
    for (let i = 0; i < 10; i++) {
      g.add(PG.arc(600, 900, 700, 8, PG.rgba(C.steel3, 0.22), { rotation: i * 36, innerRadius: 690 }));
    }
    // светящиеся наросты
    const r = PG.rng((o.seed || 11) + 5);
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = 1080 + r() * 620, s = 20 + r() * 60;
      g.add(PG.ellipse(x, y, s, s * (0.5 + r() * 0.6), PG.rgba('#0d2a1e', 0.9)));
      g.add(PG.glow(x, y, s * 2.4, t.light, 0.10));
      g.add(PG.circle(x + (r() - 0.5) * s, y - s * 0.4, 2 + r() * 3, t.warm, { shadowColor: t.warm, shadowBlur: 16 }));
    }
    // лианы
    for (let i = 0; i < 12; i++) {
      const x = 40 + i * 100;
      g.add(PG.path('M' + x + ' -100 C' + (x + 60) + ' 200 ' + (x - 40) + ' 520 ' + (x + 50) + ' 900', PG.rgba('#123a28', 0.8), 5 + (i % 4)));
    }
    if (o.water != null) waterLine(g, t, o.water, (o.seed || 11) + 2);
    fogLayer(g, t, o.fog == null ? 1.2 : o.fog, (o.seed || 11) + 3);
  };

  /** поверхность / всплытие */
  SET.surface = function (g, o) {
    g.add(PG.grect(-200, -400, W + 400, H + 600, [0, '#dff2f6', 0.18, '#6fb6c4', 0.4, '#12414f', 0.72, '#04141c', 1, '#010609']));
    g.add(PG.glow(600, 120, 900, '#ffffff', 0.5));
    g.add(PG.rings(600, 60, 8, 120, '#eafcff', 0.2));
    g.add(PG.waves({ x: -100, y: 260, w: W + 200, rows: 10, gap: 46, amp: 16, color: '#ffffff', alpha: 0.3, wl: 260, seed: 3 }));
    g.add(PG.glow(600, 1200, 700, '#2fb9c4', 0.16));
    if (o.sub) {
      g.add(PG.group({ x: 600, y: 1120, scale: o.sub[0] || 1 }).add(
        (function () {
          const s = PG.group();
          s.add(PG.ellipse(0, 0, 220, 120, '#1a3238'));
          s.add(PG.ellipse(0, -40, 120, 90, '#123039'));
          s.add(PG.circle(140, 40, 40, '#0f262c'));
          s.add(PG.circle(-120, 70, 26, '#0f262c'));
          s.add(PG.rect(-40, -60, 90, 30, PG.rgba('#9df6ff', 0.5)));
          s.add(PG.glow(0, 0, 380, '#9df6ff', 0.2));
          for (let i = 0; i < 9; i++) s.add(PG.circle(-120 + i * 30, 90 + (i % 3) * 10, 3, '#ffe08a'));
          return s;
        })()
      ));
      g.add(PG.bubbles(600, 1000, 26, { height: 900, spread: 380, maxR: 10, seed: 4 }));
    }
    g.add(PG.speckles({ x0: -100, y0: 200, x1: W + 100, y1: H, count: 90, seed: 6, color: '#eafcff', minA: 0.05, maxA: 0.35, minR: 0.6, maxR: 3 }));
  };

  /** схватка: тёмный отсек, вспышки, обломки */
  SET.fight = function (g, o) {
    const t = PG.tone(o.tone || 'violet');
    g.add(PG.rect(-200, -200, W + 400, H + 400, t.ink));
    wallPanels(g, t, { step: 130 });
    // рваные листы и балки
    g.add(PG.poly([-200, 60, 320, -40, 360, 120, -200, 240], '#0c1a20'));
    g.add(PG.poly([W + 200, 1400, 860, 1300, 900, 1500, W + 200, 1620], '#0c1a20'));
    for (let i = 0; i < 4; i++) {
      g.add(PG.line([120 + i * 300, -100, 60 + i * 300, 900], PG.rgba(C.steel3, 0.18), 12));
    }
    for (let i = 0; i < 30; i++) {
      const r = PG.rng((o.seed || 3) + i);
      const x = r() * W, y = 700 + r() * 800, sz = 8 + r() * 30;
      g.add(PG.poly([x, y, x + sz, y - sz * 0.7, x + sz * 1.1, y + sz * 0.5, x - sz * 0.2, y + sz * 0.4], '#131c22', { rotation: r() * 90 }));
    }
    if (o.sparks) {
      [[380, 760], [820, 900], [600, 500]].forEach(function (p) {
        g.add(PG.burst(p[0], p[1], 180, 15, C.amber, 0.35));
        g.add(PG.glow(p[0], p[1], 240, C.amber, 0.2));
      });
    }
    if (o.alert) alarm(g, 190, 300, o.alert);
    g.add(PG.rect(-200, 1420, W + 400, 600, '#050d11'));
    for (let i = 0; i < 10; i++) g.add(PG.rect(-200, 1420 + i * 54, W + 400, 3, PG.rgba(t.light, 0.06)));
    fogLayer(g, t, o.fog == null ? 1.2 : o.fog, (o.seed || 3) + 6);
  };

  /** шахта / вертикальный колодец */
  SET.shaft = function (g, o) {
    const t = PG.tone(o.tone || 'deep');
    g.add(PG.rect(-200, -200, W + 400, H + 400, '#010508'));
    g.add(PG.poly([120, -200, W - 120, -200, W + 200, 2000, -200, 2000], '#061820'));
    g.add(PG.poly([200, -200, W - 200, -200, W - 40, 2000, 40, 2000], '#020c11'));
    for (let i = 0; i < 14; i++) {
      const y = -100 + i * 160;
      const k = 1 + i * 0.03;
      g.add(PG.rect(120 - i * 4, y, W - 240 + i * 8, 12, PG.rgba(t.panel, 0.9)));
      g.add(PG.rect(120 - i * 4, y, W - 240 + i * 8, 2, PG.rgba(t.light, 0.12)));
      if (i % 2 === 0) {
        g.add(PG.rect(240, y + 24, 160, 8, PG.rgba(t.warm, 0.3), { shadowColor: t.warm, shadowBlur: 26 }));
        g.add(PG.rect(W - 400, y + 24, 160, 8, PG.rgba(t.warm, 0.3), { shadowColor: t.warm, shadowBlur: 26 }));
      }
    }
    // лестница слева
    for (let i = 0; i < 24; i++) {
      g.add(PG.rect(160, -100 + i * 84, 90, 10, C.steel, { opacity: 0.5 }));
    }
    g.add(PG.glow(600, 1700, 600, t.light, 0.12));
    fogLayer(g, t, o.fog == null ? 1.4 : o.fog, (o.seed || 2) + 9);
  };

})(window);
