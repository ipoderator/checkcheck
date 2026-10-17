#!/usr/bin/env node
// Лёгкие PNG-запасные: квантование в палитру до 256 цветов с диффузией ошибки (Флойд — Стейнберг).
// Без зависимостей: свой разбор и сборка PNG на node:zlib.
//
// Палитра строится в пространстве RGBA с премультипликацией (прозрачные пиксели не тянут цвета,
// полупрозрачная тень раскладывается по ступеням альфы), затем уточняется k-средними.
// Самый частый точный цвет (прозрачный фон или фон секции) получает свою запись в палитре
// и переносится без изменений, поэтому края кадров остаются ровно того цвета, что были.
// Непрозрачные пиксели берут только непрозрачные цвета палитры.
//
// Запуск: node tools/render/quantize.mjs файл.png [...] — перезаписывает файлы на месте.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG (8 бит, RGB или RGBA, без чересстрочности) → { width, height, data: RGBA Uint8Array }. */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('не PNG');
  let off = 8;
  let ihdr = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace !== 0 || (ihdr.colorType !== 2 && ihdr.colorType !== 6)) {
    throw new Error('ожидался 8-битный RGB или RGBA PNG без чересстрочности');
  }
  const { width, height } = ihdr;
  const ch = ihdr.colorType === 6 ? 4 : 3;
  const stride = width * ch;
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? px[row + i - ch] : 0;
      const b = y > 0 ? px[row - stride + i] : 0;
      const c = i >= ch && y > 0 ? px[row - stride + i - ch] : 0;
      let v = raw[src + i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[row + i] = v & 0xff;
    }
  }
  if (ch === 4) return { width, height, data: px };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) {
    data[j] = px[i]; data[j + 1] = px[i + 1]; data[j + 2] = px[i + 2]; data[j + 3] = 255;
  }
  return { width, height, data };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/** Палитровый PNG: индексы по строкам, палитра [r, g, b, a][]. */
export function encodeIndexedPng(width, height, indices, palette) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach(([r, g, b], i) => { plte[i * 3] = r; plte[i * 3 + 1] = g; plte[i * 3 + 2] = b; });
  let last = -1;
  palette.forEach(([, , , a], i) => { if (a < 255) last = i; });
  // Два варианта фильтров строк — без фильтра и «Sub/Up/Paeth по минимальной сумме» — берётся меньший.
  const plain = Buffer.alloc((width + 1) * height);
  const adaptive = Buffer.alloc((width + 1) * height);
  const cand = [0, 1, 2, 4].map(() => Buffer.alloc(width));
  for (let y = 0; y < height; y++) {
    const row = indices.subarray(y * width, (y + 1) * width);
    const prev = y > 0 ? indices.subarray((y - 1) * width, y * width) : null;
    plain[y * (width + 1)] = 0;
    plain.set(row, y * (width + 1) + 1);
    let best = 0, bestSum = Infinity;
    [0, 1, 2, 4].forEach((f, n) => {
      const out = cand[n];
      let sum = 0;
      for (let x = 0; x < width; x++) {
        const a = x > 0 ? row[x - 1] : 0, b = prev ? prev[x] : 0, c = x > 0 && prev ? prev[x - 1] : 0;
        let pred = 0;
        if (f === 1) pred = a;
        else if (f === 2) pred = b;
        else if (f === 4) {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const v = (row[x] - pred) & 0xff;
        out[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = n; }
    });
    adaptive[y * (width + 1)] = [0, 1, 2, 4][best];
    adaptive.set(cand[best], y * (width + 1) + 1);
  }
  const zipped = [plain, adaptive].map((raw) => deflateSync(raw, { level: 9, memLevel: 9 }));
  const idat = zipped[0].length <= zipped[1].length ? zipped[0] : zipped[1];
  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('PLTE', plte)];
  if (last >= 0) parts.push(chunk('tRNS', Buffer.from(palette.slice(0, last + 1).map((p) => p[3]))));
  parts.push(chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** Цвет в пространстве с премультипликацией: прозрачность «гасит» RGB. */
function premul(r, g, b, a) {
  const k = a / 255;
  return [r * k, g * k, b * k, a];
}

/**
 * Палитра: гистограмма по 5 бит на канал → разбиение «коробок» по наибольшей взвешенной дисперсии →
 * несколько шагов k-средних. Возвращает [r, g, b, a][] (без премультипликации).
 */
function buildPalette(data, count, skip) {
  // Гистограмма в премультиплицированном пространстве, корзины 5 бит на канал.
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (skip(i)) continue;
    const [r, g, b, a] = premul(data[i], data[i + 1], data[i + 2], data[i + 3]);
    const key = ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | (a >> 3);
    let e = buckets.get(key);
    if (!e) { e = [0, 0, 0, 0, 0]; buckets.set(key, e); }
    e[0] += r; e[1] += g; e[2] += b; e[3] += a; e[4] += 1;
  }
  const points = [...buckets.values()].map((e) => ({ c: [e[0] / e[4], e[1] / e[4], e[2] / e[4], e[3] / e[4]], w: e[4] }));
  if (points.length === 0) return [];
  if (points.length <= count) return points.map((p) => unpremul(p.c));

  const stats = (pts) => {
    let w = 0;
    const s = [0, 0, 0, 0], q = [0, 0, 0, 0];
    for (const p of pts) {
      w += p.w;
      for (let k = 0; k < 4; k++) { s[k] += p.c[k] * p.w; q[k] += p.c[k] * p.c[k] * p.w; }
    }
    const v = s.map((sk, k) => q[k] - (sk * sk) / w);
    return { w, v, total: v[0] + v[1] + v[2] + v[3] };
  };
  const boxes = [{ pts: points, ...stats(points) }];
  while (boxes.length < count) {
    let best = -1;
    for (let i = 0; i < boxes.length; i++) if (boxes[i].pts.length > 1 && (best < 0 || boxes[i].total > boxes[best].total)) best = i;
    if (best < 0) break;
    const box = boxes[best];
    const axis = box.v.indexOf(Math.max(...box.v));
    box.pts.sort((p, q) => p.c[axis] - q.c[axis]);
    // Разрез по взвешенной медиане.
    let acc = 0, cut = 1;
    for (let i = 0; i < box.pts.length - 1; i++) {
      acc += box.pts[i].w;
      if (acc >= box.w / 2) { cut = i + 1; break; }
    }
    const left = box.pts.slice(0, cut), right = box.pts.slice(cut);
    boxes.splice(best, 1, { pts: left, ...stats(left) }, { pts: right, ...stats(right) });
  }
  let centers = boxes.map((b) => {
    const c = [0, 0, 0, 0];
    for (const p of b.pts) for (let k = 0; k < 4; k++) c[k] += p.c[k] * p.w;
    return c.map((x) => x / b.w);
  });
  // k-средние по корзинам.
  for (let it = 0; it < 6; it++) {
    const sum = centers.map(() => [0, 0, 0, 0, 0]);
    for (const p of points) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const c = centers[j];
        const d = (p.c[0] - c[0]) ** 2 + (p.c[1] - c[1]) ** 2 + (p.c[2] - c[2]) ** 2 + (p.c[3] - c[3]) ** 2;
        if (d < bd) { bd = d; bi = j; }
      }
      const s = sum[bi];
      for (let k = 0; k < 4; k++) s[k] += p.c[k] * p.w;
      s[4] += p.w;
    }
    centers = centers.map((c, j) => (sum[j][4] ? sum[j].slice(0, 4).map((x) => x / sum[j][4]) : c));
  }
  return centers.map(unpremul);
}

