/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — компилятор страниц
   Компактная запись страницы → готовые блоки текста с координатами.
   Автор страницы указывает слот (PG.SLOTS) и, при желании, индекс персонажа
   в cast — точка-маркер реплики встанет ему к голове сама.
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;

  PG.compilePage = function (page) {
    // ручные страницы (нарисованные вручную сцены) уже содержат блоки
    if (page.blocks && !page.text) {
      return Object.assign({}, page, { spec: page });
    }
    const framedPage = PG.framePage(page);
    const blocks = (page.text || []).map(function (t) {
      const slot = PG.SLOTS[t.slot] || PG.SLOTS.TL1;
      const b = {
        kind: t.kind || (t.who ? 'speech' : 'narration'),
        who: t.who,
        text: t.text,
        x: t.x != null ? t.x : slot.x,
        y: t.y != null ? t.y : slot.y,
        w: t.w != null ? t.w : slot.w,
        size: t.size != null ? t.size : slot.size,
        align: t.align,
        accent: t.accent,
        muffled: t.muffled,
        tailUp: t.tailUp
      };
      if (t.tail != null) {
        if (typeof t.tail === 'number' && framedPage.cast && framedPage.cast[t.tail]) {
          const hp = PG.headPoint(framedPage.cast[t.tail]);
          b.tail = { x: hp.x, y: hp.y };
        } else if (typeof t.tail === 'object') {
          b.tail = t.tail;
        }
        if (b.tail && b.tail.y < b.y) b.tailUp = true;
      }
      return b;
    });

    return {
      n: page.n,
      scene: page.scene,
      set: page.set,
      place: page.place,
      time: page.time,
      spec: framedPage,
      blocks: blocks
    };
  };

  /** собирает все тома: проставляет номера страниц и компилирует тексты */
  PG.compileVolumes = function () {
    (PG.volumes || []).forEach(function (vol, vi) {
      vol.id = vi + 1;
      (vol.pages || []).forEach(function (p, pi) {
        p.n = pi + 1;
        p.volume = vi + 1;
      });
      vol.index = {};
      vol.pages.forEach(function (p) {
        vol.index[p.n] = PG.compilePage(p);
      });
    });
    return PG.volumes || [];
  };

  /** отрисовка одной страницы: спец-кадр или собранная сцена */
  PG.renderPage = function (vol, n) {
    const raw = vol.pages[n - 1];
    if (!raw) return PG.group();
    if (raw.scene && PG.S[raw.scene]) {
      return PG.S[raw.scene]();
    }
    const compiled = vol.index && vol.index[n];
    return PG.shot(compiled && compiled.spec ? compiled.spec : raw);
  };

  /* ---------------------------------------------------------- компоновка
     Фигура человека рисуется ~370 px при scale 1, а страница — 1200×1800.
     Чтобы кадр не выглядел пустым, сцена масштабируется и садится по ногам
     персонажей: крупный план — крупно, общий — мельче.
     ==================================================================== */
  PG.GROUND = 1330;          // «линия пола» в координатах страницы
  PG.FIG_BASE = 1.55;        // базовый масштаб фигуры

  PG.framePage = function (raw) {
    const cast = raw.cast || [];
    if (!cast.length) return raw;

    // средний «рост» персонажей на странице
    let sum = 0;
    cast.forEach(function (c) { sum += (c.s == null ? 1 : c.s); });
    const avg = sum / cast.length;
    const k = PG.FIG_BASE * (raw.scaleHint || 1);

    const cam = Object.assign({ x: 600, y: 900, z: 1 }, raw.cam || {});
    // точка, вокруг которой «собирается» сцена: ноги + голова
    let gx = 0, gy = 0;
    cast.forEach(function (c) {
      gx += c.x;
      gy += c.y - 150 * (c.s == null ? 1 : c.s) * k;
    });
    gx /= cast.length;
    gy /= cast.length;

    const framed = Object.assign({}, raw, {
      cam: {
        x: cam.x * 0.5 + gx * 0.5,
        y: cam.y * 0.35 + gy * 0.65,
        z: (cam.z || 1) * k
      },
      cast: cast.map(function (c) {
        const s = (c.s == null ? 1 : c.s);
        // «пол» кадра: рост фигуры ограничен, чтобы ноги не уезжали
        const y = Math.min(c.y, PG.GROUND + (s - avg) * 60);
        return Object.assign({}, c, {
          x: 600 + (c.x - 600) * 0.92,
          y: y,
          s: s * k
        });
      }),
      prop: (raw.prop || []).map(function (p) {
        return Object.assign({}, p, { s: (p.s == null ? 1 : p.s) * k });
      }),
      _framed: true
    });
    return framed;
  };

})(window);
