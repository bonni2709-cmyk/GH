/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС — движок читалки
   • Konva.Stage: зум колесиком, перетаскивание, инерция, мини-карта
   • HTML-слой текста: transform: translate() scale() — синхронно со сценой
   ========================================================================== */
(function (global) {
  'use strict';
  const PG = global.PG;
  const W = PG.W, H = PG.H;

  const App = PG.App = {
    stage: null,
    layer: null,
    sceneLayer: null,
    pageGfx: null,
    page: 1,
    total: 0,
    zoom: 1,
    minZoom: 0.18,
    maxZoom: 2.6,
    textLayer: null,
    overlayLayer: null,
    meta: null,
    current: null,
    busy: false,
    blockEls: [],
    pxRatio: 1
  };

  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------------ поиск */
  function resolveVersion(t) {
    const total = App.data.length;
    const idx = (t - 1 + total) % total;
    return { vol: App.data[idx], t: idx + 1 };
  }

  App.pageData = function (t) {
    return App.volume.index[t];
  };

  /** переключение тома */
  App.setVolume = function (i) {
    i = Math.max(0, Math.min(App.volumes.length - 1, i));
    App.volumeIdx = i;
    App.volume = App.volumes[i];
    App.total = App.volume.pages.length;
    App.page = 1;
    App.volume.index = App.volume.index || {};
    App.volume.pages.forEach(function (p) {
      App.volume.index[p.n] = PG.compilePage(p);
    });
    buildIndex();
    $('#index-vol-title') && ($('#index-vol-title').textContent =
      'Том ' + String(App.volume.id).padStart(2, '0') + ' · ' + App.volume.title + ' — ' + App.volume.pages.length + ' страниц');
    App.go(1, { instant: true });
    document.body.classList.add('reading');
  };

  /* --------------------------------------------------------------- рендеринг */
  function buildScene(t) {
    const data = App.pageData(t);
    if (App.pageGfx) App.pageGfx.destroy();
    const g = PG.renderPage(App.volume, t);
    App.sceneLayer.add(g);
    App.pageGfx = g;
    return data;
  }

  function drawOverlay(t) {
    const data = App.pageData(t);
    if (!App.overlayLayer) {
      App.overlayLayer = new Konva.Layer({ listening: false });
      App.stage.add(App.overlayLayer);
    }
    const ov = App.overlayLayer;
    ov.destroyChildren();

    // Плашка номера страницы и места действия — часть мира, поэтому в Konva.
    const plate = PG.group();
    plate.add(PG.cutPlate(W - 470, H - 122, 388, 74, {
      fill: 'rgba(2,8,12,0.72)', stroke: PG.rgba(PG.C.teal, 0.28), cut: 12
    }));
    plate.add(PG.text(data.time || '', W - 448, H - 108, 17, PG.rgba(PG.C.teal, 0.75), { letterSpacing: 2 }));
    plate.add(PG.text(data.place || '', W - 448, H - 82, 18, PG.rgba(PG.C.bone, 0.6), { width: 350 }));
    ov.add(plate);

    const num = PG.group();
    num.add(PG.text(String(t).padStart(2, '0'), 64, H - 128, 54, PG.rgba(PG.C.ice, 0.16), {
      fontStyle: 'bold', letterSpacing: 2
    }));
    num.add(PG.rect(64, H - 66, 120, 3, PG.rgba(PG.C.teal, 0.4)));
    ov.add(num);
    ov.draw();
  }

  function buildText(data) {
    const layer = App.textLayer;
    layer.innerHTML = '';
    App.blockEls = [];
    const frag = document.createDocumentFragment();

    (data.blocks || []).forEach(function (b, i) {
      const el = document.createElement('div');
      el.className = 'tb tb--' + b.kind + (b.accent ? ' tb--accent' : '') + (b.muffled ? ' tb--muffled' : '');
      el.style.left = b.x + 'px';
      el.style.top = b.y + 'px';
      el.style.width = (b.w || 460) + 'px';
      el.style.setProperty('--size', (b.size || 26) + 'px');
      if (b.align === 'right') el.classList.add('tb--right');
      el.dataset.i = i;

      const inner = document.createElement('div');
      inner.className = 'tb__in';
      const head = document.createElement('div');
      head.className = 'tb__head';
      const k = document.createElement('span');
      k.className = 'tb__kind';
      k.textContent = kindLabel(b);
      head.appendChild(k);
      if (b.who) {
        const w = document.createElement('span');
        w.className = 'tb__who';
        w.textContent = b.who;
        head.appendChild(w);
      }
      const body = document.createElement('div');
      body.className = 'tb__text';
      body.textContent = b.text;
      inner.appendChild(head);
      inner.appendChild(body);
      el.appendChild(inner);

      const accent = whoColor(b);
      el.style.setProperty('--accent', accent);
      if (b.tailUp) el.classList.add('tb--tail-up');

      frag.appendChild(el);
      App.blockEls.push(el);
    });

    // сначала вставляем плашки в документ — чтобы измерить их реальную высоту
    layer.appendChild(frag);

    // второй проход: хвосты считаем по фактической высоте плашки
    (data.blocks || []).forEach(function (b, i) {
      const el = App.blockEls[i];
      const tipX = b.tail ? b.tail.x : b.tailX;
      const tipY = b.tail ? b.tail.y : b.tailY;
      if (!el || !(b.tail || b.tailUp) || tipX == null || tipY == null) return;

      const w = el.offsetWidth || b.w || 460;
      const h = el.offsetHeight || 120;
      const ax = w * (b.tail ? 0.3 : 0.5);
      const ay = tipY < b.y ? 1 : h - 1;
      const dx = tipX - b.x - ax;
      const dy = tipY - b.y - ay;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;

      const tail = document.createElement('i');
      tail.className = 'tb__tail';
      tail.style.left = ax + 'px';
      tail.style.top = ay + 'px';
      tail.style.width = Math.max(20, len - 8) + 'px';
      tail.style.transform = 'rotate(' + ang + 'deg)';
      el.appendChild(tail);

      const world = document.createElement('i');
      world.className = 'tb__world';
      world.style.left = tipX + 'px';
      world.style.top = tipY + 'px';
      world.innerHTML = '<b></b>';
      layer.appendChild(world);
      App.blockEls.push(world);
    });
  }

  function kindLabel(b) {
    if (b.kind === 'narration') return 'МИЗАНСЦЕНА';
    if (b.kind === 'speech') return b.muffled ? 'ЗА СТЕКЛОМ' : 'РЕПЛИКА';
    if (b.kind === 'radio') return 'РАДИО';
    if (b.kind === 'system') return 'СИСТЕМА';
    if (b.kind === 'thought') return 'МЫСЛЬ';
    return 'ТЕКСТ';
  }

  function whoColor(b) {
    if (b.kind === 'narration') return b.accent ? '#ffb347' : '#7fd8de';
    if (b.kind === 'system') return '#9ef01a';
    if (b.kind === 'radio') return '#ffe08a';
    const map = {
      'ХАНТЕР': '#7fe9ff',
      'КРАКЕНТАУС': '#8ff0c6',
      'НУЛЛАР': '#c6a8ff',
      'ЛИРА': '#79f2ff',
      'МЕТЕОР': '#ffa166',
      'МНЕМА': '#d9c8ff',
      'СИРИУС': '#d9fbff',
      'АРХИВАРИУС': '#bfe9ff',
      'БАСТИОН': '#ffcf8f',
      'КВАНТУМ': '#b9a6ff'
    };
    return map[b.who] || '#d9fbff';
  }

  /* ----------------------------------------------------------------- макет */
  function layout() {
    const stageWrap = $('#stage-wrap');
    let rect = stageWrap.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
      rect = { width: Math.max(320, global.innerWidth || 900), height: Math.max(320, global.innerHeight || 700) };
    }
    App.appBox = rect;
    App.stage.width(rect.width);
    App.stage.height(rect.height);
    App.textLayer.style.width = W + 'px';
    App.textLayer.style.height = H + 'px';
    App.pxRatio = Math.min(2, global.devicePixelRatio || 1);
    clampZoom();
    applyTransform();
    drawMini();
  }

  function clampZoom() {
    const rect = boxSize();
    const fit = Math.min(rect.width / W, rect.height / H);
    App.minZoom = Math.max(0.12, fit * 0.8);
    App.maxZoom = 2.6;
    App.zoom = PG.clamp(App.zoom, App.minZoom, App.maxZoom);
  }

  function applyTransform() {
    const box = App.appBox || App.stage.container().getBoundingClientRect();
    const sx = App.stage.scaleX();
    const x = App.stage.x();
    const y = App.stage.y();
    // Привязка экранных координат Konva к координатам страницы.
    App.textLayer.style.transformOrigin = '0 0';
    App.textLayer.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ')';
    // поля вокруг страницы — глубина сцены
    document.documentElement.style.setProperty('--zoom', sx.toFixed(3));
    App.textLayer.style.visibility = 'visible';
    // ярлыки положения
    const pz = $('#hud-zoom');
    if (pz) pz.textContent = Math.round(sx * 100) + '%';
    // параллакс-«погружение»: чем ближе, тем темнее фон вокруг
    const wrap = $('#stage-wrap');
    if (wrap) wrap.style.setProperty('--px', ((x + box.width / 2) / box.width * 100).toFixed(2) + '%');
  }

  /* ------------------------------------------------------------ навигация */
  App.go = function (t, opts) {
    opts = opts || {};
    // выход за границу страниц тома — это переход к соседнему тому
    if (t > App.total && App.volumeIdx < App.volumes.length - 1) {
      App.setVolume(App.volumeIdx + 1);
      App.go(1, { instant: opts.instant });
      return;
    }
    if (t < 1 && App.volumeIdx > 0) {
      var pv = App.volumeIdx - 1;
      App.setVolume(pv);
      App.go(App.total, { instant: opts.instant });
      return;
    }
    t = Math.max(1, Math.min(App.total, t));
    if (App.busy) {
      clearTimeout(App._busyTimer);
      App.busy = false;
    }
    App.busy = true;
    clearTimeout(App._busyTimer);

    const data = App.pageData(t);
    const doSwap = function () {
      App.page = t;
      buildScene(t);
      drawOverlay(t);
      buildText(data);
      App.current = data;
      App.layer.batchDraw();
      App.stage.batchDraw();
      layout();
      if (opts.keepZoom !== true) App.resetView(false);
      requestAnimationFrame(function () {
        document.body.classList.remove('is-turning');
        App.busy = false;
        updateUi();
      });
      App._busyTimer = setTimeout(function () {
        document.body.classList.remove('is-turning');
        App.busy = false;
      }, 800);
    };

    document.body.classList.add('is-turning');
    setTimeout(doSwap, opts.instant ? 0 : 150);
    updateUi();
  };

  function boxSize() {
    const r = App.stage.container().getBoundingClientRect();
    return {
      width: r.width > 20 ? r.width : Math.max(320, global.innerWidth || 900),
      height: r.height > 20 ? r.height : Math.max(320, global.innerHeight || 700)
    };
  }

  App.resetView = function (animate) {
    const rect = boxSize();
    const fit = Math.min(rect.width / W, rect.height / H) * 0.94;
    const target = { x: (rect.width - W * fit) / 2, y: (rect.height - H * fit) / 2, s: fit };
    App.textLayer.style.width = W + 'px';
    App.textLayer.style.height = H + 'px';
    if (!animate) {
      App.stage.scale({ x: target.s, y: target.s });
      App.stage.position({ x: target.x, y: target.y });
      applyTransform();
      drawMini();
      return;
    }
    const from = { x: App.stage.x(), y: App.stage.y(), s: App.stage.scaleX() };
    const t0 = performance.now();
    const dur = 320;
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      App.stage.scale({ x: PG.lerp(from.s, target.s, e), y: PG.lerp(from.s, target.s, e) });
      App.stage.position({ x: PG.lerp(from.x, target.x, e), y: PG.lerp(from.y, target.y, e) });
      applyTransform();
      drawMini();
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  };

  App.fit = function () {
    const rect = boxSize();
    const fit = Math.min(rect.width / W, rect.height / H) * 0.94;
    App.stage.scale({ x: fit, y: fit });
    App.stage.position({ x: (rect.width - W * fit) / 2, y: (rect.height - H * fit) / 2 });
    applyTransform();
    drawMini();
  };

  /* ------------------------------------------------------------- масштаб */
  function zoomBy(factor, origin) {
    const stage = App.stage;
    const oldScale = stage.scaleX();
    const pointer = origin || { x: stage.width() / 2, y: stage.height() / 2 };
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    const newScale = PG.clamp(oldScale * factor, App.minZoom, App.maxZoom);
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
    applyTransform();
    drawMini();
  }

  function zoomAbsolute(target) {
    const stage = App.stage;
    const oldScale = stage.scaleX();
    const pointer = { x: stage.width() / 2, y: stage.height() / 2 };
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    const newScale = PG.clamp(target, App.minZoom, App.maxZoom);
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    applyTransform();
    drawMini();
  }

  /* --------------------------------------------------------- мини-карта */
  function drawMini() {
    const cv = $('#mini-canvas');
    if (!cv) return;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const cssW = cv.clientWidth || 132;
    const cssH = cv.clientHeight || 198;
    if (cv.width !== Math.round(cssW * dpr)) {
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const k = Math.min(cssW / W, cssH / H);
    const ox = (cssW - W * k) / 2;
    const oy = (cssH - H * k) / 2;
    // кадр
    ctx.fillStyle = 'rgba(6,20,26,0.9)';
    ctx.fillRect(ox, oy, W * k, H * k);
    ctx.strokeStyle = 'rgba(57,224,210,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, W * k, H * k);
    // прогресс: пройденные страницы
    const total = App.total || 10;
    const done = (App.page - 1) / total;
    ctx.fillStyle = 'rgba(57,224,210,0.28)';
    ctx.fillRect(ox, oy, W * k, H * k * done);
    ctx.fillStyle = 'rgba(157,246,255,0.55)';
    ctx.fillRect(ox, oy + H * k * done, W * k, Math.max(1, 2 * k));
    // вьюпорт
    const s = App.stage.scaleX();
    const vx = (-App.stage.x() / s) * k + ox;
    const vy = (-App.stage.y() / s) * k + oy;
    const vw = (App.stage.width() / s) * k;
    const vh = (App.stage.height() / s) * k;
    ctx.strokeStyle = 'rgba(157,246,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = 'rgba(57,224,210,0.10)';
    ctx.fillRect(vx, vy, vw, vh);
  }

  /* ------------------------------------------------------------------ UI */
  function updateUi() {
    const pct = ((App.page - 1) / (App.total - 1)) * 100;
    const bar = $('#progress-bar');
    if (bar) bar.style.width = pct + '%';
    const cnt = $('#hud-page');
    if (cnt) cnt.innerHTML = '<b>' + String(App.page).padStart(2, '0') + '</b> / ' + App.total;
    const ttl = $('#hud-place');
    if (ttl && App.current) ttl.textContent = App.current.place || '';
    const mp = $('#mini-pct');
    if (mp) mp.textContent = String(App.page).padStart(2, '0');
    const pl = $('#hud-vol');
    if (pl) {
      pl.textContent = 'ТОМ ' + String(App.volume.id).padStart(2, '0') + ' · ' + App.volume.title.toUpperCase();
    }
    const ttlTop = $('#hud-vol-name');
    if (ttlTop) ttlTop.textContent = 'ТОМ ' + String(App.volume.id).padStart(2, '0') + ' · ' + App.volume.title;
    document.title = 'ПРОЕКТ-ГЕНЕЗИС · Том ' + String(App.volume.id).padStart(2, '0') +
      ' «' + App.volume.title + '» · стр. ' + App.page;
    // маркеры страниц под текущий том
    const marks = $('#page-marks');
    if (marks && marks.childElementCount !== App.total) {
      marks.innerHTML = '';
      for (let i = 1; i <= App.total; i++) {
        const b = document.createElement('button');
        b.className = 'js-jump';
        b.dataset.page = i;
        b.textContent = String(i).padStart(2, '0');
        b.addEventListener('click', function () { App.go(Number(b.dataset.page)); });
        marks.appendChild(b);
      }
    }
    $$('.js-jump').forEach(function (el) {
      el.classList.toggle('is-active', Number(el.dataset.page) === App.page);
    });
    $$('#index-volumes li').forEach(function (li, i) {
      li.classList.toggle('is-current', i === App.volumeIdx);
    });
  }

  function buildVolumes() {
    const wrap = $('#index-volumes');
    if (!wrap || !App.volumes) return;
    wrap.innerHTML = '';
    App.volumes.forEach(function (v, i) {
      const li = document.createElement('li');
      li.className = 'is-plan';
      li.innerHTML = '<b>Т' + String(v.id).padStart(2, '0') + '</b>' +
        '<span>' + v.title + '</span>' +
        '<em>' + (v.pages ? v.pages.length : 0) + ' стр.</em>';
      li.addEventListener('click', function () {
        closeIndex();
        App.setVolume(i);
      });
      wrap.appendChild(li);
    });
  }

  function buildIndex() {
    buildVolumes();
    const wrap = $('#index-pages');
    if (!wrap) return;
    wrap.innerHTML = '';
    App.volume.pages.forEach(function (p) {
      const b = document.createElement('button');
      b.className = 'idx-page js-jump';
      b.dataset.page = p.n;
      b.innerHTML = '<span class="idx-page__n">' + String(p.n).padStart(2, '0') + '</span>' +
        '<span class="idx-page__p">' + p.place + '</span>' +
        '<span class="idx-page__t">' + (p.time || '') + '</span>';
      b.addEventListener('click', function () {
        closeIndex();
        App.go(p.n);
      });
      wrap.appendChild(b);
    });
  }

  function openIndex() {
    document.body.classList.add('index-open');
    $('#index') && $('#index').setAttribute('aria-hidden', 'false');
  }
  function closeIndex() {
    document.body.classList.remove('index-open');
    $('#index') && $('#index').setAttribute('aria-hidden', 'true');
  }

  /* ------------------------------------------------------------- события */
  function bind() {
    const stage = App.stage;
    const container = stage.container();

    // зум колесиком
    container.addEventListener('wheel', function (e) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      zoomBy(e.deltaY > 0 ? 0.9 : 1.1, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    }, { passive: false });

    // перетаскивание (мышь)
    let dragging = false, last = null;
    let vx = 0, vy = 0, lastT = 0;

    container.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      lastT = performance.now();
      vx = 0; vy = 0;
      container.classList.add('is-grabbing');
      container.setPointerCapture && container.setPointerCapture(e.pointerId);
    });

    container.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      stage.position({ x: stage.x() + dx, y: stage.y() + dy });
      const dt = Math.max(1, now - lastT);
      vx = dx / dt; vy = dy / dt;
      lastT = now;
      applyTransform();
      drawMini();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      container.classList.remove('is-grabbing');
      // инерция
      let ivx = vx * 16, ivy = vy * 16;
      let raf;
      const decay = function () {
        ivx *= 0.92; ivy *= 0.92;
        if (Math.abs(ivx) < 0.4 && Math.abs(ivy) < 0.4) { cancelAnimationFrame(raf); return; }
        stage.position({ x: stage.x() + ivx, y: stage.y() + ivy });
        applyTransform();
        drawMini();
        raf = requestAnimationFrame(decay);
      };
      if (Math.abs(ivx) > 2 || Math.abs(ivy) > 2) decay();
    }
    container.addEventListener('pointerup', endDrag);
    container.addEventListener('pointercancel', endDrag);
    container.addEventListener('pointerleave', function (e) {
      if (dragging && !e.buttons) endDrag(e);
    });

    // двойной клик — сброс
    container.addEventListener('dblclick', function () { App.resetView(true); });

    // клавиатура
    global.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault(); App.go(App.page + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault(); App.go(App.page - 1);
      } else if (e.key === 'Escape') {
        closeIndex();
        document.body.classList.remove('ui-hidden');
      } else if (e.key === '+' || e.key === '=') {
        zoomBy(1.15);
      } else if (e.key === '-') {
        zoomBy(0.87);
      } else if (e.key === '0') {
        App.fit();
      } else if (e.key.toLowerCase() === 'h') {
        document.body.classList.toggle('ui-hidden');
      } else if (e.key.toLowerCase() === 'i') {
        document.body.classList.contains('index-open') ? closeIndex() : openIndex();
      }
    });

    // кнопки
    $('#btn-next') && $('#btn-next').addEventListener('click', function () { App.go(App.page + 1); });
    $('#btn-prev') && $('#btn-prev').addEventListener('click', function () { App.go(App.page - 1); });
    $('#btn-fit') && $('#btn-fit').addEventListener('click', function () { App.resetView(true); });
    $('#btn-zoom-in') && $('#btn-zoom-in').addEventListener('click', function () { zoomBy(1.2); });
    $('#btn-zoom-out') && $('#btn-zoom-out').addEventListener('click', function () { zoomBy(0.83); });
    $('#btn-index') && $('#btn-index').addEventListener('click', openIndex);
    $('#btn-ui') && $('#btn-ui').addEventListener('click', function () {
      document.body.classList.toggle('ui-hidden');
    });
    $('#index-close') && $('#index-close').addEventListener('click', closeIndex);
    $('#index') && $('#index').addEventListener('click', function (e) {
      if (e.target.id === 'index') closeIndex();
    });
    $$('.js-jump').forEach(function (el) {
      if (el.closest('#index-pages')) return;
      el.addEventListener('click', function () { App.go(Number(el.dataset.page)); });
    });

    // мини-карта: клик = перейти
    const mini = $('#mini-canvas');
    if (mini) {
      mini.addEventListener('click', function (e) {
        const r = mini.getBoundingClientRect();
        const k = Math.min(r.width / W, r.height / H);
        const ox = (r.width - W * k) / 2;
        const oy = (r.height - H * k) / 2;
        const px = (e.clientX - r.left - ox) / k;
        const py = (e.clientY - r.top - oy) / k;
        const s = App.stage.scaleX();
        App.stage.position({ x: App.stage.width() / 2 - px * s, y: App.stage.height() / 2 - py * s });
        applyTransform();
        drawMini();
      });
    }

    // ресайз
    let rt = null;
    global.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        const old = App.stage.scaleX();
        layout();
        App.fitScale && App.fitScale();
        applyTransform();
        drawMini();
      }, 120);
    });

    // стрелки-оверлеи по краям
    $$('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        App.go(App.page + (el.dataset.nav === 'next' ? 1 : -1));
      });
    });
  }

  /* ----------------------------------------------------------------- старт */
  App.init = function () {
    App.volumes = PG.compileVolumes();
    App.volumeIdx = 0;
    App.volume = App.volumes[0];
    App.data = PG.comicData;
    App.total = App.volume.pages.length;

    const wrap = $('#stage-wrap');
    App.stage = new Konva.Stage({
      container: 'stage',
      width: wrap.clientWidth,
      height: wrap.clientHeight,
      draggable: false
    });
    App.layer = new Konva.Layer({ listening: false });
    App.stage.add(App.layer);
    App.sceneLayer = new Konva.Group();
    App.layer.add(App.sceneLayer);

    App.textLayer = $('#text-layer');
    App.pxRatio = Math.min(2, global.devicePixelRatio || 1);

    // титульный экран
    const coverScene = PG.S.cover();
    App.sceneLayer.add(coverScene);
    App.pageGfx = coverScene;
    App.layer.draw();
    drawCover();
    App.page = 1;
    App.current = App.pageData(1);
    updateUi();
    buildIndex();
    bind();
    layout();
    App.fit();

    // пересчёт после полной загрузки ресурсов: контейнер может «дорасти»
    global.addEventListener('load', function () {
      layout();
      App.fit();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { App.fit(); });
    }

    // приветственный HUD
    setTimeout(function () { document.body.classList.add('ready'); }, 300);
  };

  function drawCover() {
    const layer = App.textLayer;
    const d = PG.coverData;
    layer.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'cover';
    el.innerHTML =
      '<div class="cover__kicker">' + d.kicker + '</div>' +
      '<h1 class="cover__title">' + d.title.replace('\n', '<br>') + '</h1>' +
      '<div class="cover__vol"><span>' + d.volume + '</span>' + d.volumeName + '</div>' +
      '<div class="cover__tag">' + d.tagline + '</div>' +
      '<div class="cover__meta">' + d.meta + '</div>' +
      '<button class="cover__cta" id="cover-start">' + d.cta + '<i></i></button>';
    layer.appendChild(el);
    const start = $('#cover-start');
    start && start.addEventListener('click', function () {
      document.body.classList.add('reading');
      App.go(1, { instant: true });
    });
  }

})(window);
