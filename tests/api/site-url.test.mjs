// Адрес сайта задаётся одной командой перед публикацией (G22):
// `npm run set-site-url -- https://…` → site.config.json, canonical, Open Graph, JSON-LD, robots.txt, sitemap.xml.
// Команда гоняется на копии public/ во временной папке: рабочие файлы не меняются.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { ROOT } from '../helpers/php-server.mjs';

const TOOL = join(ROOT, 'tools', 'set-site-url.mjs');
const PAGES = { 'index.html': '/', 'privacy.html': '/privacy.html', 'consent.html': '/consent.html' };

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'storage') continue;
    if (statSync(path).isDirectory()) files(path, out);
    else out.push(path);
  }
  return out;
}

function snapshot(root) {
  const map = {};
  for (const file of files(join(root, 'public'))) {
    map[relative(root, file)] = createHash('sha256').update(readFileSync(file)).digest('hex');
  }
  map['site.config.json'] = createHash('sha256').update(readFileSync(join(root, 'site.config.json'))).digest('hex');
  return map;
}

function textOfPublic(root) {
  return files(join(root, 'public'))
    .filter((f) => /\.(html|txt|xml|json|php|js|css)$/.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}

function makeCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'vsecheki-site-url-'));
  cpSync(join(ROOT, 'public'), join(dir, 'public'), { recursive: true, filter: (src) => !src.includes(`${join('public', 'storage')}`) });
  cpSync(join(ROOT, 'site.config.json'), join(dir, 'site.config.json'));
  return dir;
}

function run(root, ...args) {
  return spawnSync(process.execPath, [TOOL, ...args, '--root', root], { encoding: 'utf8' });
}

const read = (root, file) => readFileSync(join(root, 'public', file), 'utf8');
const attr = (html, re) => (html.match(re) || [])[1];
const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

function assertAbsolute(root, origin) {
  const index = read(root, 'index.html');
  assert.equal(attr(index, /<link rel="canonical" href="([^"]*)">/), `${origin}/`);
  assert.equal(attr(index, /<meta property="og:url" content="([^"]*)">/), `${origin}/`);
  assert.equal(attr(index, /<meta property="og:image" content="([^"]*)">/), `${origin}/assets/img/og-image.png`);
  const data = ld(index);
  assert.equal(data.url, `${origin}/`);
  assert.equal(data.logo, `${origin}/assets/brand/logo.svg`);
  assert.equal(data.image, `${origin}/assets/img/og-image.png`);
  for (const [page, path] of Object.entries(PAGES)) {
    const html = read(root, page);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1, `${page}: один canonical`);
    assert.equal(attr(html, /<link rel="canonical" href="([^"]*)">/), `${origin}${path}`, page);
  }
  const robots = read(root, 'robots.txt');
  assert.equal((robots.match(/^Sitemap:/gm) || []).length, 1);
  assert.match(robots, new RegExp(`^Sitemap: ${origin.replace(/[.]/g, '\\.')}/sitemap\\.xml$`, 'm'));
  assert.match(robots, /^Disallow: \/api\/$/m);
  const sitemap = read(root, 'sitemap.xml');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, Object.values(PAGES).map((p) => `${origin}${p}`));
  assert.equal(JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8')).siteUrl, origin);
  assert.doesNotMatch(textOfPublic(root), /ДОМЕН/);
}

function assertEmpty(root) {
  for (const page of Object.keys(PAGES)) {
    const html = read(root, page);
    assert.doesNotMatch(html, /rel="canonical"/, `${page}: canonical при пустом адресе`);
    assert.doesNotMatch(html, /og:url/, `${page}: og:url при пустом адресе`);
  }
  const index = read(root, 'index.html');
  assert.equal(attr(index, /<meta property="og:image" content="([^"]*)">/), '/assets/img/og-image.png');
  const data = ld(index);
  assert.equal(data.url, '/');
  assert.equal(data.logo, '/assets/brand/logo.svg');
  assert.equal(data.image, '/assets/img/og-image.png');
  assert.equal(existsSync(join(root, 'public', 'sitemap.xml')), false, 'sitemap.xml при пустом адресе');
  const robots = read(root, 'robots.txt');
  assert.doesNotMatch(robots, /Sitemap:/);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.doesNotMatch(textOfPublic(root), /ДОМЕН/);
  assert.equal(JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8')).siteUrl, '');
}

describe('npm run set-site-url', () => {
  let root;
  let before0;
  before(() => {
    before0 = snapshot(ROOT);
    root = makeCopy();
  });
  after(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    assert.deepEqual(snapshot(ROOT), before0, 'команда изменила рабочие файлы проекта');
  });

  test('npm-скрипт set-site-url вызывает tools/set-site-url.mjs', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['set-site-url'], 'node tools/set-site-url.mjs');
  });

  test('рабочие файлы: адрес пустой, заглушек ДОМЕН нет, повторный запуск ничего не меняет', () => {
    assert.equal(JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8')).siteUrl, '');
    assertEmpty(ROOT);
    const copy = makeCopy();
    try {
      const res = run(copy);
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(snapshot(copy), snapshot(ROOT));
    } finally { rmSync(copy, { recursive: true, force: true }); }
  });

  test('https://vsecheki.example → абсолютные canonical, og:url, og:image, JSON-LD, sitemap.xml и Sitemap в robots', () => {
    const res = run(root, 'https://vsecheki.example');
    assert.equal(res.status, 0, res.stderr);
    assertAbsolute(root, 'https://vsecheki.example');
  });

  test('повторный запуск с другим адресом (кириллический домен, слэш в конце) меняет его везде', () => {
    const res = run(root, 'https://Пример.рф/');
    assert.equal(res.status, 0, res.stderr);
    assertAbsolute(root, 'https://xn--e1afmkfd.xn--p1ai');
    assert.doesNotMatch(textOfPublic(root), /vsecheki\.example/);
  });

  test('неверный адрес: ошибка по-русски, файлы не меняются', () => {
    const was = snapshot(root);
    for (const bad of ['http://vsecheki.ru', 'https://vsecheki.ru/shop', 'https://vsecheki.ru/?utm=1', 'https://vsecheki.ru/#top',
      'vsecheki.ru', 'ftp://vsecheki.ru', 'https://user:pass@vsecheki.ru', 'https://localhost', 'https://ДОМЕН']) {
      const res = run(root, bad);
      assert.notEqual(res.status, 0, `${bad} принят`);
      assert.match(res.stderr, /[А-Яа-я]/, `${bad}: сообщение не по-русски`);
    }
    assert.deepEqual(snapshot(root), was);
  });

  for (const bad of ['https://a"b.ru', 'https://a%22b.ru', 'https://a&b.ru', 'https://a"b&c.ru', "https://a'b.ru", 'https://a{b}.ru', 'https://a`b.ru', 'https://a_b.ru']) {
    test(`хост с недопустимыми символами (${bad}) → код 2, файлы не меняются`, () => {
      const was = snapshot(root);
      const res = run(root, bad);
      assert.equal(res.status, 2, `${bad}: код ${res.status}`);
      assert.match(res.stderr, /[А-Яа-я]/);
      assert.deepEqual(snapshot(root), was);
      assert.equal(run(root).status, 0, 'повторный запуск после отказа ломается');
    });
  }

  test('пустой адрес возвращает сайт в исходное состояние: без canonical, og:url и sitemap', () => {
    const res = run(root, '');
    assert.equal(res.status, 0, res.stderr);
    assertEmpty(root);
    assert.deepEqual(snapshot(root), snapshot(ROOT));
  });
});
