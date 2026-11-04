/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  ТОМ 1, СТРАНИЦА 5
   «Перестрелка в коридоре B». Пример боевой страницы.

   Слои снизу вверх:
     1) Konva: коридор (стены, пол, вода на полу, аварийные лампы)
     2) Konva: обломки на полу  3) фигуры (Konva.Path)  4) трассеры и вспышки
     5) HTML-канвас: физика Matter.js  6) tsParticles: дульная вспышка, искры
     7) HTML-слой: комиксовые пузыри
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  /* ------------------------------------------------------------------ данные */
  Cine.CH1_P5 = {
    volume: 1,
    page: 5,
    title: 'Коридор B',
    palette: { tone: 'alarm', accent: '#ff7a2f' },
    // стартовое состояние сцены
    stage: {
      hunter: { x: 300, y: 1610, scale: 1.42, pose: 'aim', emotion: 'focus' },
      guardA: { x: 930, y: 1745, scale: 1.2, pose: 'crouch', emotion: 'fear' },
      guardB: { x: 1110, y: 1690, scale: 1.08, pose: 'crouch', emotion: 'angry' },
      nullar: { x: 210, y: 1205, scale: 0.88, pose: 'stand', emotion: 'smirk' }
    },
    // попадания: во что и куда
    hits: [
      { x: 1168, y: 1128, n: 14, power: 26, damage: true },
      { x: 1120, y: 880, n: 9, power: 20 }
    ],
    bubbles: [
      { who: 'ХАНТЕР', kind: 'speech', slot: 'TL1', text: 'С дороги. Я не спрашиваю дважды.' },
      { who: 'ОХРАНА', kind: 'speech', slot: 'BL1', text: 'Он один! Взять его живым!' },
      { who: 'НУЛЛАР', kind: 'speech', slot: 'TR1', text: 'Живым? Нет. Пусть стреляет.', accent: true },
      { who: null, kind: 'narration', slot: 'BL3', text: 'Третья пуля ушла в стену — и стена ответила бетоном.' }
    ]
  };

  /* ------------------------------------------------------------------ сцена */
  Cine.buildChapter1Page5 = function (opts) {
    const o = opts || {};
    const p = Cine.palette(Cine.CH1_P5.palette.tone, Cine.CH1_P5.palette.accent);
    const root = new (K().Group)();
    root.name('cine-page');

    /* 1. коридор */
    root.add(Cine.room({
      palette: p,
      horizon: 1160,
      seed: 55,
      vp: { x: 640, y: 980 },
      pipes: [
        { x: 120, y0: -100, c1: 300, c2: 700, y1: 1120, w: 30 },
        { x: 1080, y0: -100, c1: 380, c2: 760, y1: 1120, w: 22 }
      ],
      lamps: [
        { x: 300, y: 210, r: 220 },
        { x: 940, y: 180, r: 260 },
        { x: 620, y: 60, r: 180 }
      ]
    }));

    /* 1b. слой эффектов ЗА фигурами: трассеры уходят в стену позади охраны */
    const fx = Cine.effects(root);

    /* 2. фигуры */
    const cfg = Cine.CH1_P5.stage;
    const hunter = Cine.buildFigure({
      variant: 'hunter', x: cfg.hunter.x, y: cfg.hunter.y, scale: cfg.hunter.scale,
      pose: cfg.hunter.pose, emotion: cfg.hunter.emotion, rifle: true, aimAngle: -0.13,
      palette: { cloth: '#1b2b32', cloth2: '#121b20', accent: p.accent }
    });
    const guardA = Cine.buildFigure({
      variant: 'guard', x: cfg.guardA.x, y: cfg.guardA.y, scale: cfg.guardA.scale,
      pose: cfg.guardA.pose, emotion: cfg.guardA.emotion, rifle: true, flip: true,
      palette: { cloth: '#2a3a44', cloth2: '#18242b', accent: '#ff9a8f' }
    });
    const guardB = Cine.buildFigure({
      variant: 'guard', x: cfg.guardB.x, y: cfg.guardB.y, scale: cfg.guardB.scale,
      pose: cfg.guardB.pose, emotion: cfg.guardB.emotion, rifle: true, flip: true,
      palette: { cloth: '#22313a', cloth2: '#141f25', accent: '#ff9a8f' }
    });
    const nullar = Cine.buildFigure({
      variant: 'nullar', x: cfg.nullar.x, y: cfg.nullar.y, scale: cfg.nullar.scale,
      pose: cfg.nullar.pose, emotion: cfg.nullar.emotion,
      palette: { cloth: '#2a2340', cloth2: '#171228', accent: p.accent }
    });

    // порядок по глубине: дальний план → герой
    const props = new (K().Group)();
    // ящик слева — за героем
    props.add(new (K().Path)({
      data: Cine.rig.smooth([
        { x: 120, y: 1400 }, { x: 300, y: 1392 }, { x: 312, y: 1300 }, { x: 128, y: 1306 }
      ], true, 0.12),
      fill: '#16242a', stroke: p.ink, strokeWidth: 3
    }));
    props.add(new (K().Path)({
      data: 'M132 1306 L306 1300', stroke: p.light, strokeWidth: 3, opacity: 0.25
    }));

    // бетонная крошка на полу — до старта физики, чтобы кадр не был пустым
    const rubble = new (K().Group)();
    for (let i = 0; i < 26; i++) {
      const rx = 380 + ((i * 137) % 760);
      const ry = 1600 + ((i * 61) % 160);
      const rr = 5 + ((i * 29) % 13);
      const pts = [];
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2 + i;
        pts.push({ x: rx + Math.cos(a) * rr * (0.6 + ((i + k) % 5) / 8), y: ry + Math.sin(a) * rr * 0.55 });
      }
      rubble.add(new (K().Path)({
        data: Cine.rig.smooth(pts, true, 0.15),
        fill: i % 3 ? '#38484f' : '#4a5c64',
        stroke: '#7f979f', strokeWidth: 1.4, opacity: 0.9
      }));
    }
    root.add(rubble);
    // тени под фигурами — рваные, из simplex-noise
    [nullar, guardB, guardA, hunter].forEach(function (f, i) {
      const b = f.group.getClientRect();
      const cx = b.x + b.width / 2;
      const by = b.y + b.height;
      const w = b.width * 1.15;
      root.add(Cine.tornShadow(cx - w / 2, by - 26, w, 46, 30 + i * 7, '#000000', 0.5));
    });

    // штабель ящиков в среднем плане (за охранниками)
    for (let i = 0; i < 3; i++) {
      const bx = 990 + i * 8, by = 1245 - i * 62, bw = 148 - i * 10, bh = 56;
      props.add(new (K().Path)({
        data: Cine.rig.smooth([
          { x: bx, y: by + bh }, { x: bx + 10, y: by }, { x: bx + bw, y: by - 6 }, { x: bx + bw - 8, y: by + bh }
        ], true, 0.1),
        fill: i % 2 ? '#1d2c33' : '#24363e', stroke: p.ink, strokeWidth: 2.4, opacity: 0.95
      }));
      props.add(new (K().Path)({
        data: 'M' + (bx + 14) + ' ' + (by + 12) + ' L' + (bx + bw - 12) + ' ' + (by + 8),
        stroke: p.light, strokeWidth: 1.6, opacity: 0.16
      }));
    }

    root.add(props);
    root.add(nullar.group);
    root.add(guardB.group);
    root.add(guardA.group);
    root.add(hunter.group);

    /* 3. вспышки — уже ПЕРЕД фигурами */
    const fxFront = new (K().Group)();
    root.add(fxFront);

    // дульная вспышка как Konva-«звезда» (страховка, если tsParticles не поднимется)
    const muzzle = hunter.muzzle();
    const flash = fx.impact(muzzle.x, muzzle.y, p, 18);
    flash.opacity(0.9);
    fxFront.add(flash);
    // «язык» пламени из среза ствола
    const flame = new (K().Group)();
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.18;
      const len = 60 + (i % 2) * 46;
      flame.add(new (K().Path)({
        data: 'M' + muzzle.x + ' ' + muzzle.y +
          ' C' + (muzzle.x + Math.cos(a) * len * 0.5) + ' ' + (muzzle.y + Math.sin(a) * len * 0.5 - 8) +
          ' ' + (muzzle.x + Math.cos(a) * len * 0.8) + ' ' + (muzzle.y + Math.sin(a) * len * 0.8 + 6) +
          ' ' + (muzzle.x + Math.cos(a) * len) + ' ' + (muzzle.y + Math.sin(a) * len),
        stroke: i % 2 ? '#fff2b0' : p.accent, strokeWidth: 5 - i * 0.6, opacity: 0.9 - i * 0.12, lineCap: 'round'
      }));
    }
    fxFront.add(flame);

    // трассер от ствола к стене
    const hit = Cine.CH1_P5.hits[0];
    fx.group.add(fx.tracer(muzzle, { x: hit.x, y: hit.y }, p, { w: 6, seed: 12, wobble: 7 }));

    // попадание в стену
    const impact = fx.impact(hit.x, hit.y, p, 42);
    fx.group.add(impact);

    // пыль от попадания
    fx.group.add(fx.smoke(hit.x, hit.y, p, { n: 8, seed: 6 }));

    /* 4. API: то, что дёргает движок во времени */
    const api = {
      root: root,
      data: Cine.CH1_P5,
      palette: p,
      figures: { hunter: hunter, guardA: guardA, guardB: guardB, nullar: nullar },
      muzzle: muzzle,
      hit: hit,
      impact: impact,
      flash: flash,

      /** выстрел: отдача, гильза, искры, обломки, тряска */
      fire: function (engine, i) {
        const idx = (i || 0) % Cine.CH1_P5.hits.length;
        const h = Cine.CH1_P5.hits[idx];

        // отдача: поза меняется через Konva.Path (плечо уходит назад)
        hunter.pose('recoil').emotion('angry');
        setTimeout(function () { hunter.pose('aim').emotion('focus'); }, 170);

        // вспышка у среза ствола
        const m = hunter.muzzle();
        if (engine && engine.particlesHost) {
          Cine.Particles.muzzle(engine.particlesHost, m.x * engine.view.scale + engine.view.x, m.y * engine.view.scale + engine.view.y, 0, p.accent);
          Cine.Particles.sparks(engine.particlesHost, h.x * engine.view.scale + engine.view.x, h.y * engine.view.scale + engine.view.y, '#ffd166', 40);
        }

        // обломки из стены по направлению пули
        if (engine && engine.matter) {
          Cine.FX.burst(h.x, h.y, { n: h.n, dir: Math.PI * 0.62, power: h.power, size: 14, up: 8,
            color: '#41525a', edge: '#94b0ba' });
        }

        // тряска
        Cine.Shake.kick(14);
        return idx;
      },

      /** попадание в охранника: кровь, отшатывание */
      hitGuard: function (engine) {
        guardA.pose('hit').emotion('pain');
        if (engine && engine.particlesHost) {
          const gb = guardA.group.getClientRect();
          Cine.Particles.blood(engine.particlesHost, (gb.x + gb.width * 0.55) * engine.view.scale + engine.view.x, (gb.y + gb.height * 0.22) * engine.view.scale + engine.view.y, Math.PI * 0.85, 24);
        }
        Cine.Shake.kick(9);
      }
    };
    return api;
  };
})(window);
