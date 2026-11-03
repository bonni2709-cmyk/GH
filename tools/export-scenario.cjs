/* ============================================================================
   Генератор сценарного документа тома 01 из единого источника — js/comicData.js
   Запуск:  node tools/export-scenario.cjs
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* comicData.js — обычный IIFE над window; грузим его без браузера */
const sandbox = { PG: {} };
const code = fs.readFileSync(path.join(ROOT, 'js/comicData.js'), 'utf8');
new Function('window', 'globalThis', code)(sandbox, sandbox);
const PG = sandbox.PG;
const vol = PG.comicData[0];

const KIND = {
  narration: 'МИЗАНСЦЕНА',
  speech: 'РЕПЛИКА',
  radio: 'РАДИО',
  system: 'СИСТЕМА',
  thought: 'МЫСЛЬ'
};

const out = [];
const line = (s) => out.push(s == null ? '' : s);

line('# ПРОЕКТ-ГЕНЕЗИС');
line('## Том ' + String(vol.id).padStart(2, '0') + ' — «' + vol.title + '». ' + vol.subtitle);
line();
line('Сценарий выгружен из `js/comicData.js` — того же источника, что читает движок.');
line('Формат: страницы, мизансцены и реплики. Без разбивки на панели и без описания композиции кадра.');
line();
line('---');

vol.pages.forEach((p) => {
  line();
  line('## Страница ' + p.n);
  line();
  const meta = [];
  if (p.place) meta.push('**Место:** ' + p.place);
  if (p.time) meta.push('**Время:** ' + p.time);
  if (meta.length) line(meta.join(' · '));
  line();

  (p.blocks || []).forEach((b) => {
    if (b.kind === 'narration') {
      line('**Мизансцена.** ' + b.text);
      line();
    } else {
      const who = b.who || '—';
      let tag = KIND[b.kind] || 'ТЕКСТ';
      if (b.muffled) tag += ', за стеклом';
      line('*' + tag + '* · **' + who + ':**');
      line('> ' + b.text);
      line();
    }
  });
});

line();
line('---');
line();
line('### Ряд томов');
line();
PG.series.forEach((v) => {
  line('- **Т' + String(v.n).padStart(2, '0') + ' — ' + v.title + '** — ' + v.note + (v.ready ? ' _(готов)_' : ' _(в работе)_'));
});
line();

const target = path.join(ROOT, 'scenario', 'tom-01-predystoriya.md');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out.join('\n'), 'utf8');
console.log('written:', path.relative(ROOT, target), '·', out.length, 'lines');
