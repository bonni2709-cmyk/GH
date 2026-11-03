/* ============================================================================
   ПРОЕКТ-ГЕНЕЗИС · КИНО  —  физика и частицы
   • matter-js   — обломки бетона из стен и пола, отскоки, трение
   • tsParticles — искры, вспышки выстрела, брызги, капли крови
   • screen shake — сдвиг Konva.Stage по X/Y с затуханием
   Все три слоя живут вне Konva-сцены, но синхронизированы с её камерой.
   ========================================================================== */
(function (global) {
  'use strict';
  const Cine = global.Cine = global.Cine || {};
  function M() { return global.Matter; }
  function K() { return global.Konva; }

  /* ------------------------------------------------------------ физика */
  Cine.FX = {
    engine: null,
    world: null,
    bodies: [],
    layer: null,
    canvas: null,
    ctx: null,
    bounds: null,
    started: false,
    last: 0,

    init: function (canvasEl, opts) {
      const Matter = M();
      if (!Matter) return null;
      this.canvas = canvasEl;
      // canvas отдан с scale(dpr) — рисуем в логических координатах страницы
      this.dpr = canvasEl.__dpr || 1;
      this.ctx = canvasEl.getContext('2d');
      this.bounds = opts || { x: 0, y: 0, w: 1200, h: 1800 };
      this.engine = Matter.Engine.create({ gravity: { x: 0, y: 1.6, scale: 0.0014 } });
      this.engine.positionIterations = 6;
      this.engine.velocityIterations = 4;
      this.world = this.engine.world;

      const b = this.bounds;
      const wallOpt = { isStatic: true, restitution: 0.5, friction: 0.9 };   // Matter 0.20 не любит render в опциях
      Matter.Composite.add(this.world, [
        Matter.Bodies.rectangle(b.x + b.w / 2, b.y + b.h + 60, b.w * 3, 120, wallOpt),          // пол
        Matter.Bodies.rectangle(b.x - 80, b.y + b.h / 2, 120, b.h * 3, wallOpt),                 // левая стена
        Matter.Bodies.rectangle(b.x + b.w + 80, b.y + b.h / 2, 120, b.h * 3, wallOpt)            // правая стена
      ]);
      this.started = true;
      return this;
    },

    /** осколок: полигон с 5–7 зубцами, вращается и отскакивает */
    shard: function (x, y, r, opts) {
      const Matter = M();
      if (!Matter) return null;
      const o = opts || {};
      const n = 5 + Math.floor(Math.random() * 3);
      const raw = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const rr = r * (0.55 + Math.random() * 0.75);
        raw.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
      }
      // осколок всегда выпуклый — тогда Matter обходится без poly-decomp
      const hull = Matter.Vertices.hull(raw);
      const body = Matter.Bodies.polygon(x, y, Math.max(3, hull.length), r, {
        restitution: o.restitution == null ? 0.55 : o.restitution,
        friction: 0.6,
        frictionAir: 0.0075,
        density: 0.0022,
        angle: Math.random() * Math.PI
      });
      Matter.Body.setVertices(body, hull);
      Matter.Body.setPosition(body, { x: x, y: y });
      Matter.Body.setVelocity(body, {
        x: (o.vx == null ? (Math.random() - 0.5) * 7 : o.vx) + (o.addVx || 0),
        y: (o.vy == null ? -2 - Math.random() * 5 : o.vy)
      });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.22);
      Matter.Composite.add(this.world, body);
      const item = { body: body, r: r, color: o.color || '#3b4a52', edge: o.edge || '#8fa7b0', kind: 'shard', life: 0 };
      this.bodies.push(item);
      return item;
    },

    /** обломок из стены: направленный конус */
    burst: function (x, y, opts) {
      const o = opts || {};
      const n = o.n || 9;
      const dir = o.dir == null ? Math.PI : o.dir;
      const power = (o.power || 16) * 0.28;   // масштаб сцены 1200×1800
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * (o.spread || 1.1);
        const sp = power * (0.45 + Math.random() * 0.9);
        const lift = (o.up || 0) * (0.4 + Math.random());
        out.push(this.shard(
          x + (Math.random() - 0.5) * 26,
          y + (Math.random() - 0.5) * 26,
          5 + Math.random() * (o.size || 16),
          { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2 - lift, color: o.color, edge: o.edge, restitution: o.restitution }
        ));
      }
      return out;
    },

    step: function (dt) {
      const Matter = M();
      if (!Matter || !this.engine) return;
      Matter.Engine.update(this.engine, dt || 16.6);
      // чистим улетевшее за кадр
      const b = this.bounds;
      for (let i = this.bodies.length - 1; i >= 0; i--) {
        const it = this.bodies[i];
        const p = it.body.position;
        if (p.y > b.y + b.h + 400 || p.x < b.x - 700 || p.x > b.x + b.w + 700 || it.life > 900) {
          Matter.Composite.remove(this.world, it.body);
          this.bodies.splice(i, 1);
        } else {
          it.life++;
        }
      }
    },

    draw: function () {
      const ctx = this.ctx;
      if (!ctx) return;
      const b = this.bounds || { x: 0, y: 0, w: 1200, h: 1800 };
      ctx.clearRect(0, 0, b.w, b.h);
      for (let i = 0; i < this.bodies.length; i++) {
        const it = this.bodies[i];
        const body = it.body;
        // отсечение: за кадром не рисуем (иначе полотно растёт и тормозит)
        if (body.position.x < b.x - 120 || body.position.x > b.x + b.w + 120) continue;
        const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
        parts.forEach(function (part) {
          ctx.save();
          ctx.translate(part.position.x, part.position.y);
          ctx.rotate(part.angle);
          ctx.beginPath();
          part.vertices.forEach(function (v, k) {
            const lx = v.x - part.position.x;
            const ly = v.y - part.position.y;
            if (k === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
          });
          ctx.closePath();
          ctx.fillStyle = it.color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = it.edge;
          ctx.stroke();
          // скол — светлая грань
          ctx.beginPath();
          const v0 = part.vertices[0];
          ctx.moveTo(v0.x - part.position.x, v0.y - part.position.y);
          ctx.lineTo((part.vertices[1].x - part.position.x) * 0.6, (part.vertices[1].y - part.position.y) * 0.6);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        });
      }
    },

    clear: function () {
      const Matter = M();
      if (!Matter || !this.world) return;
      this.bodies.forEach(function (it) { Matter.Composite.remove(Cine.FX.world, it.body); });
      this.bodies = [];
      if (this.ctx) this.ctx.clearRect(0, 0, (this.bounds || {}).w || 1200, (this.bounds || {}).h || 1800);
    }
  };

  /* tsParticles: в сборке v2 глобал появляется только в браузере (window),
     поэтому берём его через window/globalThis, а не из замыкания. */
  function tsLib() {
    return global.tsParticles || (typeof window !== 'undefined' ? window.tsParticles : null) || null;
  }

  /* ---------------------------------------------------------- частицы */
  Cine.Particles = {
    ready: false,
    init: function () {
      const tsP = tsLib();
      if (!tsP) return false;
      if (!this.ready) {
        tsP.init && tsP.init();
        this.ready = true;
      }
      return true;
    },

    /** искры от попадания / рикошета */
    sparks: function (host, x, y, color, count) {
      const tsP = tsLib();
      if (!tsP || !tsP.create) return null;
      const id = 'p-' + Math.random().toString(36).slice(2, 9);
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      host.appendChild(el);
      tsP.create(id, {
        fullScreen: { enable: false },
        detectRetina: true,
        fpsLimit: 90,
        particles: {
          number: { value: count || 46, density: { enable: false } },
          color: { value: color || '#ffd166' },
          shape: { type: 'line', options: { line: { enable: true, width: 2.2 } } },
          stroke: { width: 2, color: { value: color || '#ffd166' } },
          opacity: { value: { min: 0.35, max: 1 }, animation: { enable: true, speed: 1.6, startValue: 'max', destroy: 'min' } },
          size: { value: { min: 3, max: 16 } },
          move: {
            enable: true,
            speed: { min: 6, max: 26 },
            direction: 'none',
            random: true,
            straight: false,
            outModes: { default: 'destroy' },
            gravity: { enable: true, acceleration: 40, maxSpeed: 40 }
          },
          life: { duration: { value: 0.55 }, count: 1 }
        },
        emitters: [{
          position: { x: x, y: y },
          life: { duration: 0.1, count: 1 },
          particles: { move: { speed: { min: 8, max: 30 } } }
        }]
      });
      setTimeout(function () {
        if (tsP.dom && tsP.dom()) tsP.dom().item(id) && tsP.dom().item(id).destroy();
        el.remove();
      }, 900);
      return id;
    },

    /** дульная вспышка: короткий конус по оси ствола */
    muzzle: function (host, x, y, angle, color) {
      const tsP = tsLib();
      if (!tsP || !tsP.create) return null;
      const id = 'm-' + Math.random().toString(36).slice(2, 9);
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      host.appendChild(el);
      const deg = angle * 180 / Math.PI;
      tsP.create(id, {
        fullScreen: { enable: false },
        detectRetina: true,
        fpsLimit: 95,
        particles: {
          number: { value: 34, density: { enable: false } },
          color: { value: [color || '#fff2b0', '#ffb347', '#ffffff'] },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.1, max: 0.95 }, animation: { enable: true, speed: 3, startValue: 'max', destroy: 'min' } },
          size: { value: { min: 1, max: 7 } },
          move: {
            enable: true,
            speed: { min: 12, max: 48 },
            direction: deg,
            spread: 26,
            outModes: { default: 'destroy' }
          },
          life: { duration: { value: 0.22 }, count: 1 }
        },
        emitters: [{
          position: { x: x, y: y },
          life: { duration: 0.04, count: 1 }
        }]
      });
      setTimeout(function () {
        if (tsP.dom && tsP.dom()) tsP.dom().item(id) && tsP.dom().item(id).destroy();
        el.remove();
      }, 600);
      return id;
    },

    /** кровь: тяжёлые капли, падают вниз */
    blood: function (host, x, y, dir, count) {
      const tsP = tsLib();
      if (!tsP || !tsP.create) return null;
      const id = 'b-' + Math.random().toString(36).slice(2, 9);
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      host.appendChild(el);
      tsP.create(id, {
        fullScreen: { enable: false },
        detectRetina: true,
        fpsLimit: 80,
        particles: {
          number: { value: count || 26, density: { enable: false } },
          color: { value: ['#8d1410', '#b3201a', '#5e0b09'] },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.5, max: 1 } },
          size: { value: { min: 2, max: 9 } },
          move: {
            enable: true,
            speed: { min: 3, max: 16 },
            direction: (dir == null ? -90 : dir * 180 / Math.PI),
            spread: 60,
            outModes: { default: 'destroy' },
            gravity: { enable: true, acceleration: 60, maxSpeed: 30 }
          },
          life: { duration: { value: 0.7 }, count: 1 }
        },
        emitters: [{ position: { x: x, y: y }, life: { duration: 0.12, count: 1 } }]
      });
      setTimeout(function () {
        if (tsP.dom && tsP.dom()) tsP.dom().item(id) && tsP.dom().item(id).destroy();
        el.remove();
      }, 1000);
      return id;
    },

    /** искры-электро: мелкие быстрые точки */
    embers: function (host, x, y) {
      const tsP = tsLib();
      if (!tsP || !tsP.create) return null;
      const id = 'e-' + Math.random().toString(36).slice(2, 9);
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      host.appendChild(el);
      tsP.create(id, {
        fullScreen: { enable: false },
        detectRetina: true,
        fpsLimit: 60,
        particles: {
          number: { value: 18, density: { enable: false } },
          color: { value: ['#9df6ff', '#ffffff'] },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.1, max: 0.8 }, animation: { enable: true, speed: 1.2, startValue: 'max', destroy: 'min' } },
          size: { value: { min: 1, max: 3.4 } },
          move: { enable: true, speed: { min: 1, max: 6 }, direction: 'none', random: true, outModes: { default: 'bounce' } },
          life: { duration: { value: 2.4 }, count: 1 }
        },
        emitters: [{ position: { x: x, y: y }, life: { duration: 0.2, count: 1 } }]
      });
      return id;
    },

    destroyAll: function (host) {
      if (host) host.querySelectorAll('[id^="p-"],[id^="m-"],[id^="b-"],[id^="e-"]').forEach(function (el) { el.remove(); });
    }
  };

  /* ------------------------------------------------------- тряска экрана */
  // Тряска не трогает камеру напрямую: она выдаёт смещение offset,
  // которое App добавляет к позиции Konva.Stage и к CSS-трансформу HTML-слоя.
  Cine.Shake = {
    amp: 0,
    offset: { x: 0, y: 0 },
    time: 0,

    kick: function (power) {
      this.amp = Math.min(46, Math.max(this.amp, power || 10));
      this.time = 0;
    },

    update: function (dt) {
      if (this.amp > 0.25) {
        this.time += dt;
        const decay = Math.exp(-this.time / 110);
        const a = this.amp * decay;
        // не случайный шум, а сумма двух частот — «удар и дребезг»
        const t = this.time;
        this.offset.x = Math.sin(t * 0.11) * a * 0.9 + (Math.random() - 0.5) * a * 0.5;
        this.offset.y = Math.cos(t * 0.14) * a * 0.7 + (Math.random() - 0.5) * a * 0.4;
        this.amp *= Math.pow(0.86, dt / 16.6);
        if (this.amp < 0.25) { this.amp = 0; this.offset.x = 0; this.offset.y = 0; }
      } else if (this.offset.x !== 0 || this.offset.y !== 0) {
        this.offset.x = 0; this.offset.y = 0;
      }
    }
  };
})(window);
