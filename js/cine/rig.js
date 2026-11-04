/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  фигуры людей
   Люди рисуются ТОЛЬКО через Konva.Path (кривые Безье): силуэт, одежда,
   лицо, поза, эмоция. Никаких Rect в человеческой фигуре.

   Модель: скелет из суставов (таз → грудь → шея → голова, руки, ноги),
   по суставам строится замкнутый силуэт и сглаживается Catmull-Rom → Безье.
   ========================================================================== */
(function (global) {
  'use strict';

  const Cine = global.Cine = global.Cine || {};

  /* Konva берём лениво: движок подключается после этого файла */
  function K() { return global.Konva; }

  /* --------------------------------------------------------------- геометрия */
  const TAU = Math.PI * 2;

  function P(x, y) { return { x: x, y: y }; }
  function polar(p, ang, len) { return { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len }; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function norm(v) { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; }
  function perp(v) { return { x: -v.y, y: v.x }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }

  /** Catmull-Rom → кубические Безье: органичный замкнутый или открытый контур */
  function smooth(points, closed, tension) {
    const t = tension == null ? 1 : tension;
    const n = points.length;
    if (n < 2) return '';
    const at = function (i) {
      if (closed) return points[(i + n) % n];
      return points[Math.max(0, Math.min(n - 1, i))];
    };
    let d = 'M' + r(points[0].x) + ' ' + r(points[0].y);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const c1 = { x: p1.x + (p2.x - p0.x) / 6 * t, y: p1.y + (p2.y - p0.y) / 6 * t };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6 * t, y: p2.y - (p3.y - p1.y) / 6 * t };
      d += 'C' + r(c1.x) + ' ' + r(c1.y) + ' ' + r(c2.x) + ' ' + r(c2.y) + ' ' + r(p2.x) + ' ' + r(p2.y);
    }
    if (closed) d += 'Z';
    return d;
  }
  function r(v) { return Math.round(v * 100) / 100; }

  /** лента по двум суставам: замкнутый контур с разной толщиной концов */
  function limb(a, b, w1, w2, bow) {
    const v = sub(b, a);
    const n = norm(perp(v));
    const m = mid(a, b);
    const c1 = { x: m.x + n.x * (w1 + w2) * 0.5 * (bow || 0), y: m.y + n.y * (w1 + w2) * 0.5 * (bow || 0) };
    const l1 = { x: a.x + n.x * w1, y: a.y + n.y * w1 };
    const l2 = { x: b.x + n.x * w2, y: b.y + n.y * w2 };
    const rr1 = { x: a.x - n.x * w1, y: a.y - n.y * w1 };
    const rr2 = { x: b.x - n.x * w2, y: b.y - n.y * w2 };
    return smooth([l1, { x: lerp(l1.x, l2.x, 0.5) + n.x * (bow || 0) * 8, y: lerp(l1.y, l2.y, 0.5) + n.y * (bow || 0) * 8 }, l2, rr2, rr1], true, 1);
  }

  /** двузвенная IK: где встанет локоть/колено */
  function ik(root, target, l1, l2, bend) {
    const d = Math.max(1, Math.min(l1 + l2 - 0.5, Math.hypot(target.x - root.x, target.y - root.y)));
    const a = Math.atan2(target.y - root.y, target.x - root.x);
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
    return polar(root, a + ang * (bend || 1), l1);
  }


  /** кисть: ладонь + отставленный большой палец, ориентирована по предплечью */
  function handPath(elbow, hand, size, skin, ink) {
    const v = norm(sub(hand, elbow));
    const n = norm(perp(v));
    const s = size || 1;
    const base = { x: hand.x - v.x * 14 * s, y: hand.y - v.y * 14 * s };
    const p = function (alongT, sideT) {
      return {
        x: base.x + v.x * alongT * s + n.x * sideT * s,
        y: base.y + v.y * alongT * s + n.y * sideT * s
      };
    };
    const palm = smooth([
      p(0, 10), p(14, 12), p(30, 9), p(34, 2),
      p(30, -8), p(14, -11), p(0, -9)
    ], true, 0.35);
    // большой палец
    const thumb = smooth([
      p(6, 9), p(16, 18), p(26, 22), p(30, 16), p(20, 10)
    ], true, 0.5);
    const g = new (K().Group)();
    g.add(new (K().Path)({ data: palm, fill: skin.base, stroke: ink, strokeWidth: 2.4 }));
    g.add(new (K().Path)({ data: thumb, fill: skin.base, stroke: ink, strokeWidth: 2 }));
    // складка ладони
    g.add(new (K().Path)({
      data: 'M' + r(p(4, 4).x) + ' ' + r(p(4, 4).y) + ' L' + r(p(24, 2).x) + ' ' + r(p(24, 2).y),
      stroke: skin.shade, strokeWidth: 1.4, opacity: 0.6
    }));
    return g;
  }

  /* --------------------------------------------------------------- палитры */
  const SKIN = {
    hunter: { base: '#c9a184', shade: '#a07a5f', light: '#e6c3a5' },
    nullar: { base: '#b99a8c', shade: '#8d7062', light: '#dcc0ae' },
    guard: { base: '#9c8271', shade: '#77604f', light: '#bda18d' },
    doctor: { base: '#c4ab97', shade: '#9a8573', light: '#e0cbb9' },
    woman: { base: '#d2ae96', shade: '#a9856d', light: '#eed0b6' },
    wei: { base: '#d8b79c', shade: '#ab8569', light: '#f0d3b8' },
    tech: { base: '#8f7a68', shade: '#6a5748', light: '#ab9380' },
    kraken: { base: '#b08a72', shade: '#856251', light: '#cfa78c' },
    // Том 3+: обращённые — пепельная кожа, зеленоватый подтон
    turned: { base: '#8d9a92', shade: '#5e6d66', light: '#b6c4bb' },
    turnedDeep: { base: '#6f7f78', shade: '#45524c', light: '#9caea4' }
  };

  /* --------------------------------------------------------------- пропорции */
  const BONE = {
    pelvisY: -250,
    spine: 156,        // таз → грудь
    neck: 30,          // грудь → основание шеи
    headR: 47,
    shoulder: 46,      // полуширина плеч
    upper: 90,         // плечо → локоть
    fore: 86,          // локоть → кисть
    thigh: 113,        // бедро
    shin: 113,         // голень
    foot: 24
  };

  /* --------------------------------------------------------------- суставы */
  function skeleton(st) {
    const lean = st.lean || 0;             // наклон корпуса (рад, + вперёд)
    const crouch = st.crouch || 0;         // 0..1 присед
    const hip = { x: st.x + (st.hipShift || 0), y: st.y + BONE.pelvisY + crouch * 40 + (st.drop || 0) };

    const spineDir = -Math.PI / 2 + lean;
    const chest = polar(hip, spineDir, BONE.spine - crouch * 26);
    const neckBase = polar(chest, spineDir, BONE.neck);
    const headTilt = (st.headTilt || 0) + lean * 0.35;
    const head = polar(neckBase, -Math.PI / 2 + headTilt, BONE.headR * 1.06);

    const shDir = norm(sub(chest, hip));
    const shPerp = perp(shDir);
    const sL = { x: chest.x + shPerp.x * BONE.shoulder, y: chest.y + shPerp.y * BONE.shoulder };
    const sR = { x: chest.x - shPerp.x * BONE.shoulder, y: chest.y - shPerp.y * BONE.shoulder };

    const hipPerp = perp(norm({ x: 0, y: -1 }));
    const hipL = { x: hip.x + hipPerp.x * 26, y: hip.y + hipPerp.y * 4 };
    const hipR = { x: hip.x - hipPerp.x * 26, y: hip.y - hipPerp.y * 4 };

    // руки: цели кистей
    const handL = st.handL || { x: chest.x + 66, y: hip.y + 40 };
    const handR = st.handR || { x: chest.x - 62, y: hip.y + 34 };
    const eL = ik(sL, handL, BONE.upper, BONE.fore, 1);
    const eR = ik(sR, handR, BONE.upper, BONE.fore, -1);

    // ноги
    const footL = st.footL || { x: hipL.x + 16, y: st.y };
    const footR = st.footR || { x: hipR.x - 18, y: st.y };
    const kL = ik(hipL, footL, BONE.thigh, BONE.shin, 1);
    const kR = ik(hipR, footR, BONE.thigh, BONE.shin, -1);

    return {
      hip: hip, chest: chest, neckBase: neckBase, head: head,
      headTilt: headTilt, lean: lean, shDir: shDir, shPerp: shPerp,
      sL: sL, sR: sR, eL: eL, eR: eR, handL: handL, handR: handR,
      hipL: hipL, hipR: hipR, kL: kL, kR: kR, footL: footL, footR: footR
    };
  }

  /* --------------------------------------------------------------- лицо */
  const FACE = {
    neutral: { brow: 0, browY: 0, lid: 0.22, mouth: 0.0, mouthW: 1.0, open: 0, cheek: 0 },
    angry:   { brow: 0.55, browY: 4, lid: 0.42, mouth: -0.5, mouthW: 0.92, open: 0.08, cheek: 0.5 },
    smirk:   { brow: 0.3, browY: 1, lid: 0.5, mouth: 0.62, mouthW: 1.05, open: 0.02, cheek: 0.7, asym: 1 },
    fear:    { brow: -0.5, browY: -6, lid: 0.95, mouth: -0.2, mouthW: 0.72, open: 0.42, cheek: -0.2 },
    pain:    { brow: 0.7, browY: 2, lid: 0.62, mouth: -0.75, mouthW: 0.8, open: 0.22, cheek: 0.3 },
    shout:   { brow: 0.4, browY: -2, lid: 0.8, mouth: -0.35, mouthW: 0.9, open: 0.72, cheek: 0.1 },
    focus:   { brow: 0.42, browY: 3, lid: 0.3, mouth: -0.1, mouthW: 0.85, open: 0.0, cheek: 0.35 }
  };

  function faceParams(emotion, blend) {
    const base = FACE.neutral, e = FACE[emotion] || FACE.neutral;
    const t = blend == null ? 1 : blend;
    const o = {};
    Object.keys(base).forEach(function (k) {
      const a = base[k], b = e[k] == null ? a : e[k];
      o[k] = a + (b - a) * t;
    });
    o.asym = e.asym || 0;
    return o;
  }

  function buildFace(st, face, skin) {
    const g = new (K().Group)();
    const hx = st.head.x, hy = st.head.y, R = BONE.headR;
    const tilt = st.headTilt || 0;
    // лицо смотрит вправо: слегка сдвигаем черты вперёд
    const fx = hx + R * 0.18, fy = hy - 2;

    const ink = '#2a1a16';
    const browY = -R * 0.30 + face.browY * 0.5;
    const eyeY = -R * 0.06 + face.browY * 0.35;
    const eyeDX = R * 0.36;

    // глаз со стороны камеры + дальний глаз
    [1, -1].forEach(function (side) {
      const ex = fx + side * eyeDX * (side > 0 ? 1 : 0.92);
      const ew = R * (side > 0 ? 0.26 : 0.2);
      const eh = R * 0.13 * (1 - face.lid * 0.55);
      const y = fy + eyeY - side * 1.5;
      // разрез глаза
      const eyelidUp = 'M' + r(ex - ew) + ' ' + r(y) +
        'C' + r(ex - ew * 0.4) + ' ' + r(y - eh * 2.2) + ' ' + r(ex + ew * 0.5) + ' ' + r(y - eh * 2.0) + ' ' + r(ex + ew) + ' ' + r(y - 1);
      const eyelidDn = 'C' + r(ex + ew * 0.5) + ' ' + r(y + eh * 1.9) + ' ' + r(ex - ew * 0.4) + ' ' + r(y + eh * 2.1) + ' ' + r(ex - ew) + ' ' + r(y) + 'Z';
      g.add(new (K().Path)({
        data: eyelidUp + eyelidDn, fill: '#f2ece4', opacity: 0.92
      }));
      // зрачок — точка фокуса, смещён в сторону взгляда
      g.add(new (K().Path)({
        data: 'M' + r(ex + ew * 0.12) + ' ' + r(y - eh * 0.9) +
          'C' + r(ex + ew * 0.62) + ' ' + r(y - eh * 0.7) + ' ' + r(ex + ew * 0.62) + ' ' + r(y + eh * 0.9) + ' ' +
          r(ex + ew * 0.12) + ' ' + r(y + eh * 0.9) +
          'C' + r(ex - ew * 0.3) + ' ' + r(y + eh * 0.7) + ' ' + r(ex - ew * 0.3) + ' ' + r(y - eh * 0.7) + ' ' +
          r(ex + ew * 0.12) + ' ' + r(y - eh * 0.9) + 'Z',
        fill: ink
      }));
      // веко сверху — жирная кривая, задаёт «прищур»
      g.add(new (K().Path)({
        data: 'M' + r(ex - ew) + ' ' + r(y) + 'C' + r(ex - ew * 0.3) + ' ' + r(y - eh * 2.3) + ' ' + r(ex + ew * 0.5) + ' ' + r(y - eh * 2.1) + ' ' + r(ex + ew) + ' ' + r(y - 1),
        stroke: ink, strokeWidth: 2.4, lineCap: 'round'
      }));
    });

    // брови: наклон = злость/испуг
    [1, -1].forEach(function (side) {
      const bx = fx + side * eyeDX * (side > 0 ? 1 : 0.92);
      const by = fy + browY - side * 0.6;
      const w = R * (side > 0 ? 0.3 : 0.24);
      const inner = by + face.brow * R * 0.16 * (side > 0 ? 1 : 0.85);
      const outer = by - face.brow * R * 0.1;
      const asym = side < 0 ? face.asym * R * 0.12 : 0;
      g.add(new (K().Path)({
        data: 'M' + r(bx - w) + ' ' + r(outer - asym) +
          'C' + r(bx - w * 0.3) + ' ' + r(lerp(outer, inner, 0.6) - 3) + ' ' + r(bx + w * 0.4) + ' ' + r(inner - 2) + ' ' +
          r(bx + w) + ' ' + r(inner + asym),
        stroke: ink, strokeWidth: 4.6, lineCap: 'round', tension: 0.4
      }));
    });

    // нос — короткая линия от переносицы
    g.add(new (K().Path)({
      data: 'M' + r(fx + R * 0.1) + ' ' + r(fy - R * 0.05) +
        'C' + r(fx + R * 0.24) + ' ' + r(fy + R * 0.12) + ' ' + r(fx + R * 0.28) + ' ' + r(fy + R * 0.2) + ' ' +
        r(fx + R * 0.16) + ' ' + r(fy + R * 0.24),
      stroke: '#8a6151', strokeWidth: 2.6, opacity: 0.75, lineCap: 'round'
    }));

    // рот: кривизна + приоткрытость
    const mw = R * 0.30 * face.mouthW;
    const my = fy + R * 0.42;
    const curve = face.mouth * R * 0.20;
    const open = face.open * R * 0.22;
    const mx = fx + R * 0.12;
    if (open > 1.2) {
      g.add(new (K().Path)({
        data: 'M' + r(mx - mw) + ' ' + r(my) +
          'C' + r(mx - mw * 0.4) + ' ' + r(my - open * 0.55) + ' ' + r(mx + mw * 0.5) + ' ' + r(my - open * 0.5) + ' ' + r(mx + mw) + ' ' + r(my + curve * 0.4) +
          'C' + r(mx + mw * 0.4) + ' ' + r(my + open) + ' ' + r(mx - mw * 0.5) + ' ' + r(my + open * 0.95) + ' ' + r(mx - mw) + ' ' + r(my) + 'Z',
        fill: '#3a1414', stroke: ink, strokeWidth: 1.8
      }));
      g.add(new (K().Path)({
        data: 'M' + r(mx - mw * 0.55) + ' ' + r(my + open * 0.2) + 'C' + r(mx - mw * 0.1) + ' ' + r(my + open * 0.5) + ' ' + r(mx + mw * 0.35) + ' ' + r(my + open * 0.45) + ' ' + r(mx + mw * 0.6) + ' ' + r(my + open * 0.15),
        stroke: '#7d3b3b', strokeWidth: 2, opacity: 0.8
      }));
    } else {
      g.add(new (K().Path)({
        data: 'M' + r(mx - mw) + ' ' + r(my) +
          'C' + r(mx - mw * 0.35) + ' ' + r(my + curve * 1.5) + ' ' + r(mx + mw * 0.45) + ' ' + r(my + curve * 1.4) + ' ' + r(mx + mw) + ' ' + r(my + curve * 0.2),
        stroke: ink, strokeWidth: 3, lineCap: 'round'
      }));
    }

    // складки у рта (напряжение)
    if (face.cheek > 0.35) {
      g.add(new (K().Path)({
        data: 'M' + r(mx - mw * 1.5) + ' ' + r(my - R * 0.1) + 'C' + r(mx - mw * 1.8) + ' ' + r(my + R * 0.06) + ' ' + r(mx - mw * 1.7) + ' ' + r(my + R * 0.18) + ' ' + r(mx - mw * 1.5) + ' ' + r(my + R * 0.24),
        stroke: skin.shade, strokeWidth: 2, opacity: 0.55
      }));
    }
    // пот / кровь
    if (face.cheek < -0.1) {
      g.add(new (K().Path)({
        data: 'M' + r(fx + R * 0.42) + ' ' + r(fy - R * 0.5) + 'C' + r(fx + R * 0.52) + ' ' + r(fy - R * 0.34) + ' ' + r(fx + R * 0.5) + ' ' + r(fy - R * 0.24) + ' ' + r(fx + R * 0.44) + ' ' + r(fy - R * 0.22),
        stroke: '#9fe4ff', strokeWidth: 2.6, opacity: 0.8, lineCap: 'round'
      }));
    }

    g.rotation(tilt * 180 / Math.PI);
    g.offset({ x: hx, y: hy });
    g.position({ x: hx, y: hy });
    return g;
  }


  /* ------------------------------------------------------- мутационные признаки */
  /**
   * mutant: {
   *   veins: 0..1      — светящиеся жилы под кожей (предплечья, шея, скулы)
   *   tendrils: 0..4   — щупальца из-за спины/из-за плеч
   *   claw: 0..1       — пальцы удлиняются и заостряются
   *   glow: '#8affd6'  — цвет свечения
   *   eyeGlow: 0..1    — свечение зрачков
   * }
   */
  function drawMutant(layer, s, mut, skin, ink, part) {
    if (!mut) return;
    const glow = mut.glow || '#8affd6';
    const which = part || 'all';
    const want = function (name) { return which === 'all' || which === name; };

    /* ---------- жилы: ветвящиеся линии под кожей ---------- */
    if (want('body') || want('head')) {
      const v = mut.veins || 0;
      if (v > 0) {
        const zig = function (A, B, n, amp, seed) {
          const dx = B.x - A.x, dy = B.y - A.y;
          const L = Math.hypot(dx, dy) || 1;
          const px = -dy / L, py = dx / L;
          const pts = [A];
          for (let i = 1; i < n; i++) {
            const t = i / n;
            const w = Math.sin((t * 6.4 + seed) * Math.PI) * amp;
            pts.push({ x: A.x + dx * t + px * w, y: A.y + dy * t + py * w });
          }
          pts.push(B);
          return pts;
        };
        const vein = function (pts, width, op) {
          const flat = [];
          pts.forEach(function (q) { flat.push(r(q.x), r(q.y)); });
          layer.add(new (K().Line)({
            points: flat, stroke: glow, strokeWidth: width, opacity: op,
            lineCap: 'round', lineJoin: 'round', tension: 0.42,
            shadowColor: glow, shadowBlur: 9 + v * 10
          }));
          layer.add(new (K().Line)({
            points: flat, stroke: '#eafff8', strokeWidth: Math.max(0.6, width * 0.3), opacity: op * 0.7,
            lineCap: 'round', lineJoin: 'round', tension: 0.42
          }));
        };

        if (want('body')) {
          [[s.eL, s.handL, 1], [s.eR, s.handR, -1]].forEach(function (arm, idx) {
            const A = arm[0], B = arm[1], sgn = arm[2];
            const dx = B.x - A.x, dy = B.y - A.y;
            const L = Math.hypot(dx, dy) || 1;
            const ux = dx / L, uy = dy / L, px = -uy, py = ux;
            for (let i = 0; i < 3; i++) {
              const off = (i - 1) * 4.6 + sgn * 1.2;
              const t0 = 0.1 + i * 0.05, t1 = 0.9 - i * 0.06;
              const a2 = { x: A.x + ux * L * t0 + px * off, y: A.y + uy * L * t0 + py * off };
              const b2 = { x: A.x + ux * L * t1 + px * off * 1.6, y: A.y + uy * L * t1 + py * off * 1.6 };
              vein(zig(a2, b2, 4, 2.4 + v * 1.6, i + idx * 2), 1.3 + v * 1.1, 0.3 + v * 0.45);
            }
            // отростки у локтя и у кисти
            [[0.12, 1], [0.8, -1]].forEach(function (sp, k) {
              const bx = A.x + ux * L * sp[0], by = A.y + uy * L * sp[0];
              const dir = sp[1] * (k ? -1 : 1);
              vein(zig({ x: bx, y: by }, { x: bx + px * 10 * dir + ux * 8, y: by + py * 10 * dir + uy * 8 }, 3, 1.8, k + idx), 1 + v * 0.9, 0.26 + v * 0.3);
            });
          });
        }

        if (want('head')) {
          if (v > 0.25) {
            [-1, 1].forEach(function (sgn) {
              const a2 = { x: s.neckBase.x + sgn * 9, y: s.neckBase.y + 10 };
              const b2 = { x: s.head.x + sgn * 20, y: s.head.y + 40 };
              vein(zig(a2, b2, 3, 1.6, sgn + 1), 1.2 + v * 0.8, 0.18 + v * 0.26);
            });
          }
          if (v > 0.55) {
            vein(zig({ x: s.head.x - 30, y: s.head.y + 2 }, { x: s.head.x - 8, y: s.head.y - 26 }, 3, 1.4, 3), 1, 0.3 * v);
          }
        }
      }
    }

    /* ---------- щупальца: из-за плеч, дугой наружу, с крючком на конце ---------- */
    if (want('back')) {
      const tn = Math.round(mut.tendrils || 0);
      for (let i = 0; i < tn; i++) {
        const side = i % 2 ? 1 : -1;
        const row = Math.floor(i / 2);
        const base = {
          x: s.chest.x + side * (BONE.shoulder - 10),
          y: s.chest.y + 22 + row * 12
        };
        const len = 176 + (i % 3) * 18 - row * 22;
        const N = 12;
        const ds = len / N;
        // угол стартует вертикально и загибается наружу — к концу почти горизонтально
        const bend = 0.78 + (i % 2) * 0.14;
        const pts = [base];
        let px = base.x, py = base.y;
        let acc = 0;
        for (let k = 1; k <= N; k++) {
          const t = k / N;
          const ang = -Math.PI / 2 + side * bend * Math.pow(t, 1.55);
          acc += ds;
          px += Math.cos(ang) * ds;
          py += Math.sin(ang) * ds;
          pts.push({ x: px, y: py });
        }
        // лента-полигон: ширина падает к кончику
        const r0 = 13.2 - i * 1.1;
        const left = [], right = [];
        for (let k = 0; k <= N; k++) {
          const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N, k + 1)];
          const dx = b.x - a.x, dy = b.y - a.y;
          const L = Math.hypot(dx, dy) || 1;
          const nx = -dy / L, ny = dx / L;
          const w = Math.max(1.1, r0 * (1 - Math.pow(k / N, 1.45) * 0.93));
          left.push({ x: pts[k].x + nx * w * 0.5, y: pts[k].y + ny * w * 0.5 });
          right.push({ x: pts[k].x - nx * w * 0.5, y: pts[k].y - ny * w * 0.5 });
        }
        const flatL = [], flatR = [];
        left.forEach(function (q) { flatL.push(q.x, q.y); });
        right.reverse().forEach(function (q) { flatR.push(q.x, q.y); });
        layer.add(new (K().Line)({
          points: flatL.concat(flatR), closed: true, tension: 0.42,
          fill: skin.base, stroke: ink, strokeWidth: 2.6, lineJoin: 'round'
        }));
        // затенение вдоль внутренней стороны
        layer.add(new (K().Line)({
          points: flatL, tension: 0.42, stroke: skin.shade, strokeWidth: r0 * 0.28,
          opacity: 0.55, lineCap: 'round', offsetX: side * 2, offsetY: 1
        }));
        // блик
        layer.add(new (K().Line)({
          points: flatR, tension: 0.42, stroke: skin.light, strokeWidth: r0 * 0.2,
          opacity: 0.4, lineCap: 'round', offsetX: -side * 1.5
        }));
        // жила свечения внутри ленты
        const flatC = [];
        pts.forEach(function (q) { flatC.push(r(q.x), r(q.y)); });
        layer.add(new (K().Line)({
          points: flatC, stroke: glow, strokeWidth: 1.7, opacity: 0.34,
          lineCap: 'round', lineJoin: 'round', tension: 0.42,
          shadowColor: glow, shadowBlur: 14
        }));
        // узелки
        [4, 8].forEach(function (k) {
          layer.add(new (K().Circle)({
            x: r(pts[k].x), y: r(pts[k].y), radius: 1.6, fill: glow, opacity: 0.34,
            shadowColor: glow, shadowBlur: 6
          }));
        });
        // кончик-крючок
        const tip = pts[N];
        layer.add(new (K().Circle)({
          x: r(tip.x), y: r(tip.y), radius: 3.4, fill: '#eafff8', opacity: 0.86,
          shadowColor: glow, shadowBlur: 16
        }));
      }
    }

    /* ---------- когти ---------- */
    if (want('body')) {
      const cl = mut.claw || 0;
      if (cl > 0) {
        [[s.eL, s.handL], [s.eR, s.handR]].forEach(function (arm) {
          const A = arm[0], B = arm[1];
          const dx = B.x - A.x, dy = B.y - A.y;
          const L = Math.hypot(dx, dy) || 1;
          const ux = dx / L, uy = dy / L, px = -uy, py = ux;
          for (let i = -1; i <= 1; i++) {
            const off = i * 7.5;
            const bx = B.x + px * off - ux * 2, by = B.y + py * off - uy * 2;
            const lenk = 14 + cl * 26 - Math.abs(i) * 3;
            const tx = bx + ux * lenk + px * i * 4, ty = by + uy * lenk + py * i * 4 + cl * 4;
            const data = 'M' + r(bx + px * 3.2) + ' ' + r(by + py * 3.2) +
              ' Q' + r(bx + ux * lenk * 0.5 + px * (off > 0 ? 4 : -1)) + ' ' + r(by + uy * lenk * 0.5 + py * 3) +
              ' ' + r(tx) + ' ' + r(ty) +
              ' Q' + r(bx + ux * lenk * 0.45 - px * 3) + ' ' + r(by + uy * lenk * 0.45 - py * 2) +
              ' ' + r(bx - px * 3.2) + ' ' + r(by - py * 3.2) + ' Z';
            layer.add(new (K().Path)({ data: data, fill: '#c9d4cd', stroke: ink, strokeWidth: 1.5, opacity: 0.95 }));
            layer.add(new (K().Path)({ data: data, stroke: glow, strokeWidth: 0.6, opacity: 0.3, shadowColor: glow, shadowBlur: 7 }));
          }
        });
      }
    }
  }

  /* --------------------------------------------------------------- фигура */
  /**
   * buildFigure({x,y,scale,flip,variant,pose,emotion,rifle,palette})
   * variant: hunter | nullar | guard | doctor | woman
   * pose:    stand | aim | recoil | run | crouch | guard | hit | down
   */
  function buildFigure(o) {
    o = o || {};
    const variant = o.variant || 'hunter';
    const root = new (K().Group)({
      x: o.x || 0,
      y: o.y || 0,
      scaleX: (o.flip ? -1 : 1) * (o.scale || 1),
      scaleY: o.scale || 1
    });

    const skin = SKIN[variant] || SKIN.hunter;
    const pal = o.palette || {};
    const cloth = pal.cloth || (variant === 'nullar' ? '#2a2340' : variant === 'guard' ? '#22343f' : '#26333a');
    const cloth2 = pal.cloth2 || '#161f26';
    const accent = pal.accent || (variant === 'nullar' ? '#9a7bff' : '#39e0d2');
    const ink = '#05090c';

    const st = {
      x: 0, y: 0, lean: 0, crouch: 0, headTilt: 0, hipShift: 0,
      handL: null, handR: null, footL: null, footR: null
    };
    Object.assign(st, o.state || {});

    const layerTorso = new (K().Group)();
    const layerHead = new (K().Group)();
    const layerLimbs = new (K().Group)();
    const layerBack = new (K().Group)();   // щупальца и то, что за спиной
    root.add(layerBack, layerLimbs, layerTorso, layerHead);

    const nodes = {};

    function make(pathOpts) { return new (K().Path)(pathOpts); }

    function draw() {
      layerTorso.destroyChildren();
      layerHead.destroyChildren();
      layerLimbs.destroyChildren();
      layerBack.destroyChildren();

      const s = skeleton(st);

      /* --- то, что за спиной: щупальца --- */
      if (o.mutant) drawMutant(layerBack, s, o.mutant, skin, ink, 'back');

      /* --- задняя рука и ноги (за корпусом) --- */
      layerLimbs.add(make({
        data: smooth([
          { x: s.sR.x + 15, y: s.sR.y - 4 },
          { x: s.sR.x - 2, y: s.sR.y - 20 },
          { x: s.sR.x - 19, y: s.sR.y },
          { x: s.sR.x - 10, y: s.sR.y + 24 },
          { x: s.sR.x + 12, y: s.sR.y + 20 }
        ], true, 0.4), fill: cloth2, stroke: ink, strokeWidth: 3
      }));
      layerLimbs.add(make({ data: limb(s.sR, s.eR, 15, 12, -0.06), fill: cloth2, stroke: ink, strokeWidth: 3 }));
      layerLimbs.add(make({ data: limb(s.eR, s.handR, 13, 8, -0.04), fill: cloth2, stroke: ink, strokeWidth: 3 }));
      layerLimbs.add(handPath(s.eR, s.handR, 0.92, SKIN[variant] || SKIN.hunter, ink));
      layerLimbs.add(make({ data: limb(s.hipR, s.kR, 24, 19, 0.05), fill: cloth2, stroke: ink, strokeWidth: 3 }));
      layerLimbs.add(make({ data: limb(s.kR, s.footR, 18, 12, 0.02), fill: cloth2, stroke: ink, strokeWidth: 3 }));
      // ботинок
      layerLimbs.add(make({
        data: smooth([
          { x: s.footR.x - 18, y: s.footR.y + 1 },
          { x: s.footR.x + 24, y: s.footR.y + 1 },
          { x: s.footR.x + 27, y: s.footR.y - 9 },
          { x: s.footR.x + 16, y: s.footR.y - 22 },
          { x: s.footR.x - 12, y: s.footR.y - 24 },
          { x: s.footR.x - 20, y: s.footR.y - 12 }
        ], true, 0.25),
        fill: '#0d1418', stroke: ink, strokeWidth: 2
      }));

      /* --- корпус: замкнутый силуэт по суставам --- */
      const shW = 44, waW = 33, hipW = 32;
      function along(from, to, t) { return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }; }
      const waist = along(s.chest, s.hip, 0.62);
      const sp = s.shPerp;
      const nL = { x: -sp.x, y: -sp.y };   // «наружу» влево по экрану
      function off(p2, n, d) { return { x: p2.x + n.x * d, y: p2.y + n.y * d }; }

      const torsoPts = [
        off(s.neckBase, nL, 13),                       // основание шеи слева
        off(along(s.neckBase, s.chest, 0.34), nL, shW * 0.86), // трапеция
        off(s.chest, nL, shW),                          // плечо
        off(along(s.chest, waist, 0.55), nL, shW * 0.72),
        off(waist, nL, waW),                            // талия
        off(along(waist, s.hip, 0.9), nL, hipW),
        off(s.hip, nL, hipW * 0.72),
        { x: s.hip.x, y: s.hip.y + 26 },                // пах
        off(s.hip, sp, hipW * 0.72),
        off(along(waist, s.hip, 0.9), sp, hipW),
        off(waist, sp, waW),
        off(along(s.chest, waist, 0.55), sp, shW * 0.72),
        off(s.chest, sp, shW),
        off(along(s.neckBase, s.chest, 0.34), sp, shW * 0.86),
        off(s.neckBase, sp, 13)
      ];
      layerTorso.add(make({ data: smooth(torsoPts, true, 0.42), fill: cloth, stroke: ink, strokeWidth: 3.2 }));

      // объём груди: короткая дуга под ключицей
      layerTorso.add(make({
        data: 'M' + r(off(along(s.neckBase, s.chest, 0.55), nL, shW * 0.55).x) + ' ' + r(off(along(s.neckBase, s.chest, 0.55), nL, shW * 0.55).y) +
          'C' + r(off(along(s.neckBase, s.chest, 0.9), nL, shW * 0.2).x) + ' ' + r(off(along(s.neckBase, s.chest, 0.9), nL, shW * 0.2).y + 26) +
          ' ' + r(off(along(s.neckBase, s.chest, 0.9), sp, shW * 0.2).x) + ' ' + r(off(along(s.neckBase, s.chest, 0.9), sp, shW * 0.2).y + 26) +
          ' ' + r(off(along(s.neckBase, s.chest, 0.55), sp, shW * 0.55).x) + ' ' + r(off(along(s.neckBase, s.chest, 0.55), sp, shW * 0.55).y),
        stroke: ink, strokeWidth: 2, opacity: 0.35, lineCap: 'round'
      }));

      /* --- передняя рука --- */
      layerTorso.add(make({
        data: smooth([
          { x: s.sL.x - 17, y: s.sL.y - 6 },
          { x: s.sL.x + 3, y: s.sL.y - 24 },
          { x: s.sL.x + 20, y: s.sL.y - 2 },
          { x: s.sL.x + 12, y: s.sL.y + 26 },
          { x: s.sL.x - 12, y: s.sL.y + 22 }
        ], true, 0.4), fill: cloth, stroke: ink, strokeWidth: 3
      }));
      layerTorso.add(make({ data: limb(s.sL, s.eL, 16, 13, 0.06), fill: cloth, stroke: ink, strokeWidth: 3 }));
      layerTorso.add(make({ data: limb(s.eL, s.handL, 14, 9, 0.04), fill: cloth, stroke: ink, strokeWidth: 3 }));
      layerTorso.add(handPath(s.eL, s.handL, 1.15, skin, ink));

      /* --- мутационные признаки (Том 3+) --- */
      if (o.mutant) drawMutant(layerTorso, s, o.mutant, skin, ink, 'body');

      /* --- передняя нога --- */
      layerTorso.add(make({ data: limb(s.hipL, s.kL, 27, 19, -0.04), fill: cloth, stroke: ink, strokeWidth: 3.2 }));
      layerTorso.add(make({ data: limb(s.kL, s.footL, 19, 13, -0.02), fill: cloth2, stroke: ink, strokeWidth: 3 }));
      layerTorso.add(make({
        data: smooth([
          { x: s.footL.x - 20, y: s.footL.y + 1 },
          { x: s.footL.x + 26, y: s.footL.y + 1 },
          { x: s.footL.x + 29, y: s.footL.y - 9 },
          { x: s.footL.x + 18, y: s.footL.y - 24 },
          { x: s.footL.x - 14, y: s.footL.y - 26 },
          { x: s.footL.x - 22, y: s.footL.y - 12 }
        ], true, 0.25),
        fill: '#0b1114', stroke: ink, strokeWidth: 2.2
      }));

      /* --- шея и голова --- */
      layerHead.add(make({
        data: limb(s.neckBase, { x: s.head.x, y: s.head.y + BONE.headR * 0.55 }, 15, 16, 0),
        fill: skin.base, stroke: ink, strokeWidth: 2.6
      }));

      // череп: полярный контур с челюстью
      const R = BONE.headR;
      const skull = [];
      const N = 16;
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + i / N * TAU;
        let rad = R;
        const down = Math.sin(a);           // >0 — нижняя половина
        if (down > 0) rad = R * (0.96 - 0.18 * down * down);  // сужение к подбородку
        if (Math.cos(a) > 0.4) rad *= 1.02; // затылок/лоб
        skull.push({ x: s.head.x + Math.cos(a) * rad * 0.92, y: s.head.y + Math.sin(a) * rad });
      }
      layerHead.add(make({ data: smooth(skull, true, 0.9), fill: skin.base, stroke: '#2a1a16', strokeWidth: 2.6 }));
      if (o.mutant) drawMutant(layerHead, s, o.mutant, skin, ink, 'head');
      // тень на скуле
      layerHead.add(make({
        data: 'M' + r(s.head.x - R * 0.5) + ' ' + r(s.head.y - R * 0.1) + 'C' + r(s.head.x - R * 0.2) + ' ' + r(s.head.y + R * 0.6) + ' ' + r(s.head.x + R * 0.4) + ' ' + r(s.head.y + R * 0.5) + ' ' + r(s.head.x + R * 0.6) + ' ' + r(s.head.y + R * 0.1),
        stroke: skin.shade, strokeWidth: 8, opacity: 0.35, lineCap: 'round'
      }));
      // контровой свет по контуру головы — фигура сразу «отрывается» от фона
      layerHead.add(make({
        data: smooth(skull.map(function (q) { return { x: q.x, y: q.y }; }), true, 0.9),
        stroke: o.rimLight || 'rgba(157,246,255,0.55)',
        strokeWidth: 3.2, opacity: 0.55
      }));

      // волосы / капюшон
      if (variant === 'hunter' || variant === 'guard' || variant === 'tech') {
        const hair = [];
        for (let i = 0; i < 12; i++) {
          const a = -Math.PI * 0.95 + i / 11 * Math.PI * 0.95;
          hair.push({ x: s.head.x + Math.cos(a) * R * 0.98, y: s.head.y + Math.sin(a) * R * 1.02 });
        }
        hair.push({ x: s.head.x - R * 0.05, y: s.head.y - R * 0.55 });
        layerHead.add(make({ data: smooth(hair, true, 0.7), fill: '#1a1a1e', stroke: ink, strokeWidth: 2 }));
      }
      // борода — только у Кракентауса
      if (variant === 'kraken') {
        // щетина по челюсти: ниже скул, лицо остаётся открытым
        layerHead.add(make({
          data: smooth([
            { x: s.head.x - R * 0.78, y: s.head.y + R * 0.24 },
            { x: s.head.x - R * 0.6, y: s.head.y + R * 0.78 },
            { x: s.head.x - R * 0.18, y: s.head.y + R * 1.04 },
            { x: s.head.x + R * 0.3, y: s.head.y + R * 1.0 },
            { x: s.head.x + R * 0.66, y: s.head.y + R * 0.7 },
            { x: s.head.x + R * 0.8, y: s.head.y + R * 0.2 },
            { x: s.head.x + R * 0.52, y: s.head.y + R * 0.44 },
            { x: s.head.x + R * 0.05, y: s.head.y + R * 0.56 },
            { x: s.head.x - R * 0.46, y: s.head.y + R * 0.42 }
          ], true, 0.6), fill: '#3b3733', stroke: ink, strokeWidth: 1.8, opacity: 0.95
        }));
        // залысина + седой вихрь
        layerHead.add(make({
          data: 'M' + r(s.head.x - R * 0.2) + ' ' + r(s.head.y - R * 0.92) +
            ' C' + r(s.head.x + R * 0.3) + ' ' + r(s.head.y - R * 1.0) + ' ' + r(s.head.x + R * 0.8) + ' ' + r(s.head.y - R * 0.6) +
            ' ' + r(s.head.x + R * 0.86) + ' ' + r(s.head.y - R * 0.1),
            stroke: '#6d6a66', strokeWidth: 5, opacity: 0.5, lineCap: 'round'
        }));
      }
      // собранные назад волосы доктора Вэй
      if (variant === 'wei' || variant === 'woman' || variant === 'doctor') {
        layerHead.add(make({
          data: smooth([
            { x: s.head.x - R * 1.02, y: s.head.y + R * 0.05 },
            { x: s.head.x - R * 0.86, y: s.head.y - R * 0.86 },
            { x: s.head.x - R * 0.1, y: s.head.y - R * 1.14 },
            { x: s.head.x + R * 0.66, y: s.head.y - R * 0.9 },
            { x: s.head.x + R * 0.6, y: s.head.y - R * 0.42 },
            { x: s.head.x - R * 0.05, y: s.head.y - R * 0.66 },
            { x: s.head.x - R * 0.6, y: s.head.y - R * 0.5 }
          ], true, 0.55), fill: '#241a1c', stroke: ink, strokeWidth: 2
        }));
        // узел волос сзади
        layerHead.add(make({
          data: smooth([
            { x: s.head.x - R * 1.16, y: s.head.y - R * 0.22 },
            { x: s.head.x - R * 0.9, y: s.head.y - R * 0.5 },
            { x: s.head.x - R * 0.76, y: s.head.y - R * 0.1 }
          ], true, 0.7), fill: '#1b1315', stroke: ink, strokeWidth: 1.8
        }));
      }
      if (variant === 'nullar') {
        // зачёсанные волосы + высокий воротник
        layerHead.add(make({
          data: smooth([
            { x: s.head.x - R * 1.02, y: s.head.y - R * 0.1 },
            { x: s.head.x - R * 0.7, y: s.head.y - R * 0.95 },
            { x: s.head.x + R * 0.1, y: s.head.y - R * 1.12 },
            { x: s.head.x + R * 0.75, y: s.head.y - R * 0.7 },
            { x: s.head.x + R * 0.5, y: s.head.y - R * 0.82 },
            { x: s.head.x - R * 0.3, y: s.head.y - R * 0.78 }
          ], true, 0.6), fill: '#15121f', stroke: ink, strokeWidth: 2
        }));
        layerHead.add(make({
          data: smooth([
            { x: s.neckBase.x - 30, y: s.neckBase.y + 8 },
            { x: s.neckBase.x - 27, y: s.neckBase.y - 22 },
            { x: s.neckBase.x + 2, y: s.neckBase.y - 16 },
            { x: s.neckBase.x + 27, y: s.neckBase.y - 18 },
            { x: s.neckBase.x + 30, y: s.neckBase.y + 10 }
          ], true, 0.5), fill: '#221a33', stroke: ink, strokeWidth: 2.4
        }));
      }

      if (variant === 'guard') {
        layerHead.add(make({
          data: 'M' + r(s.head.x - R * 1.04) + ' ' + r(s.head.y - R * 0.34) +
            ' C' + r(s.head.x - R * 0.9) + ' ' + r(s.head.y - R * 1.16) + ' ' + r(s.head.x + R * 0.6) + ' ' + r(s.head.y - R * 1.2) +
            ' ' + r(s.head.x + R * 0.82) + ' ' + r(s.head.y - R * 0.42) +
            ' L' + r(s.head.x + R * 1.16) + ' ' + r(s.head.y - R * 0.22) +
            ' L' + r(s.head.x + R * 0.5) + ' ' + r(s.head.y - R * 0.3) + ' Z',
          fill: '#131a1e', stroke: ink, strokeWidth: 2.2
        }));
      }

      layerHead.add(buildFace(s, faceParams(o.emotion || 'neutral', o.faceBlend), skin));
      if (o.mutant && o.mutant.eyeGlow) {
        const eg = o.mutant.eyeGlow;
        const eyeLayer = new (K().Group)();
        const R2 = BONE.headR;
        const fc = faceParams(o.emotion || 'neutral', o.faceBlend);
        const ex0 = s.head.x + R2 * 0.18;
        const ey0 = s.head.y - 2 + (-R2 * 0.06 + fc.browY * 0.35);
        [-1, 1].forEach(function (sgn) {
          const ex = ex0 + sgn * R2 * 0.36;
          // мягкое свечение вокруг глаза
          eyeLayer.add(new (K().Circle)({
            x: ex, y: ey0, radius: 17 + eg * 10,
            fillRadialGradientStartPoint: { x: 0, y: 0 },
            fillRadialGradientEndPoint: { x: 0, y: 0 },
            fillRadialGradientRadius: 17 + eg * 10,
            fillRadialGradientColorStops: [
              0, 'rgba(200,255,240,' + (0.3 * eg).toFixed(2) + ')',
              1, 'rgba(200,255,240,0)'
            ]
          }));
          // цветное ядро поверх зрачка
          eyeLayer.add(new (K().Circle)({
            x: ex + 1.6, y: ey0, radius: 3.2 + eg * 2.4,
            fill: o.mutant.glow || '#8affd6', opacity: 0.7 + eg * 0.25,
            shadowColor: o.mutant.glow || '#8affd6', shadowBlur: 22 + eg * 22
          }));
          // белая искра в центре
          eyeLayer.add(new (K().Circle)({
            x: ex + 1.6, y: ey0, radius: 1.2 + eg * 1.4,
            fill: '#ffffff', opacity: 0.95
          }));
        });
        eyeLayer.opacity(0.45 + eg * 0.55);
        layerHead.add(eyeLayer);
        nodes.eyeGlow = eyeLayer;
      }

      /* --- оружие --- */
      if (o.rifle) {
        const gun = new (K().Group)();
        const ang = o.aimAngle == null ? 0 : o.aimAngle;
        gun.position({ x: s.handL.x, y: s.handL.y });
        gun.rotation(ang * 180 / Math.PI);
        // приклад → ствол
        gun.add(make({
          data: 'M-64 -6 C-40 -14 -6 -12 22 -8 L22 6 C-8 10 -42 10 -64 6 Z',
          fill: '#1d252b', stroke: ink, strokeWidth: 2.4
        }));
        gun.add(make({ data: 'M22 -4 C60 -6 96 -5 122 -3 L122 3 C96 5 60 6 22 4 Z', fill: '#2b343b', stroke: ink, strokeWidth: 2 }));
        gun.add(make({ data: 'M40 -14 l30 0 l0 10 l-30 0 Z', fill: '#161d22', stroke: ink, strokeWidth: 1.8 })); // оптика
        gun.add(make({ data: 'M-10 4 C-4 26 -8 34 -18 34 L-26 30 C-16 26 -16 16 -18 4 Z', fill: '#161d22', stroke: ink, strokeWidth: 2 })); // магазин
        gun.add(make({ data: 'M-14 6 l8 0 l0 14 l-8 0 Z', fill: '#0d1216' }));
        gun.add(make({ data: 'M60 -8 l10 0 l0 16 l-10 0 Z', fill: '#0d1216', opacity: 0.9 })); // цевьё
        // кисть на цевье
        gun.add(make({
          data: smooth([
            { x: 34, y: -14 }, { x: 52, y: -16 }, { x: 54, y: 2 }, { x: 36, y: 4 }
          ], true, 0.7), fill: skin.base, stroke: ink, strokeWidth: 2.2
        }));
        layerTorso.add(gun);
        nodes.gun = gun;
        nodes.muzzle = { x: s.handL.x + Math.cos(ang) * 124, y: s.handL.y + Math.sin(ang) * 124 };
      } else {
        nodes.muzzle = { x: s.handL.x, y: s.handL.y };
      }

      nodes.s = s;
    }

    /* ------ позы ------ */
    const POSES = {
      stand: function () {
        return { lean: 0.02, crouch: 0, headTilt: 0, hipShift: 0,
          handL: { x: 62, y: -160 }, handR: { x: -58, y: -168 },
          footL: { x: 30, y: 0 }, footR: { x: -36, y: 0 } };
      },
      aim: function (target) {
        return { lean: 0.10, crouch: 0.18, headTilt: -0.06, hipShift: -6,
          handL: target || { x: 190, y: -300 },
          handR: { x: 40, y: -270 },
          footL: { x: 40, y: 0 }, footR: { x: -46, y: 0 } };
      },
      recoil: function () {
        return { lean: -0.12, crouch: 0.24, headTilt: -0.14, hipShift: -10,
          handL: { x: 176, y: -330 }, handR: { x: 26, y: -300 },
          footL: { x: 46, y: 0 }, footR: { x: -52, y: 0 } };
      },
      run: function () {
        return { lean: 0.28, crouch: 0.12, headTilt: -0.1, hipShift: 8,
          handL: { x: 70, y: -250 }, handR: { x: -78, y: -300 },
          footL: { x: 74, y: -8 }, footR: { x: -68, y: -40 } };
      },
      crouch: function () {
        return { lean: 0.24, crouch: 0.9, headTilt: -0.05, hipShift: 0,
          handL: { x: 80, y: -190 }, handR: { x: -20, y: -180 },
          footL: { x: 46, y: 0 }, footR: { x: -40, y: 6 } };
      },
      guard: function () {
        return { lean: -0.08, crouch: 0.3, headTilt: 0.05, hipShift: -4,
          handL: { x: 90, y: -330 }, handR: { x: 30, y: -350 },
          footL: { x: 48, y: 0 }, footR: { x: -52, y: 4 } };
      },
      hit: function () {
        return { lean: -0.34, crouch: 0.2, headTilt: -0.3, hipShift: -12,
          handL: { x: 130, y: -240 }, handR: { x: -60, y: -220 },
          footL: { x: 40, y: 0 }, footR: { x: -58, y: 8 } };
      },
      sit: function () {
        // таз опущен на сиденье, колени вперёд, стопы под коленями
        return { lean: 0.16, crouch: 0.3, drop: 96, headTilt: 0.02, hipShift: 4,
          handL: { x: 104, y: -206 }, handR: { x: 30, y: -196 },
          footL: { x: 74, y: -6 }, footR: { x: 30, y: 2 } };
      },
      lean: function () {
        return { lean: 0.2, crouch: 0.1, headTilt: 0.12, hipShift: 4,
          handL: { x: 70, y: -300 }, handR: { x: -46, y: -252 },
          footL: { x: 44, y: 0 }, footR: { x: -54, y: 0 } };
      },
      down: function () {
        return { lean: -0.7, crouch: 1, headTilt: -0.4, hipShift: -20,
          handL: { x: 120, y: -150 }, handR: { x: -40, y: -130 },
          footL: { x: 38, y: 0 }, footR: { x: -62, y: 26 } };
      }
    };

    let currentPose = 'stand';
    const api = {
      group: root,
      nodes: nodes,
      state: st,
      variant: variant,
      pose: function (name, arg) {
        const f = POSES[name] || POSES.stand;
        const v = f(arg);
        Object.keys(v).forEach(function (k) {
          if (v[k] !== null && v[k] !== undefined) st[k] = v[k];
        });
        if (name === 'aim' && arg) st.handL = arg;
        currentPose = name;
        draw();
        return api;
      },
      emotion: function (e) { o.emotion = e; draw(); return api; },
      /** мутация: {veins, tendrils, claw, glow, eyeGlow} либо null */
      mutant: function (m) { o.mutant = m; draw(); return api; },
      /** навести ствол на точку в координатах родителя (как рисуется страница) */
      aimAt: function (x, y) {
        let tx = x, ty = y;
        const par = root.getParent();
        if (par) {
          const abs = par.getAbsoluteTransform().point({ x: x, y: y });
          const loc = root.getAbsoluteTransform().copy().invert().point(abs);
          tx = loc.x; ty = loc.y;
        }
        // плечо в локальных координатах фигуры — примерно (0, -330)
        // плечо в локальных координатах фигуры — примерно (st.x, st.y - 330)
        let ang = Math.atan2(ty - (st.y - 330), tx - st.x);
        ang = Math.max(-1.0, Math.min(0.55, ang));
        st.handL = { x: Math.cos(ang) * 190, y: -300 + Math.sin(ang) * 190 };
        st.lean = 0.1 + Math.sin(ang) * 0.06;
        st.headTilt = ang * 0.25;
        o.aimAngle = ang;
        draw();
        return ang;
      },
      set: function (patch) { Object.assign(st, patch); draw(); return api; },
      redraw: function () { draw(); return api; },
      muzzle: function () {
        var m = nodes.muzzle;
        var t = root.getAbsoluteTransform().point({ x: m.x, y: m.y });
        var parent = root.getParent();
        if (parent) {
          var inv = parent.getAbsoluteTransform().copy().invert();
          return inv.point(t);
        }
        return t;
      },
      /** точка в координатах родителя (для пузырей и частиц) */
      point: function (lx, ly) {
        var t = root.getAbsoluteTransform().point({ x: lx, y: ly });
        var parent = root.getParent();
        if (parent) return parent.getAbsoluteTransform().copy().invert().point(t);
        return t;
      },
      torso: function () { return { x: st.x, y: st.y + BONE.pelvisY - 120 }; },
      bbox: function () { return root.getClientRect({ relativeTo: root.getParent() }); }
    };

    if (o.mutant) o.mutant = o.mutant;

    // стартовая поза
    if (o.pose) {
      const v = (POSES[o.pose] || POSES.stand)(o.poseArg);
      Object.assign(st, v);
    }
    draw();
    return api;
  }

  Cine.buildFigure = buildFigure;
  Cine.rig = { smooth: smooth, limb: limb, polar: polar, ik: ik, FACE: FACE, BONE: BONE, SKIN: SKIN, mutant: drawMutant };
  Cine.pathCount = function (node) {
    let n = 0;
    node.find('Path').forEach(function () { n++; });
    return n;
  };
  Cine.rectCount = function (node) {
    let n = 0;
    node.find('Rect').forEach(function () { n++; });
    return n;
  };
})(window);