function unpremul([r, g, b, a]) {
  let alpha = Math.round(a);
  if (alpha >= 252) alpha = 255;
  if (alpha <= 0) return [0, 0, 0, 0];
  const k = 255 / alpha;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return [cl(r), cl(g), cl(b), alpha];
}

/** Самый частый точный цвет (все полностью прозрачные пиксели считаются одним цветом). */
function dominantColor(data) {
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const key = data[i + 3] === 0 ? -1 : ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null, bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  if (bestN < data.length / 4 / 100) return null;
  return best === -1 ? [0, 0, 0, 0] : [best >>> 24, (best >>> 16) & 255, (best >>> 8) & 255, best & 255];
}

/**
 * RGBA → индексы палитры с диффузией ошибки (змейкой). dither — доля переносимой ошибки:
 * меньше 1 — меньше шума и меньше файл, без возврата полос.
 */
export function quantize({ width, height, data }, { colors = 256, dither = 0.85, shadowSteps = 32 } = {}) {
  const dom = dominantColor(data);
  const reserved = dom ? [dom] : [];
  // Мягкие тени — почти чёрный цвет с плавной альфой. Для них отдельная лестница (0, 0, 0, a):
  // иначе на краю тени берутся светлые полупрозрачные цвета контура предмета и тень обрывается.
  const isShadow = (i) => data[i + 3] > 0 && data[i + 3] < 255 && data[i] + data[i + 1] + data[i + 2] < 48;
  let shadowPixels = 0, shadowMax = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (isShadow(i)) { shadowPixels++; shadowMax = Math.max(shadowMax, data[i + 3]); }
  }
  const ramp = shadowPixels > data.length / 4 / 100 ? shadowSteps : 0;
  for (let k = 1; k <= ramp; k++) reserved.push([0, 0, 0, Math.round((shadowMax * k) / ramp)]);
  const same = (i, c) => data[i] === c[0] && data[i + 1] === c[1] && data[i + 2] === c[2] && data[i + 3] === c[3];
  const skip = (i) => (dom && (same(i, dom) || (dom[3] === 0 && data[i + 3] === 0))) || (ramp > 0 && isShadow(i));
  const palette = [...reserved, ...buildPalette(data, colors - reserved.length, skip)];
  // Полупрозрачные цвета — в начало палитры: короче tRNS.
  const order = palette.map((p, i) => i).sort((i, j) => (palette[i][3] === 255) - (palette[j][3] === 255));
  const pal = order.map((i) => palette[i]);
  const pm = pal.map(([r, g, b, a]) => premul(r, g, b, a));
  const opaque = pal.map((p, i) => i).filter((i) => pal[i][3] === 255);
  const all = pal.map((p, i) => i);
  const transparent = pal.findIndex((p) => p[3] === 0);

  const nearest = (cands, r, g, b, a) => {
    let bi = cands[0], bd = Infinity;
    // Ошибка цвета при наложении и на чёрное, и на белое (берётся большая): так тёмная тень
    // не подменяется светлым полупрозрачным цветом той же альфы.
    for (const j of cands) {
      const c = pm[j];
      const da = a - c[3];
      const dr = r - c[0], dg = g - c[1], db = b - c[2];
      const d = Math.max(dr * dr, (dr - da) ** 2) + Math.max(dg * dg, (dg - da) ** 2) + Math.max(db * db, (db - da) ** 2);
      if (d < bd) { bd = d; bi = j; }
    }
    return bi;
  };
  // Кэш ближайшего цвета по 6 бит на канал (непрозрачные) и 5 бит (остальные).
  const cacheOpaque = new Int16Array(1 << 18).fill(-1);
  const cacheAll = new Int16Array(1 << 20).fill(-1);
  const exact = new Map(pal.map((p, i) => [`${p[0]},${p[1]},${p[2]},${p[3]}`, i]));

  const out = new Uint8Array(width * height);
  // Ошибка текущей и следующей строки, 4 канала.
  let cur = new Float32Array((width + 2) * 4), next = new Float32Array((width + 2) * 4);
  for (let y = 0; y < height; y++) {
    const ltr = y % 2 === 0;
    for (let s = 0; s < width; s++) {
      const x = ltr ? s : width - 1 - s;
      const i = (y * width + x) * 4;
      const e = (x + 1) * 4;
      const a0 = data[i + 3];
      if (a0 === 0 && transparent >= 0) { out[y * width + x] = transparent; continue; }
      const key = `${data[i]},${data[i + 1]},${data[i + 2]},${a0}`;
      const hit = exact.get(key);
      const [pr, pg, pb] = premul(data[i], data[i + 1], data[i + 2], a0);
      let r = pr + cur[e], g = pg + cur[e + 1], b = pb + cur[e + 2], a = a0 + cur[e + 3];
      let idx;
      if (hit !== undefined && Math.abs(cur[e]) + Math.abs(cur[e + 1]) + Math.abs(cur[e + 2]) + Math.abs(cur[e + 3]) < 2) {
        idx = hit; // точный цвет палитры (фон): без шума
      } else if (a0 === 255) {
        r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b)); a = 255;
        const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
        idx = cacheOpaque[k];
        if (idx < 0) { idx = nearest(opaque.length ? opaque : all, r, g, b, 255); cacheOpaque[k] = idx; }
      } else {
        a = Math.max(0, Math.min(255, a));
        const lim = a;
        r = Math.max(0, Math.min(lim, r)); g = Math.max(0, Math.min(lim, g)); b = Math.max(0, Math.min(lim, b));
        const k = ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | (a >> 3);
        idx = cacheAll[k];
        if (idx < 0) { idx = nearest(all, r, g, b, a); cacheAll[k] = idx; }
      }
      out[y * width + x] = idx;
      const c = pm[idx];
      const er = (r - c[0]) * dither, eg = (g - c[1]) * dither, eb = (b - c[2]) * dither, ea = (a - c[3]) * dither;
      const fwd = ltr ? 4 : -4;
      const spread = (arr, at, k) => { arr[at] += er * k; arr[at + 1] += eg * k; arr[at + 2] += eb * k; arr[at + 3] += ea * k; };
      spread(cur, e + fwd, 7 / 16);
      spread(next, e - fwd, 3 / 16);
      spread(next, e, 5 / 16);
      spread(next, e + fwd, 1 / 16);
    }
    [cur, next] = [next, cur];
    next.fill(0);
  }
  return { indices: out, palette: pal };
}

