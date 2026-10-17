// Процедурные текстуры: бумага, торец со спиралью намотки, картонная втулка, «чек» на ленте.
// Всё детерминировано: одинаковый seed — одинаковая картинка.
import * as THREE from 'three';

export const INK = '#141517';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Гладкий одномерный шум: значения в узлах + косинусная интерполяция. */
function noise1d(rand, count) {
  const nodes = Array.from({ length: count + 2 }, () => rand() * 2 - 1);
  return (t) => {
    const x = Math.min(Math.max(t, 0), 1) * count;
    const i = Math.floor(x);
    const f = (1 - Math.cos((x - i) * Math.PI)) / 2;
    return nodes[i] * (1 - f) + nodes[i + 1] * f;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function grain(ctx, w, h, rand, amount, mono = true) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += mono ? n : (rand() - 0.5) * amount;
    d[i + 2] += mono ? n : (rand() - 0.5) * amount;
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(c, { srgb = true, repeat = false, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/** Бесшовная фактура термобумаги: цвет и рельеф волокон. */
export function paperTextures(seed = 1, size = 1024) {
  const rand = rng(seed);
  const color = canvas(size, size);
  const c = color.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, size, size);
  // Крупные пятна плотности — едва заметные.
  for (let i = 0; i < 160; i++) {
    const x = rand() * size, y = rand() * size, r = 20 + rand() * 90;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      const a = 0.012 + rand() * 0.012;
      g.addColorStop(0, `rgba(170,168,160,${a})`);
      g.addColorStop(1, 'rgba(170,168,160,0)');
      c.fillStyle = g;
      c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  grain(c, size, size, rand, 5);

  const bump = canvas(size, size);
  const b = bump.getContext('2d');
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  b.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size, y = rand() * size, len = 3 + rand() * 14, ang = rand() * Math.PI;
    const v = rand() < 0.5 ? 70 : 190;
    b.strokeStyle = `rgba(${v},${v},${v},${0.10 + rand() * 0.12})`;
    b.lineWidth = 0.6 + rand() * 0.8;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      b.beginPath();
      b.moveTo(x + dx, y + dy);
      b.lineTo(x + dx + Math.cos(ang) * len, y + dy + Math.sin(ang) * len);
      b.stroke();
    }
  }
  grain(b, size, size, rand, 26);
  return { map: toTexture(color, { repeat: true }), bump: toTexture(bump, { srgb: false, repeat: true }) };
}

/**
 * Торец рулона: спираль намотки, полосы натяжения, край картонной втулки — в UV RingGeometry
 * (центр холста — ось, край холста — внешний радиус rOut).
 */
export function endFaceTextures({ rIn, rOut, turns, seed = 7, size = 2048 }) {
  const rand = rng(seed);
  const px = (size / 2) / rOut;
  const cx = size / 2, cy = size / 2;
  const color = canvas(size, size);
  const c = color.getContext('2d');
  c.fillStyle = '#f2f1ed';
  c.fillRect(0, 0, size, size);

  // Полосы натяжения: кольца разной плотности по гладкому шуму.
  const band = noise1d(rand, 60);
  const fine = noise1d(rand, 400);
  const step = 0.5 / px;
  for (let r = rIn; r < rOut; r += step) {
    const t = (r - rIn) / (rOut - rIn);
    const v = band(t) * 0.6 + fine(t) * 0.4;
    c.strokeStyle = v > 0 ? `rgba(255,255,255,${v * 0.35})` : `rgba(150,146,138,${-v * 0.16})`;
    c.lineWidth = step * px + 0.4;
    c.beginPath();
    c.arc(cx, cy, r * px, 0, Math.PI * 2);
    c.stroke();
  }

  // Спираль намотки — тонкая, со «вздохами» контраста.
  const pulse = noise1d(rand, 90);
  c.lineWidth = 1.1;
  const segs = Math.round(turns * 720);
  let prev = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * turns * Math.PI * 2;
    const r = (rIn + 0.15 + (rOut - rIn - 0.25) * t) * px;
    const p = [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    if (prev && i % 6 === 0) {
      const a = 0.05 + Math.max(0, pulse(t)) * 0.10;
      c.strokeStyle = `rgba(120,116,108,${a})`;
      c.beginPath();
      c.moveTo(prev[0], prev[1]);
      c.lineTo(p[0], p[1]);
      c.stroke();
      prev = p;
    } else if (!prev) prev = p;
  }

  // Отдельные кольца — следы смены натяжения.
  for (let i = 0; i < 9; i++) {
    const r = rIn + 1 + rand() * (rOut - rIn - 2);
    c.strokeStyle = `rgba(130,126,118,${0.06 + rand() * 0.07})`;
    c.lineWidth = 1 + rand() * 1.5;
    c.beginPath();
    c.arc(cx, cy, r * px, 0, Math.PI * 2);
    c.stroke();
  }

  // Наружные витки чуть темнее (край), внутренние у втулки — тень.
  const rim = c.createRadialGradient(cx, cy, (rOut - 0.8) * px, cx, cy, rOut * px);
  rim.addColorStop(0, 'rgba(120,116,108,0)');
  rim.addColorStop(1, 'rgba(120,116,108,0.18)');
  c.fillStyle = rim;
  c.fillRect(0, 0, size, size);
  const inner = c.createRadialGradient(cx, cy, rIn * px, cx, cy, (rIn + 1.6) * px);
  inner.addColorStop(0, 'rgba(110,104,96,0.22)');
  inner.addColorStop(1, 'rgba(110,104,96,0)');
  c.fillStyle = inner;
  c.fillRect(0, 0, size, size);
  grain(c, size, size, rand, 7);

  // Рельеф: мелкие кольца-канавки той же спирали.
  const bump = canvas(size, size);
  const b = bump.getContext('2d');
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);
  for (let r = rIn; r < rOut; r += step * 2) {
    const v = 128 + fine((r - rIn) / (rOut - rIn)) * 50 + (rand() - 0.5) * 30;
    b.strokeStyle = `rgb(${v},${v},${v})`;
    b.lineWidth = step * px * 2 + 0.5;
    b.beginPath();
    b.arc(cx, cy, r * px, 0, Math.PI * 2);
    b.stroke();
  }
  grain(b, size, size, rand, 20);
  return { map: toTexture(color), bump: toTexture(bump, { srgb: false }) };
}

/** Серый картон втулки: волокна, пятнистость. darkMiddle — затемнение середины внутренней стенки. */
export function cardboardTexture({ seed = 3, size = 512, innerWall = false } = {}) {
  const rand = rng(seed);
  const cv = canvas(size, size);
  const c = cv.getContext('2d');
  c.fillStyle = '#9c978d';
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = rand() * size, y = rand() * size, r = 8 + rand() * 40;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() < 0.5;
    g.addColorStop(0, light ? 'rgba(190,184,172,0.12)' : 'rgba(90,86,80,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = rand() * size, y = rand() * size, len = 2 + rand() * 9, ang = rand() * Math.PI * 2;
    const v = rand() < 0.5 ? 80 : 200;
    c.strokeStyle = `rgba(${v},${v - 4},${v - 10},${0.10 + rand() * 0.15})`;
    c.lineWidth = 0.5 + rand();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    c.stroke();
  }
  grain(c, size, size, rand, 14);
  if (innerWall) {
    // Винтовой шов картонной трубки и тень в глубине (v = 0.5 — середина втулки).
    c.strokeStyle = 'rgba(60,56,50,0.35)';
    c.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.moveTo(k * size, 0);
      c.lineTo(k * size + size, size);
      c.stroke();
    }
    const g = c.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(20,18,16,0.10)');
    g.addColorStop(0.5, 'rgba(20,18,16,0.82)');
    g.addColorStop(1, 'rgba(20,18,16,0.10)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }
  return toTexture(cv, { repeat: true });
}

/**
 * Лента-«чек»: бумага, термопечать (слово «ВсеЧеки», штрихи вместо строк и цифр, абстрактный штрихкод),
 * зубчатый отрыв в конце. Координаты в мм: x — поперёк ленты, y — вдоль, от рулона.
 */
export function receiptTextures({ widthMm, lengthMm, printStartMm, seed = 11, ppm = 14 }) {
  const rand = rng(seed);
  const w = Math.round(widthMm * ppm), h = Math.round(lengthMm * ppm);
  const mm = (v) => v * ppm;

  const ink = canvas(w, h);
  const k = ink.getContext('2d');
  k.fillStyle = INK;
  k.strokeStyle = INK;
  const margin = Math.max(5, widthMm * 0.09);
  const left = mm(margin), right = w - mm(margin), inner = right - left;
  let y = mm(printStartMm);

  const bar = (x, yy, bw, bh, alpha = 0.9) => {
    k.globalAlpha = alpha;
    k.beginPath();
    k.roundRect(x, yy, bw, bh, bh / 2.5);
    k.fill();
    k.globalAlpha = 1;
  };
  const dashed = (yy) => {
    k.globalAlpha = 0.75;
    const d = mm(1.6), gap = mm(1.1);
    for (let x = left; x < right - d / 2; x += d + gap) k.fillRect(x, yy, d, mm(0.35));
    k.globalAlpha = 1;
  };

  // Шапка: словесный знак и подпись категории.
  const titleSize = Math.min(mm(widthMm * 0.135), mm(10));
  k.font = `750 ${titleSize}px Unbounded`;
  k.textAlign = 'center';
  k.textBaseline = 'alphabetic';
  y += titleSize;
  k.fillText('ВсеЧеки', w / 2, y);
  y += mm(4.2);
  k.font = `600 ${mm(2.5)}px Manrope`;
  k.letterSpacing = `${mm(0.55)}px`;
  k.globalAlpha = 0.85;
  k.fillText('КАССОВАЯ ЛЕНТА', w / 2, y);
  k.globalAlpha = 1;
  k.letterSpacing = '0px';
  y += mm(5);
  dashed(y);
  y += mm(5);

  // Строки «товаров»: штрих слева, короткий штрих справа.
  const rows = 6;
  for (let i = 0; i < rows; i++) {
    const lw = inner * (0.34 + rand() * 0.28);
    const rw = inner * (0.12 + rand() * 0.08);
    bar(left, y, lw, mm(1.9));
    bar(right - rw, y, rw, mm(1.9));
    if (rand() < 0.45) {
      bar(left + mm(2.5), y + mm(3.2), inner * (0.16 + rand() * 0.14), mm(1.3), 0.45);
      y += mm(3.2);
    }
    y += mm(5.6);
  }
  dashed(y);
  y += mm(5.5);
  // «Итог» — жирнее.
  bar(left, y, inner * 0.3, mm(3.2));
  bar(right - inner * 0.28, y, inner * 0.28, mm(3.2));
  y += mm(7.5);
  k.fillRect(left, y, inner, mm(0.45));
  k.fillRect(left, y + mm(1.1), inner, mm(0.45));
  y += mm(7);
  // Абстрактный штрихкод.
  const bcW = inner * 0.78, bcH = mm(Math.min(11, widthMm * 0.15));
  let x = (w - bcW) / 2;
  while (x < (w + bcW) / 2 - mm(0.5)) {
    const bw = mm([0.3, 0.3, 0.55, 0.8][Math.floor(rand() * 4)]);
    k.fillRect(x, y, bw, bcH);
    x += bw + mm([0.3, 0.45, 0.7][Math.floor(rand() * 3)]);
  }
  y += bcH + mm(5);
  bar(w / 2 - inner * 0.18, y, inner * 0.36, mm(1.5), 0.6);
  const printEnd = y + mm(2);

  // Термопечать: мелкие выпадения точек и лёгкое размытие.
  k.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (w * printEnd) / 40; i++) {
    k.globalAlpha = 0.15 + rand() * 0.35;
    k.fillRect(rand() * w, mm(printStartMm) + rand() * (printEnd - mm(printStartMm)), 1.2, 1.2);
  }
  k.globalAlpha = 1;
  k.globalCompositeOperation = 'source-over';

  const color = canvas(w, h);
  const c = color.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  grain(c, w, h, rand, 5);
  c.filter = 'blur(0.45px)';
  c.drawImage(ink, 0, 0);
  c.filter = 'none';

  // Маска: зубчатый отрыв в конце ленты.
  const mask = canvas(w, h);
  const m = mask.getContext('2d');
  m.fillStyle = '#ffffff';
  m.fillRect(0, 0, w, h);
  m.fillStyle = '#000000';
  const tooth = mm(widthMm / Math.round(widthMm / 2.6));
  const base = h - mm(2.2);
  m.beginPath();
  m.moveTo(0, h + 2);
  m.lineTo(0, base);
  for (let tx = 0; tx < w; tx += tooth) {
    m.lineTo(tx + tooth / 2, base - mm(1.5) - (rand() - 0.5) * mm(0.4));
    m.lineTo(Math.min(tx + tooth, w), base + (rand() - 0.5) * mm(0.3));
  }
  m.lineTo(w, h + 2);
  m.closePath();
  m.fill();

  return {
    map: toTexture(color, { anisotropy: 16 }),
    alpha: toTexture(mask, { srgb: false, anisotropy: 16 }),
    printEndMm: printEnd / ppm,
  };
}
