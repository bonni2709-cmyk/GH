/* ============================================================================
   Экспорт сценария всех томов из единого источника — js/volumes*.js
   Запуск:  node tools/export-scenario.cjs
   Пишет 10 файлов:  scenario/tom-01-dno.md … scenario/tom-10-epicentr.md
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* volumes*.js — обычные IIFE над window; грузим без браузера */
const sandbox = { PG: {} };
['js/utils.js', 'js/sets.js', 'js/shot.js', 'js/volumes.js', 'js/volumes2.js', 'js/compile.js'].forEach((f) => {
  new Function('window', 'globalThis', fs.readFileSync(path.join(ROOT, f), 'utf8'))(sandbox, sandbox);
});
const PG = sandbox.PG;
PG.compileVolumes();

const KIND = {
  narration: 'МИЗАНСЦЕНА',
  speech: 'РЕПЛИКА',
  radio: 'РАДИО',
  system: 'СИСТЕМА'
};

const SLUG = {
  1: 'dno',
  2: 'krakh',
  3: 'probuzhdenie',
  4: 'nizhnie-yarusa',
  5: 'sonar',
  6: 'mnema',
  7: 'kriokamera',
  8: 'krov-i-metall',
  9: 'teleport',
  10: 'epicentr'
};

const outDir = path.join(ROOT, 'scenario');
fs.mkdirSync(outDir, { recursive: true });

let totalPages = 0;
let totalLines = 0;
const row = [];

PG.volumes.forEach((vol) => {
  const out = [];
  const line = (s) => out.push(s == null ? '' : s);

  const num = String(vol.id).padStart(2, '0');
  line('# ПРОЕКТ-ГЕНЕЗИС · Том ' + num);
  line('## «' + vol.title + '» — ' + vol.subtitle);
  line();
  line('Сценарий выгружен из `js/volumes.js` / `js/volumes2.js` — того же источника, что читает движок.');
  line('Формат: страницы, мизансцены и реплики. Без разбивки на панели и без описания композиции кадра.');
  line();
  line('Страниц: ' + vol.pages.length);
  line();
  line('---');
  line();

  vol.pages.forEach((p) => {
    totalPages++;
    line();
    line('## Страница ' + p.n);
    line();
    const data = vol.index[p.n];
    (data.blocks || []).forEach((b) => {
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
        totalLines++;
      }
    });
  });

  line();
  line('---');
  line();
  line('_Конец тома ' + num + ' «' + vol.title + '»_');
  line();

  const target = path.join(outDir, 'tom-' + num + '-' + SLUG[vol.id] + '.md');
  fs.writeFileSync(target, out.join('\n'), 'utf8');
  row.push('| ' + num + ' | «' + vol.title + '» | ' + vol.subtitle + ' | ' + vol.pages.length + ' | `' + path.relative(ROOT, target) + '` |');
  console.log('written:', path.relative(ROOT, target), '·', out.length, 'строк');
});

/* сводный индекс */
const idx = [];
idx.push('# ПРОЕКТ-ГЕНЕЗИС — сценарий');
idx.push('');
idx.push('10 томов × 20 страниц = **200 страниц**. Все тома дописаны.');
idx.push('Источник — `js/volumes.js` (тома 01–05) и `js/volumes2.js` (тома 06–10).');
idx.push('');
idx.push('| Том | Название | Время действия | Страниц | Файл |');
idx.push('|---|---|---|---|---|');
row.forEach((r) => idx.push(r));
idx.push('');
idx.push('Сгенерировано: `node tools/export-scenario.cjs`');
idx.push('');
fs.writeFileSync(path.join(outDir, 'README.md'), idx.join('\n'), 'utf8');

console.log('\nвсего: томов ' + PG.volumes.length + ', страниц ' + totalPages + ', реплик ' + totalLines);
console.log('индекс:', path.relative(ROOT, path.join(outDir, 'README.md')));
