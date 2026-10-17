// Место производства на сайте не называется (G15–G18): ни одной формы слова «Лейпциг»
// в файлах сайта, README, docs и рендере картинок. Липецк в контактах и реквизитах — другой
// город, он остаётся на своих местах.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from '../helpers/php-server.mjs';

// Падежные формы, латиница и частые опечатки; «Липецк» сюда не попадает.
const LEIPZIG = /лейпц|ляйпц|лепциг|лейпциг|leipz|leipc|lejpz/i;
const SCOPE = ['public', 'README.md', 'docs', join('tools', 'render')];
const SKIP_DIRS = new Set(['storage', 'node_modules', '.git']);

function walk(path, out = []) {
  if (!existsSync(path)) return out;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (SKIP_DIRS.has(name)) continue;
      walk(join(path, name), out);
    }
  } else if (stat.isFile() && stat.size < 4 * 1024 * 1024) {
    out.push(path);
  }
  return out;
}

function readText(file) {
  const buf = readFileSync(file);
  if (buf.includes(0)) return null; // бинарный файл: картинка, шрифт
  return buf.toString('utf8');
}

test('нет ни одного упоминания Лейпцига в public/, README.md, docs/ и tools/render', () => {
  const hits = [];
  for (const entry of SCOPE) {
    for (const file of walk(join(ROOT, entry))) {
      const text = readText(file);
      if (text === null) continue;
      text.split('\n').forEach((line, i) => {
        if (LEIPZIG.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
  }
  assert.deepEqual(hits, []);
});

test('Липецк остался в контактах, подвале, JSON-LD, политике и согласии', () => {
  const index = readFileSync(join(ROOT, 'public', 'index.html'), 'utf8');
  assert.match(index, /"addressLocality":\s*"Липецк"/, 'JSON-LD address');
  assert.match(index, /<p class="contacts__city">Липецк<\/p>/, 'контакты');
  assert.match(index, /<dt>Город<\/dt><dd>Липецк<\/dd>/, 'реквизиты');
  assert.match(index, /<div class="site-footer__contacts">[\s\S]*?<span>Липецк<\/span>[\s\S]*?<\/div>/, 'подвал');

  for (const page of ['privacy.html', 'consent.html']) {
    const html = readFileSync(join(ROOT, 'public', page), 'utf8');
    assert.match(html, /ИНН 270399373377, город Липецк/, `${page}: оператор`);
    assert.match(html, /<p class="doc__sign">[^<]*Липецк/, `${page}: подпись`);
  }
});
