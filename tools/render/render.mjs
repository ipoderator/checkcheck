#!/usr/bin/env node
// Рендер изображений сайта: `npm run images`.
// Three.js из node_modules/three в headless Chromium (Playwright) → PNG с прозрачным фоном →
// Pillow (python3) → WebP под бюджет веса + PNG в public/assets/img/ → PNG-запасные квантуются
// в палитру (quantize.mjs), чтобы каждый был не тяжелее 400 КБ.
// Плюс словесный знак, favicon, apple-touch-icon и OG-картинка (brand.mjs, og.html).
//
// Флаги: --only hero,roll-57x40,… — только эти файлы; --raw <папка> — сохранить и сырые кадры.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBrand, faviconSvg } from './brand.mjs';
import { quantizeFile } from './quantize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PUBLIC = join(ROOT, 'public');
const IMG = join(PUBLIC, 'assets', 'img');
const ORIGIN = 'http://render.local';
// Предел для PNG-запасных (тест — 400 КБ; запас на разброс рендера).
const PNG_MAX_BYTES = 390_000;

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const rawDir = args.includes('--raw') ? resolve(args[args.indexOf('--raw') + 1]) : null;
const want = (name) => !only || only.includes(name);

const tmp = mkdtempSync(join(tmpdir(), 'vsecheki-render-'));
const jobs = [];
const extraFiles = new Map(); // путь на render.local → Buffer (кадры для OG)

function dataUrlToBuffer(url) {
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

function saveRaw(name, buf) {
  const file = join(tmp, `${name}.png`);
  writeFileSync(file, buf);
  if (rawDir) {
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(join(rawDir, `${name}.png`), buf);
  }
  return file;
}

async function openPage(browser, viewport = { width: 800, height: 800 }, deviceScaleFactor = 1) {
  const context = await browser.newContext({ viewport, deviceScaleFactor });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`[browser] ${m.text()}`); });
  page.on('pageerror', (e) => console.error(`[browser] ${e.message}`));
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (extraFiles.has(path)) return route.fulfill({ body: extraFiles.get(path), contentType: MIME[extname(path)] });
    let file = null;
    if (path.startsWith('/three/')) file = join(ROOT, 'node_modules', 'three', path.slice('/three/'.length));
    else if (path.startsWith('/render/')) file = join(HERE, path.slice('/render/'.length));
    if (!file || !file.startsWith(ROOT) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ body: readFileSync(file), contentType: MIME[extname(file)] || 'application/octet-stream' });
  });
  return { context, page };
}

async function shot(browser, name, opts) {
  const { context, page } = await openPage(browser);
  await page.goto(`${ORIGIN}/render/scene/index.html`);
  await page.waitForFunction(() => window.renderReady === true);
  const result = await page.evaluate(([n, o]) => window.renderShot(n, o), [name, opts]);
  await context.close();
  return result;
}

async function main() {
  mkdirSync(IMG, { recursive: true });
  const launchArgs = process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const browser = await chromium.launch({ args: launchArgs });
  try {
    if (want('hero-roll')) {
      const img = await shot(browser, 'hero', { size: 1600, supersample: 2 });
      jobs.push({ src: saveRaw('hero-roll', dataUrlToBuffer(img)), out: join(IMG, 'hero-roll'), size: [1600, 1600], formats: ['webp', 'png'], webp_max_bytes: 245_000, png_max_bytes: PNG_MAX_BYTES });
    }
    // Карточки форматов — почти в одном масштабе: 80 × 80 заметно шире и толще 57 × 40
    // (57 × 40 снят чуть ближе, иначе на карточке он теряется).
    if (want('roll-80x80') || want('roll-57x40')) {
      const big = await shot(browser, 'roll', { width: 80, diameter: 80, size: 1000, supersample: 2 });
      const small = await shot(browser, 'roll', { width: 57, diameter: 40, size: 1000, supersample: 2, distance: big.distance * 0.8 });
      jobs.push({ src: saveRaw('roll-80x80', dataUrlToBuffer(big.image)), out: join(IMG, 'roll-80x80'), size: [1000, 1000], formats: ['webp', 'png'], webp_max_bytes: 118_000, png_max_bytes: PNG_MAX_BYTES });
      jobs.push({ src: saveRaw('roll-57x40', dataUrlToBuffer(small.image)), out: join(IMG, 'roll-57x40'), size: [1000, 1000], formats: ['webp', 'png'], webp_max_bytes: 118_000, png_max_bytes: PNG_MAX_BYTES });
    }
    let brand = null;
    if (want('brand') || want('og-image')) {
      const { context, page } = await openPage(browser);
      await page.goto(`${ORIGIN}/render/scene/index.html`);
      brand = await writeBrand(PUBLIC, page);
      await context.close();
    }
    if (want('apple-touch-icon')) {
      const { context, page } = await openPage(browser, { width: 180, height: 180 }, 4);
      await page.setContent(`<html><body style="margin:0">${faviconSvg({ size: 180, rounded: false })}</body></html>`);
      const buf = await page.screenshot({ omitBackground: false });
      await context.close();
      jobs.push({ src: saveRaw('apple-touch-icon', buf), out: join(IMG, 'apple-touch-icon'), size: [180, 180], formats: ['png'], background: '#141517' });
    }
    if (want('og-image')) {
      const roll = await shot(browser, 'hero', { size: 1400, supersample: 2 });
      extraFiles.set('/og/roll.png', dataUrlToBuffer(roll));
      extraFiles.set('/og/logo.svg', Buffer.from(brand.dark));
      const { context, page } = await openPage(browser, { width: 1200, height: 630 }, 2);
      await page.goto(`${ORIGIN}/render/og/og.html`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => window.ogReady === true);
      const buf = await page.screenshot();
      await context.close();
      jobs.push({ src: saveRaw('og-image', buf), out: join(IMG, 'og-image'), size: [1200, 630], formats: ['png'], background: '#f7f6f2' });
    }
  } finally {
    await browser.close();
  }
  if (jobs.length) {
    const jobsFile = join(tmp, 'jobs.json');
    writeFileSync(jobsFile, JSON.stringify(jobs));
    execFileSync('python3', ['-I', join(HERE, 'encode.py'), jobsFile], { stdio: 'inherit' });
    for (const job of jobs) {
      if (!job.png_max_bytes || !job.formats.includes('png')) continue;
      const { before, after, colors } = quantizeFile(`${job.out}.png`, { maxBytes: job.png_max_bytes });
      console.log(`${job.out}.png: палитра ${colors} цветов, ${Math.round(before / 1000)} → ${Math.round(after / 1000)} КБ`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
