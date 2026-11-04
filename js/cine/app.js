/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  читалка
   Konva.Stage + HTML-слой пузырей, синхронизированный трансформом.
   Поверх сцены: канвас физики (Matter.js) и контейнер частиц (tsParticles).
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function K() { return global.Konva; }

  const W = 1200, H = 1800;

  const App = Cine.App = {
    stage: null, layer: null, textLayer: null, physCanvas: null, particles: null,
    page: null, zoom: 0.4, minZoom: 0.16, maxZoom: 2.4, pageIndex: 0,
    shakeBound: false, t: 0, lastTime: 0, autoFire: true
  };

  /* ------------------------------------------------------------- текст */
  const SLOT = {
    TL1: { x: 70, y: 90, w: 470 },
    TR1: { x: 660, y: 90, w: 470 },
    BL1: { x: 70, y: 1300, w: 470 },
    BR1: { x: 660, y: 1300, w: 470 },
    BL3: { x: 70, y: 1480, w: 620 },
    TL2: { x: 70, y: 300, w: 440 },
    TR2: { x: 690, y: 300, w: 440 }
  };

  function bubbleEl(b) {
    const s = SLOT[b.slot] || SLOT.TL1;
    const el = document.createElement('div');
    el.className = 'bubble bubble--' + (b.kind || 'speech') + (b.accent ? ' bubble--accent' : '');
    el.style.left = (s.x / W * 100) + '%';
    el.style.top = (s.y / H * 100) + '%';
    el.style.width = (s.w / W * 100) + '%';
    el.style.setProperty('--size', (28 / W * 100) + '%');
    const head = b.who
      ? '<div class="bubble__who">' + b.who + '</div>'
      : '';
    el.innerHTML = head + '<div class="bubble__text">' + b.text + '</div>' +
      (b.kind === 'speech' ? '<svg class="bubble__tail" viewBox="0 0 60 80" aria-hidden="true"><path d="M4 4 C22 18 34 44 30 76 C26 46 16 26 2 14 Z"/></svg>' : '');
    return el;
  }

  App.buildText = function (data) {
    const layer = App.textLayer;
    layer.innerHTML = '';
    (data.bubbles || []).forEach(function (b) {
      layer.appendChild(bubbleEl(b));
    });
  };

  /* ------------------------------------------------------------- камера */
  App.applyCamera = function () {
    const st = App.stage;
    const k = App.zoom;
    const sh = Cine.Shake.offset;
    const x = App.camX + sh.x, y = App.camY + sh.y;
    st.scale({ x: k, y: k });
    st.position({ x: x, y: y });
    App.textLayer.style.transform =
      'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
    App.syncFx();
  };

  App.syncFx = function () {
    const k = App.zoom, x = App.camX + Cine.Shake.offset.x, y = App.camY + Cine.Shake.offset.y;
    if (App.physCanvas) {
      App.physCanvas.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
    }
    if (App.particles) {
      App.particles.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
    }
  };

  App.fit = function () {
    const wrap = document.getElementById('stage-wrap');
    const r = wrap.getBoundingClientRect();
    const w = wrap.clientWidth || r.width || 900;
    const h = wrap.clientHeight || r.height || 700;
    if (App.stage && (App.stage.width() !== w || App.stage.height() !== h)) {
      App.stage.size({ width: w, height: h });
    }
    App.zoom = Math.min(w / W, h / H) * 0.96;
    App.camX = (w - W * App.zoom) / 2;
    App.camY = (h - H * App.zoom) / 2;
    App.applyCamera();
  };

  App.zoomAt = function (factor, px, py) {
    const wrap = document.getElementById('stage-wrap');
    const rect = wrap.getBoundingClientRect();
    const cw = rect.width || App.stage.width();
    const ch = rect.height || App.stage.height();
    const cx = (px == null ? cw / 2 : px);
    const cy = (py == null ? ch / 2 : py);
    const old = App.zoom;
    const next = Math.max(App.minZoom, Math.min(App.maxZoom, old * factor));
    const wx = (cx - App.camX) / old;
    const wy = (cy - App.camY) / old;
    App.zoom = next;
    App.camX = cx - wx * next;
    App.camY = cy - wy * next;
    App.applyCamera();
  };

  /* ------------------------------------------------------------- сцена */
  App.pages = function () {
    const all = []
      .concat(Cine.VOL1 || [])
      .concat(Cine.VOL2 || [])
      .concat(Cine.VOL3 || [])
      .concat(Cine.VOL4 || [])
      .concat(Cine.VOL5 || [])
      .concat(Cine.VOL6 || []);
    return all.length ? all : [Cine.buildChapter1Page5];
  };

  /** номер тома/страницы для HUD берём из данных самой страницы */

  App.loadPage = function (index) {
    const pages = App.pages();
    const i = Math.max(0, Math.min(pages.length - 1, index));
    const make = pages[i];
    if (!make) return null;
    const page = make(App.engine);
    App.page = page;
    App.layer.destroyChildren();
    App.layer.add(page.root);
    App.layer.draw();
    App.buildText(page.data || Cine.CH1_P5);
    Cine.FX.clear();
    killParticles(App.particles);
    App.pageIndex = i;
    App.pageT = 0;
    App.updateHud();
    return page;
  };

  App.goto = function (delta) {
    const n = App.pages().length;
    const next = Math.max(0, Math.min(n - 1, App.pageIndex + delta));
    if (next === App.pageIndex) return;
    App.loadPage(next);
    App.fit();
  };

  App.updateHud = function () {
    const page = App.page;
    if (!page) return;
    const d = page.data || {};
    const set = function (id, v) { const el = document.getElementById(id); if (el && v != null) el.textContent = v; };
    set('hud-vol', 'Том ' + (d.vol || 1));
    set('hud-page', 'Страница ' + (d.page || 1));
    set('hud-title', d.title || '');
    set('hud-place', d.place || '');
    const total = App.pages().length;
    set('hud-counter', (App.pageIndex + 1) + ' / ' + total);
    const bar = document.getElementById('progress');
    if (bar) bar.style.width = ((App.pageIndex + 1) / total * 100) + '%';
  };

  App.fire = function () {
    const page = App.page;
    if (!page || typeof page.fire !== 'function') {
      // у страницы нет выстрела — просто тряхнём камеру
      Cine.Shake.kick(10);
      return;
    }
    const hits = (page.data && page.data.hits) || Cine.CH1_P5.hits;
    App.shotIndex = ((App.shotIndex || 0) + 1) % hits.length;
    page.fire(App.engine, App.shotIndex);
    if (typeof page.hitGuard === 'function' && (App.shotIndex % 3) === 0) page.hitGuard(App.engine);
  };

  /* ------------------------------------------------------------- цикл */
  function frame(now) {
    const dt = Math.min(48, now - (App.lastTime || now));
    App.lastTime = now;
    App.t += dt;
    if (App.page) {
      Cine.FX.step(dt);
      Cine.FX.draw();
      if (typeof App.page.tick === 'function') App.page.tick(App.t);
      Cine.Shake.update(dt);
      if (Cine.Shake.amp > 0) App.applyCamera();
      else if (Cine.Shake.wasShaking) { Cine.Shake.wasShaking = false; App.applyCamera(); }
      Cine.Shake.wasShaking = Cine.Shake.amp > 0;
      // автоматическая очередь: раз в 1.6 с
      if (App.autoFire && typeof App.page.fire === 'function' && App.t - (App.lastShot || 0) > 1600) {
        App.lastShot = App.t;
        App.fire();
      }
    }
    requestAnimationFrame(frame);
  }

  /* --------------------------------------------------- «быстрая» тишина */
  // tsParticles v2: у каждого эффекта свой экземпляр; сносим через destroy()
  function killParticles(host) {
    if (host) host.innerHTML = '';
  }

  App.init = function () {
    const wrap = document.getElementById('stage-wrap');
    App.stage = new (K().Stage)({ container: 'stage', width: wrap.clientWidth, height: wrap.clientHeight });
    App.layer = new (K().Layer)();
    App.stage.add(App.layer);

    App.textLayer = document.getElementById('text-layer');
    App.particles = document.getElementById('particles');
    App.physCanvas = document.getElementById('physics');

    // физика: свой канвас, координаты страницы
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    App.physCanvas.width = W * dpr;
    App.physCanvas.height = H * dpr;
    App.physCanvas.style.width = W + 'px';
    App.physCanvas.style.height = H + 'px';
    const ctx = App.physCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    App.physCanvas.__dpr = dpr;
    Cine.FX.init(App.physCanvas, { x: 0, y: 0, w: W, h: H });

    App.engine = { matter: Cine.FX, particlesHost: App.particles, view: { x: 0, y: 0, scale: 1 } };

    if (!Cine.Particles.init()) {
      console.warn('[cine] tsParticles не найден — искры заменены Konva-вспышками');
    }
    App.loadPage(0);
    App.fit();

    // зум колесом
    wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      App.zoomAt(e.deltaY > 0 ? 0.9 : 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    // панорама
    let drag = null;
    wrap.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, cx: App.camX, cy: App.camY };
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', function (e) {
      if (!drag) return;
      App.camX = drag.cx + (e.clientX - drag.x);
      App.camY = drag.cy + (e.clientY - drag.y);
      App.applyCamera();
    });
    wrap.addEventListener('pointerup', function () { drag = null; });
    wrap.addEventListener('dblclick', App.fit);

    global.addEventListener('resize', App.fit);
    global.addEventListener('keydown', function (e) {
      if (e.code === 'Space') { e.preventDefault(); App.fire(); }
      if (e.key === 'f') App.fit();
      if (e.key === 'a') App.autoFire = !App.autoFire;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') App.goto(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') App.goto(-1);
      if (e.key === 'Home') App.goto(-App.pageIndex);
      if (e.key === 'End') App.goto(999);
    });

    const bind = function (id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    bind('btn-fire', function () { App.fire(); });
    bind('btn-fit', App.fit);
    bind('btn-prev', function () { App.goto(-1); });
    bind('btn-next', function () { App.goto(1); });
    // свайп
    let sx = 0, sy = 0, moved = false;
    wrap.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; moved = false; });
    wrap.addEventListener('pointerup', function (e) {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 80 && Math.abs(dy) < 60) App.goto(dx < 0 ? 1 : -1);
    });

    requestAnimationFrame(frame);
  };
})(window);
