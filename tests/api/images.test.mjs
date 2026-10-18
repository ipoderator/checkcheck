// Изображения продукта (таск 02): файлы из таблицы «Изображения» в interfaces.md —
// на месте, с теми же именами, размерами, весом и прозрачностью.
// Перегенерировать: npm run images.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT } from '../helpers/php-server.mjs';

const PUBLIC = join(ROOT, 'public');
const IMG = join(PUBLIC, 'assets', 'img');
const KB = 1000;
// Предел для PNG-запасных: квантование палитры (вторая задача, ист. 66).
const PNG_MAX_BYTES = 400 * KB;

// [файл, ширина, высота, прозрачный фон, предел веса в байтах]
const RASTERS = [
  ['hero-roll.webp', 1600, 1600, true, 250 * KB],
  ['hero-roll.png', 1600, 1600, true],
  ['roll-57x40.webp', 1000, 1000, true, 120 * KB],
  ['roll-57x40.png', 1000, 1000, true],
  ['roll-80x80.webp', 1000, 1000, true, 120 * KB],
  ['roll-80x80.png', 1000, 1000, true],
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

/**
 * Декодер PNG (8 бит, без чересстрочности): RGB, RGBA, палитра с tRNS, серый.
 * Возвращает { width, height, pixel(x, y) → [r, g, b, a] }.
 */
function decodePng(buf) {
  let off = 8;
  let ihdr = null, palette = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  assert.ok(ihdr, 'нет IHDR');
  assert.equal(ihdr.depth, 8, 'ожидалась глубина 8 бит');
  assert.equal(ihdr.interlace, 0, 'чересстрочный PNG не ожидался');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.colorType];
  assert.ok(channels, `неизвестный тип цвета ${ihdr.colorType}`);
  const { width, height } = ihdr;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= channels && y > 0 ? px[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 0xff;
    }
  }
  const pixel = (x, y) => {
    const i = y * stride + x * channels;
    switch (ihdr.colorType) {
      case 0: return [px[i], px[i], px[i], 255];
      case 2: return [px[i], px[i + 1], px[i + 2], 255];
      case 4: return [px[i], px[i], px[i], px[i + 1]];
      case 6: return [px[i], px[i + 1], px[i + 2], px[i + 3]];
      default: {
        const k = px[i];
        return [palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2], trns && k < trns.length ? trns[k] : 255];
      }
    }
  };
  return { width, height, pixel };
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
        if (info.format === 'png') assert.equal(decodePng(buf).pixel(0, 0)[3], 0, 'угол картинки не прозрачный');
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

  test('каждый PNG в public/assets/img не тяжелее 400 КБ', () => {
    const pngs = readdirSync(IMG).filter((f) => f.endsWith('.png'));
    assert.ok(pngs.length >= 5, `PNG мало: ${pngs.join(', ')}`);
    for (const f of pngs) {
      const size = statSync(join(IMG, f)).size;
      assert.ok(size <= PNG_MAX_BYTES, `${f}: ${Math.round(size / KB)} КБ > 400 КБ`);
    }
  });

  test('раздела «Производство» нет — и его картинки production-roll в public тоже', () => {
    const left = readdirSync(IMG).filter((f) => f.startsWith('production-roll'));
    assert.deepEqual(left, []);
  });

  test('стопки рулонов больше нет: ни файлов, ни кадра в рендере', () => {
    const left = readdirSync(IMG).filter((f) => f.startsWith('rolls-stack'));
    assert.deepEqual(left, []);
    for (const rel of ['tools/render/render.mjs', 'tools/render/scene/shots.js']) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      assert.ok(!/rolls-stack|stackShot|\bstack\b/.test(src), `${rel} ещё рендерит стопку`);
    }
  });

  test('под изображениями нет подписи «3D-визуализация…»: только alt и строка в подвале', () => {
    const html = readFileSync(join(PUBLIC, 'index.html'), 'utf8');
    assert.ok(!/<figcaption/i.test(html), 'есть figcaption');
    // Видимый текст: без тегов; атрибуты alt в него не попадают.
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '\n');
    const lines = visible.split('\n').map((l) => l.trim()).filter((l) => /3D-визуализац/i.test(l));
    assert.equal(lines.length, 1, `подписей с «3D-визуализация»: ${lines.join(' | ')}`);
    assert.match(lines[0], /Изображения продукции на(&nbsp;|\s)сайте/);
  });

  test('светлый и тёмный варианты логотипа различаются', () => {
    const dark = readFileSync(join(PUBLIC, 'assets/brand/logo.svg'), 'utf8');
    const light = readFileSync(join(PUBLIC, 'assets/brand/logo-light.svg'), 'utf8');
    assert.notEqual(dark, light);
  });
});
