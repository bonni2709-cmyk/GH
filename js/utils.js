/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — рисовальный слой
   Только Konva.js: вся графика собрана из Rect / Line / Circle / Path / Arc.
   Никаких изображений, SVG и внешних ассетов.
   ========================================================================== */
(function (global) {
  'use strict';

  const PG = global.PG = global.PG || {};

  PG.W = 1200;
  PG.H = 1800;

  /* ------------------------------------------------------------------ палитра */
  PG.C = {
    void:   '#010406',
    ink:    '#03080c',
    abyss:  '#050f16',
    deep:   '#081d27',
    deep2:  '#0b2a36',
    steel:  '#123039',
    steel2: '#1b4a58',
    steel3: '#2b6b78',
    teal:   '#39e0d2',
    cyan:   '#9df6ff',
    ice:    '#d9fbff',
    bone:   '#dcebee',
    fog:    '#8fb4bd',
    amber:  '#ffb347',
    gold:   '#ffe08a',
    rust:   '#c4552f',
    ember:  '#ff7a2f',
    red:    '#ff3d33',
    blood:  '#8d1410',
    lime:   '#9ef01a',
    acid:   '#c8ff3d',
    violet: '#9a7bff',
    lilac:  '#cbb6ff',
    white:  '#eafcff',
    black:  '#000000'
  };

  /* ------------------------------------------------------------------ утилиты */
  PG.rgba = function (hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  PG.mix = function (a, b, t) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const r = Math.round(((A >> 16) & 255) * (1 - t) + ((B >> 16) & 255) * t);
    const g = Math.round(((A >> 8) & 255) * (1 - t) + ((B >> 8) & 255) * t);
    const bl = Math.round((A & 255) * (1 - t) + (B & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  };

  /* детерминированный генератор — каждая страница рисуется одинаково */
  PG.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PG.lerp = (a, b, t) => a + (b - a) * t;
  PG.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------------ узлы */
  const base = { listening: false, perfectDrawEnabled: false };

  PG.group = function (opts) {
    return new Konva.Group(Object.assign({}, base, opts));
  };

  PG.rect = function (x, y, w, h, fill, opts) {
    return new Konva.Rect(Object.assign({}, base, {
      x: x, y: y, width: w, height: h, fill: fill
    }, opts || {}));
  };

  PG.line = function (points, stroke, width, opts) {
    return new Konva.Line(Object.assign({}, base, {
      points: points, stroke: stroke || PG.C.cyan, strokeWidth: width == null ? 2 : width,
      lineCap: 'round', lineJoin: 'round'
    }, opts || {}));
  };

  PG.path = function (d, stroke, width, opts) {
    return new Konva.Path(Object.assign({}, base, {
      data: d, stroke: stroke, strokeWidth: width == null ? 2 : width,
      lineCap: 'round', lineJoin: 'round'
    }, opts || {}));
  };

  PG.circle = function (x, y, r, fill, opts) {
    return new Konva.Circle(Object.assign({}, base, {
      x: x, y: y, radius: r, fill: fill
    }, opts || {}));
  };

  PG.ellipse = function (x, y, rx, ry, fill, opts) {
    return new Konva.Ellipse(Object.assign({}, base, {
      x: x, y: y, radiusX: rx, radiusY: ry, fill: fill
    }, opts || {}));
  };

  PG.arc = function (x, y, r, angle, fill, opts) {
    return new Konva.Arc(Object.assign({}, base, {
      x: x, y: y, innerRadius: opts && opts.innerRadius || 0, outerRadius: r,
      angle: angle, fill: fill
    }, opts || {}));
  };

  PG.star = function (x, y, n, r1, r2, fill, opts) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI / n) * i - Math.PI / 2;
      const r = i % 2 ? r2 : r1;
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    return new Konva.Line(Object.assign({}, base, {
      points: pts, closed: true, fill: fill
    }, opts || {}));
  };

  PG.poly = function (points, fill, opts) {
    return new Konva.Line(Object.assign({}, base, {
      points: points, closed: true, fill: fill
    }, opts || {}));
  };

  PG.text = function (str, x, y, size, fill, opts) {
    return new Konva.Text(Object.assign({}, base, {
      text: str, x: x, y: y, fontSize: size || 24, fill: fill || PG.C.bone,
      fontFamily: 'Arial, Helvetica, sans-serif'
    }, opts || {}));
  };

  /* ------------------------------------------------------------------ градиенты */
  PG.vgrad = function (stops, h) {
    h = h || 1;
    return {
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: h },
      fillLinearGradientColorStops: stops
    };
  };

  PG.hgrad = function (stops, w) {
    w = w || 1;
    return {
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: w, y: 0 },
      fillLinearGradientColorStops: stops
    };
  };

  PG.radial = function (r, stops, cx, cy) {
    return {
      fillRadialGradientStartPoint: { x: cx || 0, y: cy || 0 },
      fillRadialGradientEndPoint: { x: cx || 0, y: cy || 0 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: r,
      fillRadialGradientColorStops: stops
    };
  };

  /** прямоугольник с вертикальным градиентом */
  PG.grect = function (x, y, w, h, stops) {
    return PG.rect(x, y, w, h, undefined, PG.vgrad(stops, h));
  };

  /** мягкое круглое свечение */
  PG.glow = function (x, y, r, color, alpha, opts) {
    return PG.circle(x, y, r, undefined, Object.assign({
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: r,
      fillRadialGradientColorStops: [
        0, PG.rgba(color, alpha == null ? 0.5 : alpha),
        0.45, PG.rgba(color, (alpha == null ? 0.5 : alpha) * 0.35),
        1, PG.rgba(color, 0)
      ]
    }, opts || {}));
  };

  PG.vignette = function (strength, color) {
    const g = PG.group();
    const c = color || '#000000';
    const s = strength == null ? 0.85 : strength;
    g.add(PG.rect(0, 0, PG.W, 260, undefined, PG.vgrad([
      0, PG.rgba(c, s), 1, PG.rgba(c, 0)
    ], 260)));
    g.add(PG.rect(0, PG.H - 340, PG.W, 340, undefined, PG.vgrad([
      0, PG.rgba(c, 0), 1, PG.rgba(c, s)
    ], 340)));
    g.add(PG.rect(0, 0, 220, PG.H, undefined, PG.hgrad([
      0, PG.rgba(c, s * 0.9), 1, PG.rgba(c, 0)
    ], 220)));
    g.add(PG.rect(PG.W - 220, 0, 220, PG.H, undefined, PG.hgrad([
      0, PG.rgba(c, 0), 1, PG.rgba(c, s * 0.9)
    ], 220)));
    return g;
  };

  PG.scrim = function (x, y, w, h, alpha, dir) {
    const a = alpha == null ? 0.75 : alpha;
    const g = PG.group();
    if (dir === 'h') {
      g.add(PG.rect(x, y, w, h, undefined, PG.hgrad([0, PG.rgba('#000', 0), 1, PG.rgba('#000', a)], w)));
    } else if (dir === 'hr') {
      g.add(PG.rect(x, y, w, h, undefined, PG.hgrad([0, PG.rgba('#000', a), 1, PG.rgba('#000', 0)], w)));
    } else {
      g.add(PG.rect(x, y, w, h, undefined, PG.vgrad([0, PG.rgba('#000', 0), 1, PG.rgba('#000', a)], h)));
    }
    return g;
  };

  /* ------------------------------------------------------------------ текстуры */
  /** россыпь частиц (пыль, пузыри, планктон) */
  PG.speckles = function (o) {
    o = o || {};
    const g = PG.group();
    const r = PG.rng(o.seed || 7);
    const n = o.count || 90;
    const col = o.color || PG.C.cyan;
    for (let i = 0; i < n; i++) {
      const x = o.x0 + r() * (o.x1 - o.x0);
      const y = o.y0 + r() * (o.y1 - o.y0);
      const rad = PG.lerp(o.minR || 0.8, o.maxR || 3.2, r());
      const a = PG.lerp(o.minA || 0.05, o.maxA || 0.5, r());
      g.add(PG.circle(x, y, rad, PG.rgba(col, a)));
      if (o.halo && r() > 0.72) g.add(PG.glow(x, y, rad * 5, col, a * 0.5));
    }
    return g;
  };

  /** горизонтальные линии развёртки */
  PG.scanlines = function (o) {
    o = o || {};
    const g = PG.group();
    const gap = o.gap || 5;
    const col = o.color || '#000000';
    const a = o.alpha == null ? 0.18 : o.alpha;
    for (let y = o.y || 0; y < (o.y2 || o.y + (o.h || PG.H)); y += gap) {
      g.add(PG.rect(o.x || 0, y, o.w || PG.W, o.thick || 1, PG.rgba(col, a)));
    }
    return g;
  };

  /** люминесцентная сетка */
  PG.grid = function (o) {
    o = o || {};
    const g = PG.group();
    const col = o.color || PG.C.teal;
    const a = o.alpha == null ? 0.12 : o.alpha;
    for (let x = o.x || 0; x <= (o.x || 0) + (o.w || PG.W); x += o.step || 60) {
      g.add(PG.rect(x, o.y || 0, 1, o.h || PG.H, PG.rgba(col, a)));
    }
    for (let y = o.y || 0; y <= (o.y || 0) + (o.h || PG.H); y += o.step || 60) {
      g.add(PG.rect(o.x || 0, y, o.w || PG.W, 1, PG.rgba(col, a)));
    }
    return g;
  };

  /** следы потёков/ржавчины */
  PG.drips = function (x, y, w, h, color, seed, n) {
    const g = PG.group();
    const r = PG.rng(seed || 3);
    for (let i = 0; i < (n || 12); i++) {
      const dx = x + r() * w;
      const len = h * (0.25 + r() * 0.75);
      const wd = 1 + r() * 4;
      g.add(PG.rect(dx, y, wd, len, PG.rgba(color, 0.1 + r() * 0.22)));
      g.add(PG.circle(dx + wd / 2, y + len, wd * 0.8, PG.rgba(color, 0.16 + r() * 0.2)));
    }
    return g;
  };

  /** трещины: ломаные линии */
  PG.cracks = function (o) {
    o = o || {};
    const g = PG.group();
    const r = PG.rng(o.seed || 11);
    const col = o.color || PG.C.steel2;
    const lines = o.lines || 4;
    for (let i = 0; i < lines; i++) {
      let x = o.x + r() * o.w;
      let y = o.y + r() * o.h * 0.4;
      const pts = [x, y];
      const steps = 4 + Math.floor(r() * 5);
      for (let s = 0; s < steps; s++) {
        x += (r() - 0.5) * (o.spread || 90);
        y += (o.h / steps) * (0.5 + r());
        pts.push(x, y);
      }
      g.add(PG.line(pts, col, o.width || 2, { opacity: o.alpha == null ? 0.7 : o.alpha }));
    }
    return g;
  };

  /** заклёпки по прямоугольнику */
  PG.rivets = function (x, y, w, h, color, step) {
    const g = PG.group();
    const s = step || 40;
    const col = color || PG.C.steel3;
    for (let i = x + s / 2; i < x + w; i += s) {
      g.add(PG.circle(i, y, 2.2, PG.rgba(col, 0.55)));
      g.add(PG.circle(i, y + h, 2.2, PG.rgba(col, 0.35)));
    }
    for (let j = y + s / 2; j < y + h; j += s) {
      g.add(PG.circle(x, j, 2.2, PG.rgba(col, 0.45)));
      g.add(PG.circle(x + w, j, 2.2, PG.rgba(col, 0.3)));
    }
    return g;
  };

  /** техническая панель: рамка, заливка, заклёпки, полосы */
  PG.panel = function (x, y, w, h, o) {
    o = o || {};
    const g = PG.group();
    g.add(PG.rect(x, y, w, h, o.fill || PG.C.deep));
    if (o.grad) {
      g.add(PG.rect(x, y, w, h, undefined, PG.vgrad(o.grad, h)));
    }
    g.add(PG.rect(x, y, w, 2, PG.rgba(o.edge || PG.C.steel3, 0.6)));
    g.add(PG.rect(x, y, 2, h, PG.rgba(o.edge || PG.C.steel3, 0.35)));
    if (o.rivets) g.add(PG.rivets(x, y, w, h, o.edge, o.rivetStep || 46));
    if (o.stripe) {
      g.add(PG.rect(x, y + h - 8, w, 8, PG.rgba(o.stripe, 0.5)));
    }
    return g;
  };

  /** люминесцентная полоса-лампа */
  PG.lamp = function (x, y, w, color, opts) {
    const g = PG.group();
    const c = color || PG.C.cyan;
    g.add(PG.glow(x + w / 2, y, w * 1.1, c, 0.35, { scaleY: 0.35 }));
    g.add(PG.rect(x, y - 3, w, 6, PG.rgba(c, 0.9), Object.assign({
      shadowColor: c, shadowBlur: 24
    }, opts || {})));
    g.add(PG.rect(x - 6, y - 7, w + 12, 14, PG.C.steel));
    g.add(PG.rect(x, y - 2, w, 4, PG.C.ice));
    return g;
  };

  /** трубы вдоль стены */
  PG.pipes = function (pts, width, color, o) {
    o = o || {};
    const g = PG.group();
    const w = width || 12;
    g.add(PG.line(pts, PG.C.ink, w + 6, { opacity: 0.85 }));
    g.add(PG.line(pts, color || PG.C.steel2, w));
    g.add(PG.line(pts, PG.rgba(PG.C.steel3, 0.8), Math.max(2, w * 0.22), { offsetX: -w * 0.18, offsetY: -w * 0.18 }));
    for (let i = 2; i < pts.length; i += 2) {
      g.add(PG.circle(pts[i], pts[i + 1], w * 0.72, PG.C.steel));
      g.add(PG.circle(pts[i], pts[i + 1], w * 0.44, PG.C.ink));
    }
    return g;
  };

  /** вода: волнистые линии */
  PG.waves = function (o) {
    o = o || {};
    const g = PG.group();
    const r = PG.rng(o.seed || 5);
    const rows = o.rows || 8;
    for (let i = 0; i < rows; i++) {
      const y = o.y + i * (o.gap || 40);
      const pts = [];
      const amp = (o.amp || 12) * (0.4 + r());
      for (let x = o.x - 40; x <= o.x + o.w + 40; x += 40) {
        pts.push(x, y + Math.sin((x / (o.wl || 160)) + i) * amp);
      }
      g.add(PG.line(pts, PG.rgba(o.color || PG.C.teal, (o.alpha || 0.18) * (1 - i / (rows + 2))), o.width || 2));
    }
    return g;
  };

  /** пузырьковая колонна от точки */
  PG.bubbles = function (x, y, count, o) {
    o = o || {};
    const g = PG.group();
    const r = PG.rng(o.seed || 21);
    for (let i = 0; i < count; i++) {
      const t = r();
      const bx = x + (r() - 0.5) * (o.spread || 160) * t;
      const by = y - t * (o.height || 500);
      const rad = PG.lerp(2, o.maxR || 9, r()) * (0.5 + t * 0.7);
      g.add(PG.circle(bx, by, rad, undefined, {
        stroke: PG.rgba(o.color || PG.C.cyan, 0.15 + 0.45 * r()),
        strokeWidth: 1.4
      }));
      g.add(PG.circle(bx - rad * 0.3, by - rad * 0.3, rad * 0.28, PG.rgba(PG.C.ice, 0.35)));
    }
    return g;
  };

  /** концентрические кольца (сонар / ударная волна) */
  PG.rings = function (x, y, n, step, color, alpha) {
    const g = PG.group();
    for (let i = 1; i <= n; i++) {
      g.add(PG.circle(x, y, i * step, undefined, {
        stroke: PG.rgba(color, (alpha || 0.3) * (1 - i / (n + 1))),
        strokeWidth: 2.4
      }));
    }
    return g;
  };

  /** радиальный «взрыв» из линий */
  PG.burst = function (x, y, r, n, color, alpha) {
    const g = PG.group();
    const rr = PG.rng(Math.round(x + y));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + rr() * 0.12;
      const r0 = r * (0.25 + rr() * 0.3);
      const r1 = r * (0.75 + rr() * 0.4);
      g.add(PG.line([x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1],
        PG.rgba(color, (alpha || 0.5) * (0.4 + rr() * 0.6)), 2 + rr() * 5));
    }
    return g;
  };

  /** штриховка (тени, «гравюрный» тон) */
  PG.hatch = function (x, y, w, h, o) {
    o = o || {};
    const g = PG.group();
    const r = PG.rng(o.seed || 9);
    const step = o.step || 14;
    const count = Math.floor((w + h) / step);
    for (let i = 0; i < count; i++) {
      const len = 20 + r() * 90;
      const sx = x + r() * w;
      const sy = y + r() * h;
      g.add(PG.line([sx, sy, sx + len * 0.6, sy + len], PG.rgba(o.color || '#000', (o.alpha || 0.3) * (0.4 + r() * 0.6)), o.width || 1.2));
    }
    return g;
  };

  /** распорки/фермы */
  PG.truss = function (x, y, w, h, color, step) {
    const g = PG.group();
    const s = step || 80;
    const c = color || PG.C.steel;
    g.add(PG.rect(x, y, w, h, PG.rgba(c, 0.18)));
    g.add(PG.rect(x, y, 6, h, c));
    g.add(PG.rect(x + w - 6, y, 6, h, c));
    for (let i = 0; i < w; i += s) {
      g.add(PG.line([x + i, y, x + i + s, y + h], PG.rgba(c, 0.5), 3));
      g.add(PG.line([x + i, y + h, x + i + s, y], PG.rgba(c, 0.35), 2));
    }
    return g;
  };

  /** крупный «сценический» световой конус */
  PG.cone = function (x, y, w, h, color, alpha) {
    return PG.group().add(
      PG.poly([x - w / 2, y, x + w / 2, y, x + w * 1.5, y + h, x - w * 1.5, y + h], undefined, {
        fillLinearGradientStartPoint: { x: 0, y: y },
        fillLinearGradientEndPoint: { x: 0, y: y + h },
        fillLinearGradientColorStops: [0, PG.rgba(color, alpha), 1, PG.rgba(color, 0)]
      })
    );
  };

  /** плашка со срезанными углами (основа для текстовых блоков) */
  PG.cutPlate = function (x, y, w, h, o) {
    o = o || {};
    const c = o.cut == null ? 16 : o.cut;
    const pts = [
      x + c, y, x + w, y, x + w, y + h - c,
      x + w - c, y + h, x, y + h, x, y + c
    ];
    return PG.poly(pts, o.fill == null ? 'rgba(3,8,12,0.82)' : o.fill, {
      stroke: o.stroke, strokeWidth: o.strokeWidth || 2,
      opacity: o.opacity == null ? 1 : o.opacity,
      shadowColor: '#000', shadowBlur: 18, shadowOpacity: 0.5
    });
  };

  /** треугольный хвост реплики */
  PG.tail = function (bx, by, tx, ty, side) {
    const dir = tx < bx ? -1 : 1;
    return PG.poly([bx, by - 12, bx + 34 * dir, by - 6, tx, ty], 'rgba(3,8,12,0.9)');
  };

  /** светящаяся точка-маркер */
  PG.pip = function (x, y, r, color) {
    const g = PG.group();
    g.add(PG.glow(x, y, r * 4, color, 0.55));
    g.add(PG.circle(x, y, r, color));
    g.add(PG.circle(x, y, r * 0.4, PG.C.white));
    return g;
  };

  /** уголки-кроп-метки (интерфейс станции / HUD) */
  PG.corners = function (x, y, w, h, size, color, alpha) {
    const g = PG.group();
    const s = size || 18;
    const col = PG.rgba(color || PG.C.teal, alpha == null ? 0.5 : alpha);
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(function (c) {
      g.add(PG.line([c[0], c[1] + c[3] * s, c[0], c[1], c[0] + c[2] * s, c[1]], col, 3));
    });
    return g;
  };

  /** «сигнал» — осциллограмма */
  PG.waveform = function (x, y, w, h, color, seed, n) {
    const g = PG.group();
    const r = PG.rng(seed || 4);
    const pts = [];
    const seg = w / (n || 40);
    for (let i = 0; i <= (n || 40); i++) {
      const xx = x + i * seg;
      const yy = y + h / 2 + Math.sin(i * 0.7) * h * 0.22 + (r() - 0.5) * h * 0.5;
      pts.push(xx, yy);
    }
    g.add(PG.line(pts, color || PG.C.teal, 2, { opacity: 0.85 }));
    return g;
  };

  /** «дым»/муть — несколько мягких эллипсов */
  PG.murk = function (x, y, w, h, color, n, seed, alpha) {
    const g = PG.group();
    const r = PG.rng(seed || 31);
    for (let i = 0; i < (n || 6); i++) {
      g.add(PG.ellipse(x + r() * w, y + r() * h, w * (0.2 + r() * 0.4), h * (0.1 + r() * 0.3),
        PG.rgba(color || PG.C.teal, (alpha || 0.1) * (0.5 + r()))));
    }
    return g;
  };

  /** штамп-надпись на металле (трафарет) */
  PG.stencil = function (str, x, y, size, color, alpha, opts) {
    return PG.text(str, x, y, size, PG.rgba(color || PG.C.fog, alpha == null ? 0.5 : alpha), Object.assign({
      fontFamily: 'Arial Narrow, Arial, sans-serif',
      fontStyle: 'bold',
      letterSpacing: 6
    }, opts || {}));
  };

  /** отсек: стена + пол + потолок в перспективе */
  PG.room = function (o) {
    o = o || {};
    const g = PG.group();
    const vx = o.vx == null ? PG.W / 2 : o.vx;
    const vy = o.vy == null ? PG.H * 0.56 : o.vy;
    const backW = o.backW || 560;
    const backH = o.backH || 620;
    const bx = vx - backW / 2;
    const by = vy - backH / 2;
    // задняя стена
    g.add(PG.rect(bx, by, backW, backH, o.backFill || PG.C.deep));
    if (o.backGrad) g.add(PG.rect(bx, by, backW, backH, undefined, PG.vgrad(o.backGrad, backH)));
    // потолок
    g.add(PG.poly([0, 0, PG.W, 0, bx + backW, by, bx, by], o.ceil || PG.C.abyss));
    // пол
    g.add(PG.poly([0, PG.H, PG.W, PG.H, bx + backW, by + backH, bx, by + backH], o.floor || PG.C.ink));
    // боковые стены
    g.add(PG.poly([0, 0, bx, by, bx, by + backH, 0, PG.H], o.left || PG.C.deep));
    g.add(PG.poly([PG.W, 0, bx + backW, by, bx + backW, by + backH, PG.W, PG.H], o.right || PG.C.deep2));
    return g;
  };

  /** рамка двери/иллюминатора */
  PG.doorway = function (x, y, w, h, o) {
    o = o || {};
    const g = PG.group();
    g.add(PG.rect(x - 14, y - 14, w + 28, h + 28, PG.C.steel));
    g.add(PG.rect(x - 8, y - 8, w + 16, h + 16, PG.C.ink));
    g.add(PG.rect(x, y, w, h, o.fill || PG.C.abyss));
    if (o.glow) g.add(PG.rect(x, y, w, h, undefined, PG.radial(Math.max(w, h) * 0.8, [
      0, PG.rgba(o.glow, 0.4), 1, PG.rgba(o.glow, 0)
    ], x + w / 2 - x, y + h / 2 - y)));
    return g;
  };

  /** «стекло» иллюминатора: блики */
  PG.glass = function (x, y, w, h) {
    const g = PG.group();
    g.add(PG.poly([x, y, x + w * 0.55, y, x + w * 0.18, y + h, x, y + h], 'rgba(157,246,255,0.05)'));
    g.add(PG.poly([x + w * 0.62, y, x + w * 0.74, y, x + w * 0.37, y + h, x + w * 0.25, y + h], 'rgba(157,246,255,0.035)'));
    return g;
  };

})(window);
