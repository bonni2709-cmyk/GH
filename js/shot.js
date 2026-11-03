/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — постановка кадра
   shot({ set, cam, cast, prop, light, fx }) собирает страницу:
   локация + камера + персонажи + реквизит + свет + атмосфера.
   Здесь же — сетка «слотов» для HTML-текста.
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const C = PG.C;
  const W = PG.W, H = PG.H;

  /* --------------------------------------------------------------- свет */
  PG.lights = {
    rim: function (g, x, y, color, a) {
      g.add(PG.glow(x, y, 320, color || C.teal, a == null ? 0.22 : a));
    },
    lamp: function (g, x, y, color, a) {
      g.add(PG.glow(x, y, 420, color || C.ice, a == null ? 0.3 : a));
      g.add(PG.rect(x - 60, y - 4, 120, 8, PG.rgba(color || C.ice, 0.8), {
        shadowColor: color || C.ice, shadowBlur: 40
      }));
    },
    shaft: function (g, x, y, w, h, color, a) {
      g.add(PG.poly([x - w / 2, y, x + w / 2, y, x + w, y + h, x - w, y + h], undefined, {
        fillLinearGradientStartPoint: { x: 0, y: y },
        fillLinearGradientEndPoint: { x: 0, y: y + h },
        fillLinearGradientColorStops: [0, PG.rgba(color || C.ice, a == null ? 0.14 : a), 1, PG.rgba(color || C.ice, 0)]
      }));
    },
    screen: function (g, x, y, w, h, color) {
      g.add(PG.rect(x, y, w, h, PG.rgba(color || C.cyan, 0.14)));
      g.add(PG.rect(x, y, w, h, undefined, { stroke: PG.rgba(color || C.cyan, 0.5), strokeWidth: 2 }));
      g.add(PG.waveform(x + 8, y + h * 0.3, w - 16, h * 0.34, PG.rgba(color || C.cyan, 0.7), 3, 24));
    }
  };

  /* ------------------------------------------------------------- реквизит */
  const PROPS = PG.props = {
    crate: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.rect(x, y - 96 * s, 132 * s, 96 * s, '#12262b'));
      g.add(PG.rect(x, y - 96 * s, 132 * s, 8 * s, '#1b3a42'));
      g.add(PG.line([x + 8 * s, y - 88 * s, x + 124 * s, y - 8 * s], 'rgba(90,150,160,0.25)', 5 * s));
      g.add(PG.stencil('Г-1', x + 16 * s, y - 70 * s, 26 * s, '#8fb4bd', 0.35));
    },
    barrel: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.rect(x, y - 130 * s, 84 * s, 130 * s, '#1a2f34'));
      g.add(PG.rect(x, y - 130 * s, 84 * s, 10 * s, '#2b6b78'));
      g.add(PG.rect(x, y - 100 * s, 84 * s, 6 * s, '#0a1418'));
      g.add(PG.rect(x, y - 40 * s, 84 * s, 6 * s, '#0a1418'));
      g.add(PG.rect(x + 10 * s, y - 120 * s, 10 * s, 20 * s, 'rgba(255,179,71,0.35)'));
    },
    pipe: function (g, x1, y1, x2, y2, w) {
      g.add(PG.line([x1, y1, x2, y2], C.steel, w || 16));
      g.add(PG.line([x1, y1, x2, y2], C.steel3, (w || 16) * 0.3));
    },
    valve: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.circle(x, y, 44 * s, undefined, { stroke: C.steel3, strokeWidth: 8 * s }));
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        g.add(PG.line([x, y, x + Math.cos(a) * 44 * s, y + Math.sin(a) * 44 * s], C.steel3, 6 * s));
      }
      g.add(PG.circle(x, y, 10 * s, C.ink));
    },
    terminal: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.rect(x, y - 300 * s, 180 * s, 300 * s, '#0a2027'));
      g.add(PG.rect(x + 12 * s, y - 284 * s, 156 * s, 110 * s, '#020a0c'));
      PG.lights.screen(g, x + 20 * s, y - 274 * s, 140 * s, 90 * s, C.teal);
      g.add(PG.rect(x + 20 * s, y - 150 * s, 140 * s, 8 * s, 'rgba(57,224,210,0.25)'));
      for (let i = 0; i < 6; i++) {
        g.add(PG.rect(x + 20 * s, y - 130 * s + i * 18 * s, 140 * s, 6 * s, 'rgba(90,150,160,0.18)'));
      }
    },
    body: function (g, x, y, s, flip) {
      s = s || 1;
      const b = PG.group({ x: x, y: y, scaleX: flip ? -s : s, scaleY: s });
      b.add(PG.ellipse(0, 0, 150, 26, 'rgba(0,0,0,0.45)'));
      b.add(PG.rect(-130, -60, 150, 54, '#12242a', { cornerRadius: 24 }));
      b.add(PG.circle(-146, -40, 32, '#1d3a40'));
      b.add(PG.rect(-110, -54, 90, 10, 'rgba(90,150,160,0.2)'));
      b.add(PG.rect(-160, -38, 24, 8, 'rgba(140,20,16,0.5)'));
      g.add(b);
    },
    bloodpool: function (g, x, y, s, color) {
      s = s || 1;
      g.add(PG.ellipse(x, y, 150 * s, 30 * s, PG.rgba(color || '#4a0a08', 0.55)));
      g.add(PG.ellipse(x + 40 * s, y - 6 * s, 60 * s, 14 * s, PG.rgba(color || '#4a0a08', 0.4)));
    },
    bones: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.circle(x, y, 26 * s, '#b9c7c4'));
      g.add(PG.ellipse(x + 4 * s, y + 10 * s, 16 * s, 10 * s, '#9aa8a6'));
      g.add(PG.line([x + 30 * s, y + 40 * s, x + 110 * s, y + 20 * s], '#b9c7c4', 9 * s));
      g.add(PG.line([x + 34 * s, y + 54 * s, x + 116 * s, y + 34 * s], '#9aa8a6', 7 * s));
    },
    fungus: function (g, x, y, s, color) {
      s = s || 1;
      g.add(PG.glow(x, y, 120 * s, color || C.lime, 0.18));
      g.add(PG.path('M' + (x - 26 * s) + ' ' + y + ' C' + (x - 20 * s) + ' ' + (y - 60 * s) + ' ' + (x + 20 * s) + ' ' + (y - 60 * s) + ' ' + (x + 26 * s) + ' ' + y + ' Z', PG.rgba(color || C.lime, 0.55)));
      g.add(PG.rect(x - 4 * s, y - 40 * s, 8 * s, 40 * s, '#2a3a2a'));
      for (let i = 0; i < 4; i++) {
        g.add(PG.circle(x - 14 * s + i * 10 * s, y - 34 * s - (i % 2) * 8 * s, 2 * s, C.white, { opacity: 0.6 }));
      }
    },
    egg: function (g, x, y, s, color) {
      s = s || 1;
      g.add(PG.glow(x, y, 140 * s, color || C.lime, 0.2));
      g.add(PG.ellipse(x, y, 54 * s, 74 * s, '#0c1a14'));
      g.add(PG.ellipse(x, y, 54 * s, 74 * s, undefined, { stroke: PG.rgba(color || C.lime, 0.5), strokeWidth: 2 }));
      g.add(PG.path('M' + x + ' ' + (y - 60 * s) + ' C' + (x + 30 * s) + ' ' + (y - 20 * s) + ' ' + (x - 24 * s) + ' ' + (y + 10 * s) + ' ' + x + ' ' + (y + 64 * s), PG.rgba(color || C.lime, 0.4), 3));
    },
    monitor: function (g, x, y, s, color) {
      s = s || 1;
      g.add(PG.rect(x, y, 200 * s, 140 * s, '#08181d'));
      g.add(PG.rect(x + 8 * s, y + 8 * s, 184 * s, 100 * s, '#020a0c'));
      PG.lights.screen(g, x + 16 * s, y + 18 * s, 168 * s, 80 * s, color || C.teal);
      g.add(PG.rect(x + 60 * s, y + 112 * s, 80 * s, 10 * s, '#123039'));
      g.add(PG.rect(x + 90 * s, y + 122 * s, 20 * s, 18 * s, '#123039'));
    },
    photo: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.rect(x, y, 90 * s, 110 * s, '#d9d3c6', { rotation: -4 }));
      g.add(PG.rect(x + 8 * s, y + 8 * s, 74 * s, 72 * s, '#3a4a4e'));
      g.add(PG.circle(x + 45 * s, y + 34 * s, 12 * s, '#7a8b8a'));
      g.add(PG.rect(x + 33 * s, y + 48 * s, 24 * s, 26 * s, '#7a8b8a'));
    },
    tentacles: function (g, x, y, n, s, color) {
      s = s || 1;
      for (let i = 0; i < (n || 5); i++) {
        const dir = i % 2 ? 1 : -1;
        g.add(PG.fig.tentacle(x + (i - (n || 5) / 2) * 22 * s, y - i * 10 * s, (120 + i * 34) * s, dir, (30 + (i % 3) * 8) * s, PG.rgba(color || C.teal, 0.75), 0.95));
      }
    },
    drone: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.glow(x, y, 90 * s, C.ice, 0.25));
      g.add(PG.ellipse(x, y, 30 * s, 18 * s, '#123039'));
      g.add(PG.circle(x - 12 * s, y, 5 * s, C.ice, { shadowColor: C.ice, shadowBlur: 12 }));
      g.add(PG.circle(x + 12 * s, y, 5 * s, C.red, { shadowColor: C.red, shadowBlur: 12 }));
      g.add(PG.line([x - 40 * s, y - 14 * s, x + 40 * s, y - 14 * s], 'rgba(157,246,255,0.3)', 2));
    },
    chair: function (g, x, y, s) {
      s = s || 1;
      g.add(PG.rect(x - 60 * s, y - 60 * s, 120 * s, 60 * s, '#0d2830'));
      g.add(PG.rect(x - 60 * s, y - 260 * s, 30 * s, 210 * s, '#0d2830'));
      g.add(PG.rect(x - 60 * s, y - 60 * s, 12 * s, 60 * s, C.steel));
      g.add(PG.rect(x + 48 * s, y - 60 * s, 12 * s, 60 * s, C.steel));
    }
  };

  PG.prop = function (p) {
    const fn = PROPS[p.type];
    const g = PG.group();
    if (fn) fn(g, p.x, p.y, p.s || 1, p.flip);
    return g;
  };

  /* --------------------------------------------------------------- кадр */
  PG.shot = function (spec) {
    const s = spec || {};
    const g = PG.group();
    const z = (s.cam && s.cam.z) || 1;
    const cx = (s.cam && s.cam.x) || 600;
    const cy = (s.cam && s.cam.y) || 900;
    const seed = s.seed || 11;

    const world = PG.group({
      x: 600, y: 900, offsetX: cx, offsetY: cy, scaleX: z, scaleY: z
    });
    g.add(world);

    // палитра кадра: у локации и у фона она должна быть одной
    const tone = s.tone || (s.setOpts && s.setOpts.tone) || 'teal';

    // фон
    world.add(PG.bg(tone, seed));

    // локация
    const setFn = PG.sets[s.set];
    const opts = Object.assign({ seed: seed, tone: tone }, s.setOpts || {});
    if (setFn) setFn(world, opts);

    // реквизит (до персонажей — он «в сцене»)
    (s.prop || []).forEach(function (p) {
      world.add(PG.prop(p));
    });

    // персонажи
    (s.cast || []).forEach(function (c) {
      const fn = PG.fig[c.who];
      if (!fn) return;
      const o = Object.assign({
        x: c.x, y: c.y, scale: c.s == null ? 1 : c.s, flip: c.flip,
        rim: c.rim, eye: c.eye, look: c.look
      }, c.opts || {});
      if (c.rot) {
        const gg = PG.group({ x: c.x, y: c.y, rotation: c.rot });
        gg.add(fn(Object.assign({}, o, { x: 0, y: 0 })));
        world.add(gg);
      } else {
        world.add(fn(o));
      }
    });

    // мировой свет
    (s.glow || []).forEach(function (L) {
      world.add(PG.glow(L.x, L.y, L.r, L.color || C.amber, L.a == null ? 0.3 : L.a));
    });

    // пост-эффекты в экранных координатах
    (s.light || []).forEach(function (L) {
      const sx = (L.x - cx) * z + 600;
      const sy = (L.y - cy) * z + 900;
      (PG.lights[L.kind] || PG.lights.rim)(g, sx, sy, L.color, L.a, L.w, L.h);
    });

    if (s.fx) {
      s.fx.forEach(function (f) {
        const sx = (f.x - cx) * z + 600;
        const sy = (f.y - cy) * z + 900;
        if (f.kind === 'rings') g.add(PG.rings(sx, sy, f.n || 6, f.step || 80, f.color || C.gold, f.a == null ? 0.3 : f.a));
        if (f.kind === 'burst') g.add(PG.burst(sx, sy, f.r || 300, f.n || 20, f.color || C.gold, f.a == null ? 0.4 : f.a));
        if (f.kind === 'bubbles') g.add(PG.bubbles(sx, sy, f.n || 18, { height: f.h || 600, spread: f.spread || 260, maxR: f.r || 8, seed: f.seed || 5 }));
        if (f.kind === 'sparks') g.add(PG.burst(sx, sy, f.r || 120, f.n || 10, f.color || C.amber, f.a == null ? 0.5 : f.a));
        if (f.kind === 'scan') g.add(PG.scanlines({ alpha: f.a == null ? 0.10 : f.a, gap: 6 }));
        if (f.kind === 'water') g.add(PG.waves({ x: 0, y: sy, w: W, rows: 6, gap: 26, amp: 12, color: f.color || C.teal, alpha: 0.2, wl: 220, seed: f.seed || 3 }));
        if (f.kind === 'snow') g.add(PG.speckles({ x0: 0, y0: 0, x1: W, y1: H, count: f.n || 120, seed: f.seed || 9, color: '#eafcff', minA: 0.05, maxA: 0.4, minR: 0.8, maxR: 3 }));
        if (f.kind === 'ash') g.add(PG.speckles({ x0: 0, y0: 0, x1: W, y1: H, count: f.n || 80, seed: f.seed || 4, color: '#ffb347', minA: 0.03, maxA: 0.25, minR: 0.6, maxR: 2.4 }));
      });
    }

    // затемнение кадра и зерно
    g.add(PG.vignette(s.vig == null ? 0.9 : s.vig, s.vigColor));
    if (s.grain !== false) {
      g.add(PG.speckles({ x0: 0, y0: 0, x1: W, y1: H, count: 40, seed: seed + 3, color: '#dff6ff', minA: 0.01, maxA: 0.05, minR: 0.4, maxR: 1.3 }));
    }
    if (s.flash) {
      g.add(PG.rect(0, 0, W, H, s.flash, { opacity: s.flashA == null ? 0.35 : s.flashA }));
    }
    if (s.frame !== false) {
      g.add(PG.rect(26, 26, W - 52, H - 52, undefined, { stroke: 'rgba(157,246,255,0.14)', strokeWidth: 2 }));
      [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(function (p) {
        g.add(PG.pip(p[0], p[1], 2, 'rgba(157,246,255,0.45)'));
      });
    }
    return g;
  };

  /* ------------------------------------------------- сетка слотов текста
     Координаты в системе страницы 1200×1800. Подобраны так, чтобы блоки
     не наезжали друг на друга и не закрывали нижнюю плашку.
     ==================================================================== */
  PG.SLOTS = {
    TL1:   { x: 84,  y: 96,   w: 560, size: 26 },
    TL2:   { x: 84,  y: 318,  w: 520, size: 25 },
    TL3:   { x: 84,  y: 540,  w: 500, size: 24 },
    TR1:   { x: 646, y: 96,   w: 470, size: 25 },
    TR2:   { x: 660, y: 300,  w: 456, size: 24 },
    TR3:   { x: 674, y: 500,  w: 442, size: 23 },
    ML:    { x: 84,  y: 700,  w: 470, size: 24 },
    MR:    { x: 700, y: 720,  w: 430, size: 24 },
    CL:    { x: 84,  y: 1020, w: 470, size: 24 },
    CR:    { x: 700, y: 1020, w: 430, size: 24 },
    BL1:   { x: 84,  y: 1180, w: 470, size: 24 },
    BL2:   { x: 84,  y: 1348, w: 470, size: 23 },
    BL3:   { x: 84,  y: 1496, w: 460, size: 22 },
    BR1:   { x: 700, y: 1180, w: 430, size: 24 },
    BR2:   { x: 700, y: 1348, w: 430, size: 23 },
    BR3:   { x: 700, y: 1496, w: 430, size: 22 },
    WIDE:  { x: 84,  y: 1490, w: 620, size: 23 },
    MID:   { x: 84,  y: 900,  w: 470, size: 24 }
  };

  /* где расположить точку-маркер реплики (у головы говорящего) */
  PG.headPoint = function (c) {
    const s = c.s == null ? 1 : c.s;
    return { x: c.x, y: c.y - 330 * s };
  };

})(window);
