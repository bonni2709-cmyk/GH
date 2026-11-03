/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — титульный лист тома
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const C = PG.C;
  const W = PG.W, H = PG.H;
  const S = PG.S;

  S.cover = function () {
    const g = PG.group();
    g.add(PG.grect(0, 0, W, H, [0, '#03151b', 0.45, '#020c11', 1, '#010507']));
    g.add(PG.glow(600, 470, 620, C.teal, 0.16));

    // сфера Генезиса
    g.add(PG.circle(600, 470, 300, '#062029'));
    g.add(PG.circle(600, 470, 300, undefined, PG.radial(300, [
      0, 'rgba(57,224,210,0.30)', 0.55, 'rgba(10,50,60,0.55)', 1, 'rgba(2,8,12,0.95)'
    ])));
    g.add(PG.circle(600, 470, 300, undefined, { stroke: PG.rgba(C.teal, 0.5), strokeWidth: 3 }));
    g.add(PG.circle(600, 470, 262, undefined, { stroke: PG.rgba(C.teal, 0.18), strokeWidth: 1.6 }));
    // меридианы
    [-190, -120, -55, 55, 120, 190].forEach(function (dx) {
      g.add(PG.ellipse(600, 470, Math.abs(dx) + 8, 262, undefined, {
        stroke: PG.rgba(C.teal, 0.15), strokeWidth: 1.4
      }));
    });
    [80, 170].forEach(function (dy) {
      g.add(PG.ellipse(600, 470, 262, dy, undefined, { stroke: PG.rgba(C.teal, 0.13), strokeWidth: 1.4 }));
    });
    // ядро
    g.add(PG.circle(600, 470, 78, undefined, PG.radial(78, [0, 'rgba(255,255,255,0.95)', 0.35, 'rgba(157,246,255,0.5)', 1, 'rgba(57,224,210,0)'])));
    g.add(PG.burst(600, 470, 150, 18, C.ice, 0.4));
    // щупальца по сфере
    for (let i = 0; i < 6; i++) {
      const a = -0.9 + i * 0.36;
      const x0 = 600 + Math.cos(a) * 250;
      const y0 = 470 + Math.sin(a) * 250;
      g.add(PG.path('M' + x0 + ' ' + y0 + ' C' + (x0 + 90) + ' ' + (y0 + 60) + ' ' + (x0 + 60) + ' ' + (y0 + 190) + ' ' + (x0 + 150) + ' ' + (y0 + 250), PG.rgba(C.teal, 0.45), 10));
    }
    // кольцо-орбита
    g.add(PG.ellipse(600, 760, 520, 150, undefined, { stroke: PG.rgba(C.steel3, 0.7), strokeWidth: 10 }));
    g.add(PG.ellipse(600, 760, 520, 150, undefined, { stroke: PG.rgba(C.teal, 0.25), strokeWidth: 2 }));
    // схема станции
    g.add(PG.line([0, 1240, W, 1240], PG.rgba(C.steel3, 0.3), 2));
    g.add(PG.waveform(0, 1330, W, 130, PG.rgba(C.teal, 0.25), 77, 60));
    g.add(PG.cracks({ x: 0, y: 900, w: W, h: 420, lines: 7, color: C.steel3, alpha: 0.16, seed: 12, width: 2 }));
    g.add(PG.speckles({ x0: 0, y0: 0, x1: W, y1: H, count: 120, seed: 66, color: C.cyan, minA: 0.03, maxA: 0.3, minR: 0.6, maxR: 2.4 }));
    g.add(PG.bubbles(600, 1240, 16, { height: 520, spread: 520, maxR: 7, seed: 3 }));
    g.add(PG.grid({ x: 60, y: 60, w: W - 120, h: H - 120, step: 120, alpha: 0.05 }));
    g.add(PG.vignette(1.0));
    S.frame(g);
    return g;
  };

  PG.coverData = {
    kicker: 'МРАЧНЫЙ ПОДВОДНЫЙ АТОМНЫЙ ТЕХНО-ТРИЛЛЕР',
    title: 'ПРОЕКТ\nГЕНЕЗИС',
    volume: 'ТОМ 01',
    volumeName: 'ДНО',
    tagline: 'На дне Марианской впадины никто не слышит, как ты врёшь.',
    meta: '10 томов · 200 страниц · цикл завершён',
    cta: 'ОТКРЫТЬ ТОМ 01'
  };

})(window);
