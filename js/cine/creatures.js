/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  то, что живёт ниже станции
   Гигантские формы: только пути (Path / Line / Circle), свет — градиенты.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }
  function r(v) { return Math.round(v * 100) / 100; }

  /** лента переменной ширины по точкам — общий инструмент для щупалец */
  function ribbon(pts, w0, w1, taperPow) {
    const N = pts.length - 1;
    const flat = [], leftPts = [], rightPts = [];
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const t = Math.pow(i / N, taperPow || 1.35);
      const w = (w0 + (w1 - w0) * t) * 0.5;
      leftPts.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
      rightPts.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    }
    leftPts.forEach(function (q) { flat.push(r(q.x), r(q.y)); });
    for (let i = rightPts.length - 1; i >= 0; i--) flat.push(r(rightPts[i].x), r(rightPts[i].y));
    return { points: flat, left: leftPts, right: rightPts };
  }

  /** кривая из угла: стартовый угол, загиб, длина, шагов */
  function curl(x, y, startAng, bend, len, steps) {
    const N = steps || 14, ds = len / N;
    const pts = [{ x: x, y: y }];
    let px = x, py = y;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const a = startAng + bend * Math.pow(t, 1.5);
      px += Math.cos(a) * ds;
      py += Math.sin(a) * ds;
      pts.push({ x: px, y: py });
    }
    return pts;
  }

  /**
   * Cine.leviathan({ x, y, scale, flip, opacity, rotation, tint, glow, eyeGlow, arms })
   * Тело, спинные пластины, щупальца и один большой глаз.
   * Рисуется вокруг (0,0): тело сверху, щупальца уходят вниз.
   */
  Cine.leviathan = function (o) {
    o = o || {};
    const g = new (K().Group)({
      x: o.x || 0, y: o.y || 0,
      scaleX: (o.flip ? -1 : 1) * (o.scale == null ? 1 : o.scale),
      scaleY: (o.scale == null ? 1 : o.scale),
      rotation: o.rotation || 0,
      opacity: o.opacity == null ? 1 : o.opacity
    });
    const tint = o.tint || '#0b151a';
    const glow = o.glow || '#7affe0';
    const eyeGlow = o.eyeGlow == null ? 0.9 : o.eyeGlow;
    const arms = o.arms == null ? 6 : o.arms;

    /* ---- щупальца: уходят вниз и в стороны ---- */
    for (let i = 0; i < arms; i++) {
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2);
      const bx = side * (40 + row * 34);
      const by = 60 - row * 26;
      const pts = curl(bx, by, Math.PI / 2 + side * (0.20 + row * 0.16), side * (1.15 + row * 0.12), 470 - row * 46, 16);
      const rb = ribbon(pts, 74 - row * 10, 7, 1.5);
      g.add(new (K().Line)({
        points: rb.points, closed: true, tension: 0.4,
        fill: tint, stroke: '#02080b', strokeWidth: 3
      }));
      // светящаяся кромка вдоль внутренней стороны
      g.add(new (K().Line)({
        points: rb.left.map(function (q) { return [r(q.x), r(q.y)]; }).reduce(function (a, b) { return a.concat(b); }, []),
        tension: 0.4, stroke: glow, strokeWidth: 2.2, opacity: 0.35,
        shadowColor: glow, shadowBlur: 16
      }));
      // присоски
      for (let k = 2; k < 13; k += 2) {
        const q = pts[k];
        g.add(new (K().Circle)({
          x: r(q.x), y: r(q.y), radius: Math.max(2, 9 - k * 0.5),
          stroke: glow, strokeWidth: 1.4, opacity: 0.3
        }));
      }
    }

    /* ---- тело ---- */
    const bodyPts = [];
    const N = 20;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i / N * Math.PI * 2;
      const rx = 210, ry = 250;
      const wob = 1 + Math.sin(a * 3.1) * 0.055 + Math.cos(a * 5.3) * 0.035;
      bodyPts.push({ x: Math.cos(a) * rx * wob, y: Math.sin(a) * ry * wob + 40 });
    }
    let d = '';
    bodyPts.forEach(function (q, i) { d += (i ? ' L' : 'M') + r(q.x) + ' ' + r(q.y); });
    d += ' Z';
    g.add(new (K().Path)({
      data: d, fillLinearGradientStartPoint: { x: 0, y: -220 },
      fillLinearGradientEndPoint: { x: 0, y: 300 },
      fillLinearGradientColorStops: [
        0, '#0e1c22', 0.55, tint, 1, '#040a0d'
      ],
      stroke: '#02080b', strokeWidth: 4
    }));
    // контровой свет по верхнему краю
    g.add(new (K().Path)({
      data: 'M-170 60 C-150 -120 -60 -196 0 -200 C60 -196 150 -120 170 60',
      stroke: glow, strokeWidth: 2.4, opacity: 0.22, shadowColor: glow, shadowBlur: 26
    }));

    /* ---- спинные пластины ---- */
    for (let i = -3; i <= 3; i++) {
      const x = i * 44;
      const h = 46 - Math.abs(i) * 8;
      g.add(new (K().Path)({
        data: 'M' + r(x - 17) + ' ' + r(-196 - Math.abs(i) * 6) +
          ' C' + r(x - 10) + ' ' + r(-196 - h) + ' ' + r(x + 10) + ' ' + r(-196 - h) + ' ' + r(x + 17) + ' ' + r(-196 - Math.abs(i) * 6) + ' Z',
        fill: tint, stroke: '#02080b', strokeWidth: 2.4
      }));
    }

    /* ---- глаз ---- */
    const ex = 26, ey = 20;
    g.add(new (K().Circle)({
      x: ex, y: ey, radius: 78,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 78,
      fillRadialGradientColorStops: [0, 'rgba(190,255,235,' + (0.16 * eyeGlow).toFixed(2) + ')', 1, 'rgba(190,255,235,0)']
    }));
    g.add(new (K().Circle)({ x: ex, y: ey, radius: 60, fill: '#dfe7de', stroke: '#02080b', strokeWidth: 3 }));
    g.add(new (K().Circle)({
      x: ex, y: ey, radius: 58,
      fillRadialGradientStartPoint: { x: ex - 14, y: ey - 18 },
      fillRadialGradientEndPoint: { x: ex + 10, y: ey + 14 },
      fillRadialGradientRadius: 70,
      fillRadialGradientColorStops: [0, '#f3f7ef', 0.6, '#c3ccc2', 1, '#8e9a91']
    }));
    // радужка
    g.add(new (K().Circle)({
      x: ex + 4, y: ey, radius: 34,
      fillRadialGradientStartPoint: { x: 0, y: 0 },
      fillRadialGradientEndPoint: { x: 0, y: 0 },
      fillRadialGradientRadius: 34,
      fillRadialGradientColorStops: [0, '#f0ffd8', 0.45, '#a8e07a', 1, '#2d5533']
    }));
    // зрачок-щель
    g.add(new (K().Path)({
      data: 'M' + r(ex + 4) + ' ' + r(ey - 30) +
        ' C' + r(ex + 15) + ' ' + r(ey - 12) + ' ' + r(ex + 15) + ' ' + r(ey + 12) + ' ' + r(ex + 4) + ' ' + r(ey + 30) +
        ' C' + r(ex - 8) + ' ' + r(ey + 12) + ' ' + r(ex - 8) + ' ' + r(ey - 12) + ' ' + r(ex + 4) + ' ' + r(ey - 30) + ' Z',
      fill: '#050b08'
    }));
    // блик
    g.add(new (K().Ellipse)({
      x: ex - 12, y: ey - 20, radiusX: 13, radiusY: 9, rotation: -26,
      fill: '#ffffff', opacity: 0.75
    }));
    // веко-кожа вокруг
    g.add(new (K().Path)({
      data: 'M' + r(ex - 66) + ' ' + r(ey) +
        ' C' + r(ex - 30) + ' ' + r(ey - 78) + ' ' + r(ex + 62) + ' ' + r(ey - 74) + ' ' + r(ex + 70) + ' ' + r(ey + 2),
      stroke: '#02080b', strokeWidth: 7, opacity: 0.7
    }));

    /* ---- биолюминесцентные точки ---- */
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2;
      const rr = 150 + (i % 5) * 22;
      g.add(new (K().Circle)({
        x: r(Math.cos(a) * rr * 0.9), y: r(40 + Math.sin(a) * rr * 0.8),
        radius: 1.6 + (i % 3) * 1.3,
        fill: glow, opacity: 0.35, shadowColor: glow, shadowBlur: 10
      }));
    }
    return g;
  };

  /**
   * Cine.deepArm({ from:{x,y}, to:{x,y}, width, glow, opacity })
   * Одно щупальце, проходящее через кадр под водой.
   */
  Cine.deepArm = function (o) {
    o = o || {};
    const g = new (K().Group)({ opacity: o.opacity == null ? 1 : o.opacity });
    const a = o.from, b = o.to;
    const glow = o.glow || '#8affd6';
    const steps = 18;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI * 1.2) * (o.bow == null ? 70 : o.bow);
      pts.push({ x: x, y: y });
    }
    const rb = ribbon(pts, o.width || 90, (o.width || 90) * 0.16, 1.2);
    g.add(new (K().Line)({
      points: rb.points, closed: true, tension: 0.4,
      fill: o.tint || '#0d1a1e', stroke: '#02080b', strokeWidth: 3
    }));
    g.add(new (K().Line)({
      points: rb.left.map(function (q) { return [r(q.x), r(q.y)]; }).reduce(function (p, q) { return p.concat(q); }, []),
      tension: 0.4, stroke: glow, strokeWidth: 2, opacity: 0.3, shadowColor: glow, shadowBlur: 18
    }));
    for (let k = 2; k < steps; k += 3) {
      const q = pts[k];
      g.add(new (K().Circle)({
        x: r(q.x), y: r(q.y), radius: Math.max(2, (o.width || 90) * 0.1 - k * 0.3),
        stroke: glow, strokeWidth: 1.3, opacity: 0.25
      }));
    }
    return g;
  };

  /**
   * Cine.eyeAtGlass({ x, y, r, glow, scale, tilt, dim })
   * То, что видно в иллюминатор: масса плоти вплотную к стеклу и один огромный глаз.
   * Всё обрезается кругом — за пределы стекла ничего не выходит.
   */
  Cine.eyeAtGlass = function (o) {
    o = o || {};
    const cx = o.x == null ? 600 : o.x;
    const cy = o.y == null ? 820 : o.y;
    const R = o.r == null ? 400 : o.r;
    const sc = o.scale == null ? 1 : o.scale;
    const glow = o.glow || '#8affd6';
    const dim = o.dim || 0;
    const g = new (K().Group)();

    // глубина за стеклом
    g.add(new (K().Circle)({
      x: cx, y: cy, radius: R, fill: '#02090c'
    }));

    // складки плоти: несколько крупных долей, прижатых к стеклу
    const lobes = [
      { dx: -0.26, dy: 0.20, rx: 0.74, ry: 0.58, rot: -14, tone: '#0d1f22' },
      { dx: 0.26, dy: 0.12, rx: 0.68, ry: 0.64, rot: 12, tone: '#0b1b1e' },
      { dx: -0.02, dy: -0.28, rx: 0.80, ry: 0.48, rot: 3, tone: '#0e2326' },
      { dx: 0.04, dy: 0.36, rx: 0.76, ry: 0.44, rot: -6, tone: '#0a191c' }
    ];
    lobes.forEach(function (L) {
      g.add(new (K().Ellipse)({
        x: cx + L.dx * R * sc, y: cy + L.dy * R * sc,
        radiusX: L.rx * R * 0.62 * sc, radiusY: L.ry * R * 0.62 * sc,
        rotation: L.rot, fill: L.tone, stroke: '#061215', strokeWidth: 3
      }));
    });

    // прожилки-морщины по долям
    for (let i = 0; i < 16; i++) {
      const a0 = i / 16 * Math.PI * 2;
      const r0 = R * 0.44, r1 = R * (0.80 + (i % 3) * 0.03);
      const x0 = cx + Math.cos(a0) * r0 * sc, y0 = cy + Math.sin(a0) * r0 * sc * 0.9;
      const x1 = cx + Math.cos(a0 + 0.16) * r1 * sc, y1 = cy + Math.sin(a0 + 0.1) * r1 * sc * 0.9;
      const mx = (x0 + x1) / 2 + Math.cos(a0 + 1.4) * 40 * sc;
      const my = (y0 + y1) / 2 + Math.sin(a0 + 1.4) * 40 * sc;
      g.add(new (K().Path)({
        data: 'M' + r(x0) + ' ' + r(y0) + ' Q' + r(mx) + ' ' + r(my) + ' ' + r(x1) + ' ' + r(y1),
        stroke: 'rgba(90,150,140,0.18)', strokeWidth: 3 + (i % 3), lineCap: 'round'
      }));
    }

    // биолюминесцентные точки
    for (let i = 0; i < 34; i++) {
      const a = (i * 0.61) % (Math.PI * 2);
      const rr = R * (0.36 + ((i * 37) % 45) / 100);
      g.add(new (K().Circle)({
        x: r(cx + Math.cos(a) * rr * sc), y: r(cy + Math.sin(a * 1.3) * rr * 0.88 * sc),
        radius: 1.6 + (i % 4) * 1.1,
        fill: glow, opacity: 0.22 + (i % 3) * 0.12,
        shadowColor: glow, shadowBlur: 9
      }));
    }

    /* ---- глаз ---- */
    const ex = cx + (o.eyeX || 0) * R * sc;
    const ey = cy + (o.eyeY == null ? 0.02 : o.eyeY) * R * sc;
    const ER = R * (o.eyeR == null ? 0.34 : o.eyeR) * sc;
    const tilt = o.tilt || 0;

    // глазница — тёмная впадина
    g.add(new (K().Ellipse)({
      x: ex, y: ey, radiusX: ER * 1.55, radiusY: ER * 1.5, rotation: tilt,
      fill: '#050f11', stroke: '#08191c', strokeWidth: 4
    }));
    // склера
    g.add(new (K().Ellipse)({
      x: ex, y: ey, radiusX: ER * 1.16, radiusY: ER, rotation: tilt,
      fill: '#cfd8ca', stroke: '#0a1a1c', strokeWidth: 4
    }));
    // радужка
    g.add(new (K().Circle)({
      x: ex + ER * 0.06, y: ey, radius: ER * 0.68,
      fill: '#7fbf72', stroke: '#2d4a30', strokeWidth: 3
    }));
    // зрачок-щель, повёрнутая по наклону
    const ph = ER * 0.62;
    const sh = ER * 0.17;
    const px = ex + ER * 0.06, py = ey;
    const ca = Math.cos(tilt * Math.PI / 180), sa = Math.sin(tilt * Math.PI / 180);
    const P = function (dx, dy) {
      return { x: px + dx * ca - dy * sa, y: py + dx * sa + dy * ca };
    };
    const a1 = P(-sh, -ph), a2 = P(sh, -ph), b1 = P(sh, ph), b2 = P(-sh, ph);
    g.add(new (K().Path)({
      data: 'M' + r(a1.x) + ' ' + r(a1.y) +
        ' C' + r(a2.x) + ' ' + r(a2.y - ph * 0.4) + ' ' + r(b1.x) + ' ' + r(b1.y + ph * 0.4) + ' ' + r(b1.x) + ' ' + r(b1.y) +
        ' C' + r(b2.x) + ' ' + r(b2.y + ph * 0.4) + ' ' + r(a1.x) + ' ' + r(a1.y - ph * 0.4) + ' ' + r(a1.x) + ' ' + r(a1.y) + ' Z',
      fill: '#050b08'
    }));
    // блик на склере
    g.add(new (K().Ellipse)({
      x: ex - ER * 0.42, y: ey - ER * 0.42, radiusX: ER * 0.26, radiusY: ER * 0.18,
      rotation: -28, fill: '#ffffff', opacity: 0.72
    }));
    // ресничная кромка: короткие тёмные штрихи по кругу
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2;
      const x0 = ex + Math.cos(a) * ER * 1.14, y0 = ey + Math.sin(a) * ER * 0.99;
      const x1 = ex + Math.cos(a) * ER * 1.34, y1 = ey + Math.sin(a) * ER * 1.16;
      g.add(new (K().Line)({
        points: [r(x0), r(y0), r(x1), r(y1)],
        stroke: '#08161a', strokeWidth: 3.4, lineCap: 'round', opacity: 0.85
      }));
    }
    // тёмное веко сверху — придаёт взгляд
    g.add(new (K().Path)({
      data: 'M' + r(ex - ER * 1.3) + ' ' + r(ey - ER * 0.16) +
        ' C' + r(ex - ER * 0.5) + ' ' + r(ey - ER * 1.42) + ' ' + r(ex + ER * 0.8) + ' ' + r(ey - ER * 1.34) + ' ' + r(ex + ER * 1.28) + ' ' + r(ey - ER * 0.02) +
        ' C' + r(ex + ER * 0.7) + ' ' + r(ey - ER * 0.95) + ' ' + r(ex - ER * 0.5) + ' ' + r(ey - ER * 1.0) + ' ' + r(ex - ER * 1.3) + ' ' + r(ey - ER * 0.16) + ' Z',
      fill: '#08171a'
    }));

    // глубина/муть для дальнего плана
    if (dim > 0) {
      g.add(new (K().Circle)({
        x: cx, y: cy, radius: R, fill: '#04161a', opacity: dim
      }));
    }
    return g;
  };

  /**
   * Cine.portholeRim({x, y, r})
   * Только обод иллюминатора и блик стекла — рисуется ПОВЕРХ того, что снаружи.
   */
  Cine.portholeRim = function (o) {
    o = o || {};
    const x = o.x == null ? 600 : o.x;
    const y = o.y == null ? 820 : o.y;
    const R = o.r == null ? 400 : o.r;
    const g = new (K().Group)();
    // затемнение по краю стекла — несколько тихих колец вместо градиента
    for (let i = 0; i < 6; i++) {
      g.add(new (K().Circle)({
        x: x, y: y, radius: R - 10 - i * 16,
        fillEnabled: false, stroke: '#020a0c',
        strokeWidth: 16, opacity: 0.12 + i * 0.03
      }));
    }
    // обод
    g.add(new (K().Circle)({ x: x, y: y, radius: R, fillEnabled: false, stroke: '#33565f', strokeWidth: 26 }));
    g.add(new (K().Circle)({ x: x, y: y, radius: R - 16, fillEnabled: false, stroke: '#0a1a20', strokeWidth: 10, opacity: 0.85 }));
    g.add(new (K().Circle)({ x: x, y: y, radius: R - 22, fillEnabled: false, stroke: 'rgba(180,255,245,0.18)', strokeWidth: 4 }));
    // зажимы
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.add(new (K().Circle)({
        x: x + Math.cos(a) * (R + 22), y: y + Math.sin(a) * (R + 22), radius: 13,
        fill: '#16333b', stroke: '#2b525b', strokeWidth: 3
      }));
    }
    // блик стекла
    g.add(new (K().Path)({
      data: 'M' + (x - 300) + ' ' + (y - 180) + ' C' + (x - 180) + ' ' + (y - 330) + ' ' + (x + 40) + ' ' + (y - 370) + ' ' + (x + 200) + ' ' + (y - 300),
      stroke: 'rgba(210,255,250,0.12)', strokeWidth: 30, lineCap: 'round'
    }));
    return g;
  };

  /** стайка мелких светящихся точек — планктон */
  Cine.plankton = function (o) {
    o = o || {};
    const g = new (K().Group)({ opacity: o.opacity == null ? 0.8 : o.opacity });
    const n = o.count || 60;
    const w = o.w || 1200, h = o.h || 1200;
    for (let i = 0; i < n; i++) {
      g.add(new (K().Circle)({
        x: ((i * 137) % w) + (o.x || 0),
        y: ((i * 211) % h) + (o.y || 0),
        radius: 1 + (i % 3) * 0.9,
        fill: o.color || '#9df6ff',
        opacity: 0.2 + (i % 5) * 0.1,
        shadowColor: o.color || '#9df6ff', shadowBlur: 8
      }));
    }
    return g;
  };
})(window);
