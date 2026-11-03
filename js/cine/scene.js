/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  сборщик сцен
   Одна страница = палитра + декорация + фигуры + слои эффектов + реплики.
   Любая страница собирается одинаково, поэтому читалка умеет листать их.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const W = 1200, H = 1800;

  /**
   * Cine.scene(cfg)
   * cfg = {
   *   tone, accent,               // палитра
   *   room: {...} | null,         // стандартный коридор Cine.room
   *   set: fn(root, palette, api),// своя декорация (возвращает объект с нодами)
   *   figures: { key: {...} },    // см. Cine.buildFigure
   *   order: ['far', ..., 'near'],// порядок отрисовки, по умолчанию — как объявлено
   *   shooter: 'hunter',          // у кого muzzle()
   *   hits: [{x,y,n,power}],      // куда уходят пули
   *   bubbles: [...],             // реплики для HTML-слоя
   *   shadows: true
   * }
   */
  Cine.scene = function (cfg) {
    const c = cfg || {};
    const p = Cine.palette(c.tone || 'depth', c.accent);
    const root = new (K().Group)();
    root.name('cine-page');

    // внутренняя группа кадра: сдвиг композиции без потери системы координат
    const frame = new (K().Group)();
    const kick = c.kick == null ? 0 : c.kick;
    frame.y(kick);
    root.add(frame);

    const api = {
      root: root,
      palette: p,
      data: {
        vol: c.vol, page: c.page, title: c.title,
        place: c.place, bubbles: c.bubbles || []
      },
      figures: {},
      nodes: {},
      fxBack: null,
      fxFront: null,
      muzzle: function () { return api._muzzle ? api._muzzle() : { x: W / 2, y: H / 2 }; },
      hit: (c.hits && c.hits[0]) || { x: W / 2, y: H / 2, n: 10, power: 18 }
    };

    /* ---- декорация ---- */
    if (c.room) {
      frame.add(Cine.room(Object.assign({ palette: p, seed: (c.page || 1) * 17 }, c.room)));
    }
    if (typeof c.set === 'function') {
      const out = c.set(frame, p, api) || {};
      Object.keys(out).forEach(function (k) { api.nodes[k] = out[k]; });
    }

    /* ---- слой эффектов ЗА фигурами ---- */
    const fxBack = new (K().Group)();
    frame.add(fxBack);
    api.fxBack = fxBack;
    api.effects = Cine.effects(fxBack);

    /* ---- фигуры ---- */
    const order = c.order || Object.keys(c.figures || {});
    const built = [];

    order.forEach(function (key) {
      const f = (c.figures || {})[key];
      if (!f) return;
      const fig = Cine.buildFigure({
        variant: f.variant || key,
        x: f.x, y: f.y, scale: f.scale == null ? 1 : f.scale,
        flip: !!f.flip,
        pose: f.pose || 'stand',
        emotion: f.emotion || 'neutral',
        rifle: !!f.rifle,
        aimAngle: f.aimAngle,
        palette: f.palette || { cloth: '#1b2b32', cloth2: '#121b20', accent: p.accent }
      });
      if (f.rotation) fig.group.rotation(f.rotation);
      api.figures[key] = fig;
      built.push({ key: key, fig: fig, shadow: f.shadow !== false });
    });

    // тени под фигурами: рваные, по simplex-noise
    built.forEach(function (b, i) {
      if (!b.shadow) return;
      const bb = b.fig.group.getClientRect();
      if (!bb.width) return;
      const cx = bb.x + bb.width / 2;
      const by = bb.y + bb.height;
      const w = bb.width * 1.1;
      frame.add(Cine.tornShadow(cx - w / 2, by - 30, w, 44, 30 + i * 11, '#000000', c.shadowAlpha == null ? 0.45 : c.shadowAlpha));
    });
    built.forEach(function (b) { frame.add(b.fig.group); });

    /* ---- слой эффектов ПЕРЕД фигурами ---- */
    const fxFront = new (K().Group)();
    frame.add(fxFront);
    api.fxFront = fxFront;
    api.frame = frame;

    // передний план: то, что перекрывает фигуры (стол, край переборки)
    if (typeof c.foreground === 'function') {
      const fg = new (K().Group)();
      frame.add(fg);
      api.fg = fg;
      const outFg = c.foreground(fg, p, api) || {};
      Object.keys(outFg).forEach(function (k) { api.nodes[k] = outFg[k]; });
    }

    api.shooter = function () { return c.shooter ? api.figures[c.shooter] : null; };
    if (c.shooter && api.figures[c.shooter]) api._muzzle = api.figures[c.shooter].muzzle;

    /* ---- фабрика эффектов «на лету» ---- */
    api.tracer = function (a, b, opts) {
      const g = api.effects.tracer(a, b, p, opts || {});
      fxBack.add(g);
      return g;
    };
    api.impact = function (x, y, r) {
      const g = api.effects.impact(x, y, p, r);
      fxBack.add(g);
      return g;
    };
    api.smoke = function (x, y, opts) {
      const g = api.effects.smoke(x, y, p, opts);
      fxBack.add(g);
      return g;
    };
    api.flash = function (x, y, r, angle) {
      const g = api.effects.impact(x, y, p, r || 18);
      g.opacity(0.92);
      fxFront.add(g);
      if (angle != null) makeFlame(fxFront, x, y, angle, p);
      return g;
    };

    return api;
  };

  /** язык пламени из среза ствола — 5 дуг Безье */
  function makeFlame(layer, x, y, angle, p) {
    const g = new (K().Group)();
    for (let i = 0; i < 5; i++) {
      const a = angle + (i - 2) * 0.17;
      const len = 54 + (i % 2) * 44;
      g.add(new (K().Path)({
        data: 'M' + x + ' ' + y +
          ' C' + (x + Math.cos(a) * len * 0.5) + ' ' + (y + Math.sin(a) * len * 0.5 - 7) +
          ' ' + (x + Math.cos(a) * len * 0.8) + ' ' + (y + Math.sin(a) * len * 0.8 + 6) +
          ' ' + (x + Math.cos(a) * len) + ' ' + (y + Math.sin(a) * len),
        stroke: i % 2 ? '#fff2b0' : p.accent,
        strokeWidth: 4.4 - i * 0.5,
        opacity: 0.85 - i * 0.1,
        lineCap: 'round'
      }));
    }
    layer.add(g);
    return g;
  }
  Cine.flame = makeFlame;

  /** простая «тень-силуэт» человека на дальнем плане (Path, не Rect) */
  Cine.crowdFigure = function (x, y, s, tone, alpha) {
    const g = new (K().Group)({ x: x, y: y, scaleX: s, scaleY: s, opacity: alpha == null ? 0.8 : alpha });
    g.add(new (K().Path)({
      data: 'M0 0 C-9 -1 -13 -8 -13 -16 C-13 -25 -7 -31 0 -31 C7 -31 13 -25 13 -16 C13 -8 9 -1 0 0 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    // шея и плечи
    g.add(new (K().Path)({
      data: 'M-6 -32 L6 -32 L7 -24 L-7 -24 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    // торс с покатыми плечами
    g.add(new (K().Path)({
      data: 'M0 -26 C-14 -28 -24 -22 -26 -10 L-22 26 C-16 34 -6 36 0 36 C6 36 16 34 22 26 L26 -10 C24 -22 14 -28 0 -26 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    // руки вдоль тела
    g.add(new (K().Path)({
      data: 'M-24 -12 C-30 -6 -32 6 -30 22 L-27 44 L-17 44 L-19 18 L-18 -6 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    g.add(new (K().Path)({
      data: 'M24 -12 C30 -6 32 6 30 22 L27 44 L17 44 L19 18 L18 -6 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    // ноги
    g.add(new (K().Path)({
      data: 'M-20 34 L-4 34 L-2 96 L-20 96 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    g.add(new (K().Path)({
      data: 'M4 34 L20 34 L20 96 L2 96 Z',
      fill: tone, stroke: tone, strokeWidth: 1
    }));
    return g;
  };
})(window);
