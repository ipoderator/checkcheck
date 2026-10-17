// Изображения продукта (таск 02): файлы из таблицы «Изображения» в interfaces.md —
// на месте, с теми же именами, размерами, весом и прозрачностью.
// Перегенерировать: npm run images.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT } from '../helpers/php-server.mjs';

const PUBLIC = join(ROOT, 'public');
const IMG = join(PUBLIC, 'assets', 'img');
const KB = 1000;

// [файл, ширина, высота, прозрачный фон, предел веса в байтах]
const RASTERS = [
  ['hero-roll.webp', 1600, 1600, true, 250 * KB],
  ['hero-roll.png', 1600, 1600, true],
  ['roll-57x40.webp', 1000, 1000, true, 120 * KB],
  ['roll-57x40.png', 1000, 1000, true],
  ['roll-80x80.webp', 1000, 1000, true, 120 * KB],
  ['roll-80x80.png', 1000, 1000, true],
  ['rolls-stack.webp', 1600, 1000, false],
  ['rolls-stack.png', 1600, 1000, false],
  ['og-image.png', 1200, 630, false],
  ['apple-touch-icon.png', 180, 180, false],
];

// Палитра из «Решений по реализации» спецификации.
const PALETTE = ['#f7f6f2', '#ffffff', '#141517', '#5e6066', '#dcdad3', '#e5352b'];

/** Размер и наличие альфы у PNG/WebP — по заголовку файла, без зависимостей. */
function probe(buf) {
  if (buf.subarray(1, 4).toString('latin1') === 'PNG') {
    const colorType = buf[25];
    const hasTrns = buf.includes(Buffer.from('tRNS', 'latin1'));
    return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 || hasTrns };
  }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    const chunk = buf.subarray(12, 16).toString('latin1');
    if (chunk === 'VP8X') {
      return { format: 'webp', width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1, alpha: (buf[20] & 0x10) !== 0 };
    }
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, alpha: ((bits >> 28) & 1) === 1 };
    }
    if (chunk === 'VP8 ') {
      return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, alpha: false };
    }
  }
  return { format: 'unknown' };
}

/** Альфа левого верхнего пикселя RGBA-PNG (8 бит): первая строка не зависит от предыдущей. */
function pngCornerAlpha(buf) {
  assert.equal(buf[24], 8, 'ожидалась глубина 8 бит');
  assert.equal(buf[25], 6, 'ожидался RGBA-PNG');
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  // Фильтры None/Sub/Up/Average/Paeth для первого пикселя первой строки сводятся к самому байту
  // (слева и сверху — нули), кроме Average: там prev/2 = 0 — тоже сам байт.
  return raw[1 + 3];
}

describe('изображения из таблицы interfaces.md', () => {
  for (const [name, width, height, transparent, maxBytes] of RASTERS) {
    test(`${name}: ${width} × ${height}${transparent ? ', прозрачный фон' : ''}${maxBytes ? `, ≤ ${maxBytes / KB} КБ` : ''}`, () => {
      const file = join(IMG, name);
      assert.ok(existsSync(file), `нет файла public/assets/img/${name} — запусти npm run images`);
      const buf = readFileSync(file);
      const info = probe(buf);
      assert.equal(info.format, name.endsWith('.webp') ? 'webp' : 'png', 'формат по содержимому');
      assert.deepEqual([info.width, info.height], [width, height]);
      if (maxBytes) assert.ok(statSync(file).size <= maxBytes, `${name}: ${statSync(file).size} байт > ${maxBytes}`);
      if (transparent) {
        assert.ok(info.alpha, 'нет альфа-канала');
        if (info.format === 'png') assert.equal(pngCornerAlpha(buf), 0, 'угол картинки не прозрачный');
      }
    });
  }

  for (const rel of ['favicon.svg', 'assets/brand/logo.svg', 'assets/brand/logo-light.svg']) {
    test(`${rel}: SVG с viewBox, цвета — только из палитры`, () => {
      const file = join(PUBLIC, rel);
      assert.ok(existsSync(file), `нет файла public/${rel}`);
      const svg = readFileSync(file, 'utf8');
      assert.match(svg, /^\s*(<\?xml[^>]*>\s*)?<svg\b[^>]*\bviewBox="[\d.\s-]+"/);
      assert.match(svg, /<\/svg>\s*$/);
      const colors = [...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
      assert.ok(colors.length > 0, 'нет цветов');
      for (const c of colors) assert.ok(PALETTE.includes(c), `цвет ${c} не из палитры`);
    });
  }

  test('светлый и тёмный варианты логотипа различаются', () => {
    const dark = readFileSync(join(PUBLIC, 'assets/brand/logo.svg'), 'utf8');
    const light = readFileSync(join(PUBLIC, 'assets/brand/logo-light.svg'), 'utf8');
    assert.notEqual(dark, light);
  });
});
