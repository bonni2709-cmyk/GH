/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  постановка (сцена, свет, вода, тени)
   Палитра считается в chroma.js (единая точка правды для тона кадра),
   вода на полу и рваные тени — на simplex-noise.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }
  function chroma() { return global.chroma; }
  function Simplex() { return global.SimplexNoise; }

  const W = 1200, H = 1800;

  /* ------------------------------------------------------------ палитра */
  Cine.TONE = {
    depth: { bg: '#03151d', floor: '#041016', light: '#2fb9c4', warm: '#9df6ff', alarm: '#ff3d33', ink: '#010508' },
    steel: { bg: '#0a1a21', floor: '#0b171c', light: '#7fd8de', warm: '#d9fbff', alarm: '#ff5a3d', ink: '#040b0e' },
    alarm: { bg: '#24080a', floor: '#1b0608', light: '#ff4a3a', warm: '#ffa89c', alarm: '#ffd166', ink: '#0a0203' },
    violet: { bg: '#120b1f', floor: '#0a0614', light: '#9a7bff', warm: '#cbb6ff', alarm: '#ff5a8f', ink: '#05030b' },
    green: { bg: '#07170f', floor: '#04100a', light: '#9ef01a', warm: '#d7ff8a', alarm: '#ff3d33', ink: '#020803' }
  };

  /**
   * Палитра кадра: база тона, акцент, три «контрастных» уровня.
   * chroma.deltaE используется, чтобы акцент гарантированно отрывался от фона.
   */
  Cine.palette = function (toneName, accentHex) {
    const t = Cine.TONE[toneName] || Cine.TONE.depth;
    const ch = chroma();
    const bg = ch(t.bg);
    const light = ch(t.light);
    let accent = ch(accentHex || t.alarm);
    // гарантируем контраст акцента: подмешиваем белый, пока дельта не станет достаточной
    let guard = 0;
    while (ch.deltaE(accent, bg) < 42 && guard < 12) {
      accent = ch.mix(accent, '#ffffff', 0.14);
      guard++;
    }
    return {
      bg: bg.hex(),
      bgDeep: ch(bg).darken(1.4).hex(),
      floor: t.floor,
      light: light.hex(),
      lightSoft: ch(light).alpha(0.35).css(),
      warm: t.warm,
      accent: accent.hex(),
      accentSoft: ch(accent).alpha(0.45).css(),
      shadow: ch.mix(bg, '#000000', 0.55).hex(),
      rim: ch.mix(accent, '#ffffff', 0.35).hex(),
      ink: t.ink,
      // градиент глубины: сверху светлее (фонари), снизу — чернота
      depth: ch.scale([ch(bg).darken(0.6), bg, ch(bg).darken(2.2)]).colors(3)
    };
  };

  /* ------------------------------------------------------- процедурная вода */
  Cine.waterTexture = function (x, y, w, h, seed, p, opts) {
    opts = opts || {};
    const g = new (K().Group)();
    const SimplexLib = Simplex();
    const noise = new SimplexLib(seed || 7);
    const step = opts.step || 9;
    const amp = opts.amp == null ? 0.5 : opts.amp;
    const rows = Math.ceil(h / step);
    // мокрый пол: лужи как замкнутые контуры по изолинии шума
    for (let r = 0; r < rows; r++) {
      const yy = y + r * step;
      const a = new Array();
      for (let i = 0; i <= 24; i++) {
        const x1 = x + i / 24 * w;
        const n = noise.noise2D(x1 * 0.0018, yy * 0.004) * 0.5 +
                  noise.noise2D(x1 * 0.006, yy * 0.011) * 0.5;
        a.push({ x: x1, y: yy + n * step * amp * 2.4 });
      }
      // тонкие линии бликов на воде
      if (r % 2 === 0) {
        const path = a.map(function (pt, i) { return (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1); }).join(' ');
        g.add(new (K().Path)({
          data: path,
          stroke: p.light,
          strokeWidth: 1 + (r % 3) * 0.4,
          opacity: 0.055 + ((r * 37) % 10) / 105 * amp,
          lineCap: 'round',
          lineJoin: 'round'
        }));
      }
    }
    // отражения: рваные вертикальные мазки
    const n2 = new SimplexLib((seed || 7) + 91);
    for (let i = 0; i < (opts.reflections || 14); i++) {
      const rx = x + n2.noise2D(i * 3.1, 0) * 0.5 * w + w * 0.5;
      const ry = y + Math.abs(n2.noise2D(i * 1.7, 5.5)) * h;
      const hh = 40 + Math.abs(n2.noise2D(i * 5.3, 9.1)) * 160;
      g.add(new (K().Path)({
        data: 'M' + rx.toFixed(1) + ' ' + ry.toFixed(1) + ' C' + (rx - 6).toFixed(1) + ' ' + (ry + hh * 0.4).toFixed(1) +
              ' ' + (rx + 7).toFixed(1) + ' ' + (ry + hh * 0.7).toFixed(1) + ' ' + (rx - 2).toFixed(1) + ' ' + (ry + hh).toFixed(1),
        stroke: p.warm,
        strokeWidth: 2.5,
        opacity: 0.07 + Math.abs(n2.noise2D(i * 2.2, 3.3)) * 0.11,
        lineCap: 'round'
      }));
    }
    return g;
  };

  /* ------------------------------------------------------- рваная тень */
  Cine.tornShadow = function (x, y, w, h, seed, color, alpha) {
    const SimplexLib = Simplex();
    const n = new SimplexLib(seed || 3);
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push({ x: x + t * w, y: y + n.noise2D(t * 3.2, 0.5) * h * 0.6 });
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      pts.push({ x: x + t * w, y: y + h + n.noise2D(t * 3.2, 4.7) * h * 0.5 });
    }
    return new (K().Path)({
      data: Cine.rig.smooth(pts, true, 0.7),
      fill: color || '#000000',
      opacity: alpha == null ? 0.55 : alpha,
      filters: []
    });
  };

  /* --------------------------------------------------------------- корабельный пол */
  Cine.room = function (o) {
    o = o || {};
    const p = o.palette || Cine.palette(o.tone, o.accent);
    const g = new (K().Group)();
    const horizon = o.horizon == null ? 1180 : o.horizon;

    // задняя стена: глубинный градиент
    const wall = new (K().Path)({
      data: 'M-400 -400 L' + (W + 400) + ' -400 L' + (W + 400) + ' ' + (horizon + 260) + ' L-400 ' + (horizon + 260) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: -200 },
      fillLinearGradientEndPoint: { x: 0, y: horizon + 200 },
      fillLinearGradientColorStops: [0, p.depth[0], 0.55, p.depth[1], 1, p.depth[2]]
    });
    g.add(wall);
    // общий «пыльный» подъём яркости задней стены
    g.add(new (K().Path)({
      data: 'M-400 -400 L' + (W + 400) + ' -400 L' + (W + 400) + ' ' + (horizon + 260) + ' L-400 ' + (horizon + 260) + 'Z',
      fill: chroma()(p.light).alpha(0.03).css()
    }));

    // силовой каркас: рёбра жёсткости уходят в перспективу
    const vp = o.vp || { x: 600, y: horizon - 120 };
    for (let i = -6; i <= 6; i++) {
      const xTop = vp.x + i * 210;
      const xBot = vp.x + i * 520;
      g.add(new (K().Path)({
        data: 'M' + xTop + ' -260 L' + xBot + ' ' + (horizon + 240),
        stroke: p.light,
        strokeWidth: i === 0 ? 3 : 1.6,
        opacity: 0.05 + (i === 0 ? 0.05 : 0)
      }));
    }
    // стыки обшивки
    for (let i = 0; i < 9; i++) {
      const yy = horizon - 520 + i * 92;
      g.add(new (K().Path)({
        data: 'M-400 ' + yy + ' L' + (W + 400) + ' ' + (yy + 6),
        stroke: p.ink, strokeWidth: 6, opacity: 0.35
      }));
      g.add(new (K().Path)({
        data: 'M-400 ' + (yy + 6) + ' L' + (W + 400) + ' ' + (yy + 12),
        stroke: p.light, strokeWidth: 1.4, opacity: 0.07
      }));
    }

    // панель с трубой/кабелем
    (o.pipes || []).forEach(function (pp) {
      g.add(new (K().Path)({
        data: 'M' + pp.x + ' ' + (pp.y0 || -200) + ' C' + (pp.x + 26) + ' ' + (pp.c1 || 400) + ' ' + (pp.x - 24) + ' ' + (pp.c2 || 800) + ' ' + pp.x + ' ' + (pp.y1 || horizon),
        stroke: p.shadow, strokeWidth: pp.w || 26, lineCap: 'round'
      }));
      g.add(new (K().Path)({
        data: 'M' + pp.x + ' ' + (pp.y0 || -200) + ' C' + (pp.x + 26) + ' ' + (pp.c1 || 400) + ' ' + (pp.x - 24) + ' ' + (pp.c2 || 800) + ' ' + pp.x + ' ' + (pp.y1 || horizon),
        stroke: p.light, strokeWidth: 2, opacity: 0.22, lineCap: 'round'
      }));
    });

    // пол
    const floorTop = horizon;
    g.add(new (K().Path)({
      data: 'M-400 ' + floorTop + ' L' + (W + 400) + ' ' + floorTop + ' L' + (W + 400) + ' ' + (H + 400) + ' L-400 ' + (H + 400) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: floorTop },
      fillLinearGradientEndPoint: { x: 0, y: H + 200 },
      fillLinearGradientColorStops: [0, p.floor, 0.42, chroma()(p.floor).brighten(1.5).hex(), 0.78, p.bgDeep, 1, '#01060a']
    }));
    // «зеркало» воды: широкие холодные блики от ламп
    g.add(new (K().Path)({
      data: 'M-400 ' + (floorTop + 90) + ' L' + (W + 400) + ' ' + (floorTop + 90) + ' L' + (W + 400) + ' ' + (H + 300) + ' L-400 ' + (H + 300) + 'Z',
      fillLinearGradientStartPoint: { x: 0, y: floorTop },
      fillLinearGradientEndPoint: { x: 0, y: H },
      fillLinearGradientColorStops: [0, chroma()(p.light).alpha(0.03).css(), 0.5, chroma()(p.light).alpha(0.085).css(), 1, chroma()(p.light).alpha(0.015).css()]
    }));
    // плинтус
    g.add(new (K().Path)({
      data: 'M-400 ' + floorTop + ' L' + (W + 400) + ' ' + floorTop,
      stroke: p.light, strokeWidth: 4, opacity: 0.3
    }));
    // линии стыка плит пола
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const yy = floorTop + Math.pow(t, 1.7) * 900;
      g.add(new (K().Path)({
        data: 'M-400 ' + yy + ' L' + (W + 400) + ' ' + yy,
        stroke: p.ink, strokeWidth: 3 + t * 4, opacity: 0.3
      }));
    }
    for (let i = -5; i <= 5; i++) {
      g.add(new (K().Path)({
        data: 'M' + (vp.x + i * 90) + ' ' + floorTop + ' L' + (vp.x + i * 430) + ' ' + (H + 200),
        stroke: p.ink, strokeWidth: 4, opacity: 0.22
      }));
    }

    // мокрый пол: процедурная вода
    g.add(Cine.waterTexture(-200, floorTop + 30, W + 400, 800, o.seed || 12, p, { amp: 1.15, reflections: 26, step: 8 }));

    // аварийные лампы: пятно, мягкий конус, отблеск на полу
    const HZ = floorTop;
    (o.lamps || []).forEach(function (L) {
      const lamp = new (K().Group)({ x: L.x, y: L.y });
      const R = L.r || 180;
      const reach = Math.max(240, HZ - L.y + 120);
      const coneH = Math.min(reach, HZ - L.y + 60);
      const ch = chroma()(p.accent);

      // объёмный конус: 5 вложенных клиньев, каждый шире и слабее
      for (let i = 4; i >= 0; i--) {
        const spread = 60 + i * 46;
        lamp.add(new (K().Path)({
          data: 'M-14 0 L14 0 L' + spread + ' ' + coneH + ' L-' + spread + ' ' + coneH + ' Z',
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: 0, y: coneH },
          fillLinearGradientColorStops: [
            0, ch.alpha(0.06 - i * 0.008).css(),
            0.55, ch.alpha(0.035 - i * 0.005).css(),
            1, ch.alpha(0).css()
          ]
        }));
      }
      // само пятно лампы
      lamp.add(new (K().Circle)({
        x: 0, y: 0, radius: R,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: R,
        fillRadialGradientColorStops: [
          0, ch.alpha(0.5).css(),
          0.35, ch.alpha(0.14).css(),
          1, ch.alpha(0).css()
        ]
      }));
      lamp.add(new (K().Path)({
        data: 'M-24 -6 C-24 -19 24 -19 24 -6 L16 0 L-16 0 Z',
        fill: p.rim, shadowColor: p.accent, shadowBlur: 54, opacity: 0.92
      }));
      g.add(lamp);

      // отблеск на мокром полу под лампой
      const py = HZ + 40 + (L.y / H) * 120;
      g.add(new (K().Ellipse)({
        x: L.x, y: py, radiusX: 190, radiusY: 34,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 190,
        fillRadialGradientColorStops: [0, ch.alpha(0.22).css(), 0.5, ch.alpha(0.07).css(), 1, ch.alpha(0).css()]
      }));
    });

    // дальний люк в глубине коридора: точка, куда сходится перспектива
    const doorW = 132, doorH = 236;
    const dg = new (K().Group)();
    dg.add(new (K().Path)({
      data: 'M' + (vp.x - doorW / 2) + ' ' + (HZ + 6) + ' L' + (vp.x - doorW / 2) + ' ' + (HZ - doorH) +
        ' Q' + vp.x + ' ' + (HZ - doorH - 46) + ' ' + (vp.x + doorW / 2) + ' ' + (HZ - doorH) +
        ' L' + (vp.x + doorW / 2) + ' ' + (HZ + 6) + ' Z',
      fill: '#050a0d', stroke: p.light, strokeWidth: 1.6, opacity: 0.9
    }));
    dg.add(new (K().Path)({
      data: 'M' + (vp.x - doorW / 2 + 8) + ' ' + (HZ - 4) + ' L' + (vp.x - doorW / 2 + 8) + ' ' + (HZ - doorH + 16) +
        ' Q' + vp.x + ' ' + (HZ - doorH - 30) + ' ' + (vp.x + doorW / 2 - 8) + ' ' + (HZ - doorH + 16) +
        ' L' + (vp.x + doorW / 2 - 8) + ' ' + (HZ - 4) + ' Z',
      stroke: chroma()(p.accent).alpha(0.5).css(), strokeWidth: 2.4, opacity: 0.55
    }));
    // обод и штурвал люка
    dg.add(new (K().Path)({
      data: 'M' + (vp.x - doorW / 2 - 10) + ' ' + (HZ + 8) + ' L' + (vp.x - doorW / 2 - 10) + ' ' + (HZ - doorH - 6) +
        ' Q' + vp.x + ' ' + (HZ - doorH - 62) + ' ' + (vp.x + doorW / 2 + 10) + ' ' + (HZ - doorH - 6) +
        ' L' + (vp.x + doorW / 2 + 10) + ' ' + (HZ + 8),
      stroke: chroma()(p.light).alpha(0.35).css(), strokeWidth: 2, opacity: 0.7
    }));
    dg.add(new (K().Circle)({
      x: vp.x, y: HZ - doorH * 0.55, radius: 22,
      stroke: chroma()(p.accent).alpha(0.55).css(), strokeWidth: 2.4, opacity: 0.8
    }));
    dg.add(new (K().Circle)({
      x: vp.x, y: HZ - doorH * 0.55, radius: 7,
      fill: chroma()(p.accent).alpha(0.35).css(), opacity: 0.8
    }));
    // предупреждающая полоса у порога
    dg.add(new (K().Path)({
      data: 'M' + (vp.x - doorW / 2 - 26) + ' ' + (HZ + 10) + ' L' + (vp.x + doorW / 2 + 26) + ' ' + (HZ + 10) +
        ' L' + (vp.x + doorW / 2 + 40) + ' ' + (HZ + 28) + ' L' + (vp.x - doorW / 2 - 40) + ' ' + (HZ + 28) + ' Z',
      fill: chroma()(p.accent).alpha(0.16).css()
    }));
    g.add(dg);

    // повисшие кабели — заполняют пустоту верхней трети
    const SimplexLib2 = Simplex();
    const nc = new SimplexLib2((o.seed || 12) + 17);
    for (let i = 0; i < 5; i++) {
      const cx0 = 60 + i * 250 + nc.noise2D(i, 0) * 60;
      const cy0 = -40;
      const sag = 180 + Math.abs(nc.noise2D(i * 2.3, 1.4)) * 220;
      g.add(new (K().Path)({
        data: 'M' + cx0 + ' ' + cy0 + ' C' + (cx0 + 20) + ' ' + (cy0 + sag * 0.9) + ' ' +
              (cx0 + 90) + ' ' + (cy0 + sag * 1.25) + ' ' + (cx0 + 150) + ' ' + (cy0 + sag * 1.05),
        stroke: p.ink, strokeWidth: 5 + (i % 3), opacity: 0.75, lineCap: 'round'
      }));
      g.add(new (K().Path)({
        data: 'M' + cx0 + ' ' + cy0 + ' C' + (cx0 + 20) + ' ' + (cy0 + sag * 0.9) + ' ' +
              (cx0 + 90) + ' ' + (cy0 + sag * 1.25) + ' ' + (cx0 + 150) + ' ' + (cy0 + sag * 1.05),
        stroke: p.light, strokeWidth: 1.2, opacity: 0.12, lineCap: 'round'
      }));
    }

    // пар у пола: три мягких слоя
    [0, 1, 2].forEach(function (i) {
      g.add(new (K().Ellipse)({
        x: 380 + i * 260, y: HZ + 130 + i * 40, radiusX: 300, radiusY: 54,
        fillRadialGradientStartPoint: { x: 0, y: 0 },
        fillRadialGradientEndPoint: { x: 0, y: 0 },
        fillRadialGradientRadius: 300,
        fillRadialGradientColorStops: [0, chroma()(p.warm).alpha(0.05).css(), 1, chroma()(p.warm).alpha(0).css()]
      }));
    });

    // рваная тень по низу кадра
    g.add(Cine.tornShadow(-300, H - 420, W + 600, 420, (o.seed || 4) + 3, '#000000', 0.5));
    return g;
  };

  /* --------------------------------------------------- эффекты на Konva */
  Cine.effects = function (layer) {
    const fx = new (K().Group)();
    layer.add(fx);

    // выстрел: пунктирный трассер, обрывается, не доходя до стены
    function tracer(a, b, p, opts) {
      opts = opts || {};
      const SimplexLib = Simplex();
      const n = new SimplexLib(opts.seed || 9);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const wob = opts.wobble || 6;
      // пуля не долетает до стены: обрыв читается как «ещё летит»
      const gap = opts.gap == null ? 0.05 : opts.gap;
      const end = { x: a.x + dx * (1 - gap), y: a.y + dy * (1 - gap) };

      const g = new (K().Group)();
      const segs = 8;
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * 0.97;
        const t1 = t0 + (0.97 / segs) * (0.5 + ((i * 37) % 10) / 22);
        const p0 = {
          x: a.x + dx * t0 * (1 - gap) + n.noise2D(i * 3.1, 0.5) * wob,
          y: a.y + dy * t0 * (1 - gap) + n.noise2D(0.7, i * 2.7) * wob
        };
        const p1 = {
          x: a.x + dx * t1 * (1 - gap) + n.noise2D(i * 3.1 + 2, 0.5) * wob,
          y: a.y + dy * t1 * (1 - gap) + n.noise2D(0.7, i * 2.7 + 2) * wob
        };
        const w = (opts.w || 6) * (1 - (i / segs) * 0.55);
        g.add(new (K().Line)({
          points: [p0.x, p0.y, p1.x, p1.y],
          stroke: p.accent, strokeWidth: w + 2, opacity: 0.26,
          lineCap: 'round', shadowColor: p.accent, shadowBlur: 20
        }));
        g.add(new (K().Line)({
          points: [p0.x, p0.y, p1.x, p1.y],
          stroke: '#fff6d8', strokeWidth: Math.max(1.2, w * 0.5), opacity: 0.9,
          lineCap: 'round', dash: [30, 18], dashOffset: i * 5
        }));
      }
      // рваные «усы» у дульного среза
      for (let i = 0; i < 5; i++) {
        const ang = Math.atan2(uy, ux) + (i - 2) * 0.2;
        const l2 = 16 + Math.abs(n.noise2D(i * 4.1, 2)) * 48;
        g.add(new (K().Line)({
          points: [a.x, a.y, a.x + Math.cos(ang) * l2, a.y + Math.sin(ang) * l2],
          stroke: p.warm, strokeWidth: 2.2, opacity: 0.7, lineCap: 'round'
        }));
      }
      // обрывок трассы у самой стены — следующая пуля очереди
      g.add(new (K().Line)({
        points: [end.x - ux * 40, end.y - uy * 40, end.x, end.y],
        stroke: '#fff6d8', strokeWidth: 1.4, opacity: 0.3, dash: [9, 13], lineCap: 'round'
      }));
      return g;
    }

    // удар: зубчатая вспышка
    function impact(x, y, p, r) {
      r = r || 60;
      const SimplexLib = Simplex();
      const n = new SimplexLib(Math.round(x + y));
      const pts = [];
      const N = 11;
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2;
        const rad = r * (0.35 + Math.abs(n.noise2D(i * 1.7, 3.3)) * 1.1);
        pts.push({ x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad });
      }
      const g = new (K().Group)();
      g.add(new (K().Path)({
        data: pts.map(function (q, i) { return (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); }).join(' ') + 'Z',
        fill: p.accentSoft || p.warm, opacity: 0.4, shadowColor: p.accent, shadowBlur: 24
      }));
      g.add(new (K().Path)({
        data: pts.map(function (q, i) { return (i ? 'L' : 'M') + (x + (q.x - x) * 1.35).toFixed(1) + ' ' + (y + (q.y - y) * 1.35).toFixed(1); }).join(' ') + 'Z',
        stroke: p.accent, strokeWidth: 2.2, opacity: 0.5
      }));
      // скол: тёмная выбоина в центре удара
      g.add(new (K().Path)({
        data: Cine.rig.smooth([
          { x: x - r * 0.3, y: y - r * 0.16 },
          { x: x + r * 0.12, y: y - r * 0.3 },
          { x: x + r * 0.34, y: y + r * 0.05 },
          { x: x + r * 0.05, y: y + r * 0.3 },
          { x: x - r * 0.26, y: y + r * 0.14 }
        ], true, 0.4),
        fill: '#0b1116', stroke: p.rim, strokeWidth: 1.6, opacity: 0.85
      }));
      return g;
    }

    // дым / пыль: несколько безье с шумом
    function smoke(x, y, p, opts) {
      opts = opts || {};
      const SimplexLib = Simplex();
      const n = new SimplexLib(opts.seed || 5);
      const g = new (K().Group)();
      for (let i = 0; i < (opts.n || 7); i++) {
        const ex = x + n.noise2D(i * 2.3, 1.1) * 180;
        const ey = y - 80 - Math.abs(n.noise2D(i * 1.9, 4.4)) * 260;
        g.add(new (K().Path)({
          data: 'M' + x + ' ' + y + ' C' + (x + 40) + ' ' + (y - 60) + ' ' + (ex - 50) + ' ' + (ey + 60) + ' ' + ex + ' ' + ey,
          stroke: p.light, strokeWidth: 24 + i * 4, opacity: 0.05 + i * 0.004, lineCap: 'round'
        }));
      }
      return g;
    }

    return { group: fx, tracer: tracer, impact: impact, smoke: smoke };
  };

  Cine.W = W;
  Cine.H = H;
})(window);
