/* ============================================================================
   Проверка компоновки: не пересекаются ли текстовые блоки и не выходят ли
   они за пределы страницы. Оценка высоты — по той же метрике, что в style.css.
   Запуск: node tools/check-layout.cjs
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sandbox = { PG: {} };
new Function('window', 'globalThis', fs.readFileSync(path.join(ROOT, 'js/comicData.js'), 'utf8'))(sandbox, sandbox);
const PG = sandbox.PG;

const W = 1200, H = 1800;
const SAFE_BOTTOM = H - 140; // ниже — плашка места действия

/* приблизительная ширина кириллицы в Arial/Helvetica */
function charW(ch) {
  if (/[ .,:;!?'’]/.test(ch)) return 0.28;
  if (/[«»()\-—–]/.test(ch)) return 0.36;
  if (/[А-ЯЁA-Z]/.test(ch)) return 0.62;
  if (/[0-9]/.test(ch)) return 0.56;
  return 0.53;
}
function measure(text, size) {
  let w = 0;
  for (const ch of text) w += charW(ch) * size;
  return w;
}
function wrapLines(text, size, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (measure(next, size) > maxW && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function boxFor(b) {
  const size = b.size || 26;
  const pad = size * 0.82;
  const innerW = b.w - pad * 2;
  const lines = wrapLines(b.text, size, innerW);
  const lineH = size * 1.38;
  const headH = size * 0.95 + size * 0.42; // шапка + отступ
  const height = pad + headH + lines.length * lineH + pad * 0.8;
  return { x: b.x, y: b.y, w: b.w, h: height, lines: lines.length };
}
function overlap(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return (ox > 0 && oy > 0) ? { ox, oy, area: ox * oy } : null;
}

let problems = 0;
PG.comicData.forEach((vol) => {
  vol.pages.forEach((p) => {
    const boxes = (p.blocks || []).map((b, i) => Object.assign(boxFor(b), { i, b }));
    boxes.forEach((bx) => {
      const right = bx.x + bx.w;
      if (bx.x < 40 || right > W - 40) {
        console.log(`⚠ стр.${p.n} блок#${bx.i + 1}: выходит за поля по X (${Math.round(bx.x)}…${Math.round(right)})`);
        problems++;
      }
      if (bx.y < 60) {
        console.log(`⚠ стр.${p.n} блок#${bx.i + 1}: слишком высоко (y=${Math.round(bx.y)})`);
        problems++;
      }
      if (bx.y + bx.h > SAFE_BOTTOM) {
        console.log(`⚠ стр.${p.n} блок#${bx.i + 1}: заходит на нижнюю плашку (низ ${Math.round(bx.y + bx.h)} > ${SAFE_BOTTOM})`);
        problems++;
      }
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const ov = overlap(boxes[i], boxes[j]);
        if (ov && ov.area > 900) {
          console.log(`⚠ стр.${p.n}: блок#${i + 1} и блок#${j + 1} пересекаются (${Math.round(ov.ox)}×${Math.round(ov.oy)} px)`);
          problems++;
        }
      }
    }
    const fill = boxes.length
      ? Math.max.apply(null, boxes.map(x => x.y + x.h)) / H
      : 0;
    console.log(`  стр.${String(p.n).padStart(2, '0')} · блоков ${boxes.length} · низ ${Math.round(fill * 100)}% страницы`);
  });
});

console.log(problems ? `\nнайдено замечаний: ${problems}` : '\nзамечаний нет');
process.exitCode = problems ? 1 : 0;