/**
 * Перезаписать PNG палитровым, если он ещё не палитровый. Палитра — 256 цветов; если файл
 * не укладывается в maxBytes, цветов меньше (диффузия ошибки держит градиенты без полос).
 * Возвращает { before, after, colors }.
 */
export function quantizeFile(file, { maxBytes = 390_000, dither = 0.85 } = {}) {
  const buf = readFileSync(file);
  if (buf[25] === 3) return { before: buf.length, after: buf.length, colors: null };
  const img = decodePng(buf);
  let png = null, colors = 0;
  for (colors of [256, 224, 192, 160, 128, 96, 64]) {
    const { indices, palette } = quantize(img, { colors, dither });
    png = encodeIndexedPng(img.width, img.height, indices, palette);
    if (png.length <= maxBytes) break;
  }
  if (png.length > maxBytes) throw new Error(`${file}: ${png.length} байт > ${maxBytes} даже при ${colors} цветах`);
  writeFileSync(file, png);
  return { before: buf.length, after: png.length, colors };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  for (const file of process.argv.slice(2)) {
    const { before, after, colors } = quantizeFile(file);
    console.log(`${file}: ${Math.round(before / 1000)} → ${Math.round(after / 1000)} КБ${colors ? `, ${colors} цветов` : ' (уже палитровый)'}`);
  }
}
