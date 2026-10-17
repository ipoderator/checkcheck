// Айдентика «ВсеЧеки»: словесный знак (Unbounded, буквы переведены в контуры) со значком-чеком,
// favicon. Контуры строит outline.py (fontTools), кернинг измеряется в браузере.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WORD = 'ВсеЧеки';
export const WEIGHT = 700;
// Трекинг словесного знака, доли em: Unbounded широкий, крупно его стоит чуть сжать.
const TRACKING = -0.012;

export const PALETTE = {
  paper: '#F7F6F2', white: '#FFFFFF', ink: '#141517', gray: '#5E6066', line: '#DCDAD3', accent: '#E5352B',
};

const n = (v) => Number(v.toFixed(2));

/** Значок-чек: лента со скруглённым верхом, зубчатым отрывом снизу и тремя строками печати. */
export function receiptIcon({ x = 0, y = 0, w, h, body, bar, accent, teeth = 4 }) {
  const r = w * 0.16;
  const tooth = h * 0.085;
  const step = w / teeth;
  let d = `M${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h)}`;
  for (let i = teeth - 1; i >= 0; i--) {
    d += `L${n(x + step * i + step / 2)} ${n(y + h - tooth)}L${n(x + step * i)} ${n(y + h)}`;
  }
  d += 'Z';
  const bh = h * 0.085;
  const bars = [
    [0.27, 0.62, bar],
    [0.43, 0.44, bar],
    [0.62, 0.62, accent],
  ].map(([ty, tw, fill]) => {
    const bx = x + w * 0.19, by = y + h * ty;
    return `<rect x="${n(bx)}" y="${n(by)}" width="${n(w * tw)}" height="${n(bh)}" rx="${n(bh / 2)}" fill="${fill}"/>`;
  });
  return `<path d="${d}" fill="${body}"/>${bars.join('')}`;
}

/** favicon: белый чек на графитовом квадрате — читается и на светлой, и на тёмной вкладке. */
export function faviconSvg({ size = null, rounded = true } = {}) {
  const dims = size ? ` width="${size}" height="${size}"` : '';
  const bg = rounded
    ? `<rect width="64" height="64" rx="14" fill="${PALETTE.ink}"/>`
    : `<rect width="64" height="64" fill="${PALETTE.ink}"/>`;
  const icon = receiptIcon({ x: 17, y: 9, w: 30, h: 46, body: PALETTE.white, bar: PALETTE.ink, accent: PALETTE.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dims}>${bg}${icon}</svg>`;
}

/** Позиции букв с кернингом (единицы em × 1000) — измеряет страница со шрифтом Unbounded. */
async function measure(page) {
  return page.evaluate(async ([word, weight]) => {
    const face = new FontFace('UnboundedBrand', 'url(/render/fonts/Unbounded-subset.ttf)', { weight: '200 900' });
    document.fonts.add(await face.load());
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${weight} 1000px UnboundedBrand`;
    ctx.fontKerning = 'normal';
    const chars = [...word];
    return chars.map((char, i) => ({ char, x: ctx.measureText(chars.slice(0, i).join('')).width }));
  }, [WORD, WEIGHT]);
}

function outline(glyphs) {
  const dir = mkdtempSync(join(tmpdir(), 'vsecheki-brand-'));
  try {
    const job = join(dir, 'job.json');
    const tracked = glyphs.map((g, i) => ({ char: g.char, x: g.x + i * TRACKING * 1000 }));
    writeFileSync(job, JSON.stringify({ font: join(HERE, 'fonts', 'Unbounded-subset.ttf'), wght: WEIGHT, glyphs: tracked }));
    return JSON.parse(execFileSync('python3', ['-I', join(HERE, 'outline.py'), job], { encoding: 'utf8' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function logoSvg({ d, bounds, capHeight }, { text, body, bar }) {
  const cap = capHeight;
  const iconH = cap * 1.2, iconW = cap * 0.78;
  const gap = cap * 0.3;
  const iconY = -cap * 1.06;
  const textX = iconW + gap - bounds[0];
  const top = Math.min(iconY, bounds[1]);
  const bottom = Math.max(iconY + iconH, bounds[3]);
  const width = textX + bounds[2];
  const pad = cap * 0.02;
  const vb = [-pad, top - pad, width + pad * 2, bottom - top + pad * 2].map(n).join(' ');
  const icon = receiptIcon({ x: 0, y: iconY, w: iconW, h: iconH, body, bar, accent: PALETTE.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="ВсеЧеки"><title>ВсеЧеки</title>${icon}<path transform="translate(${n(textX)} 0)" d="${d}" fill="${text}"/></svg>\n`;
}

/** Пишет public/assets/brand/logo.svg (тёмный знак для светлого фона), logo-light.svg и public/favicon.svg. */
export async function writeBrand(publicDir, page) {
  const shape = outline(await measure(page));
  const brandDir = join(publicDir, 'assets', 'brand');
  mkdirSync(brandDir, { recursive: true });
  const dark = logoSvg(shape, { text: PALETTE.ink, body: PALETTE.ink, bar: PALETTE.paper });
  const light = logoSvg(shape, { text: PALETTE.paper, body: PALETTE.paper, bar: PALETTE.ink });
  writeFileSync(join(brandDir, 'logo.svg'), dark);
  writeFileSync(join(brandDir, 'logo-light.svg'), light);
  writeFileSync(join(publicDir, 'favicon.svg'), `${faviconSvg()}\n`);
  for (const f of ['assets/brand/logo.svg', 'assets/brand/logo-light.svg', 'favicon.svg']) console.log(join(publicDir, f));
  return { dark, light };
}
