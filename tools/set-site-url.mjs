#!/usr/bin/env node
// Адрес сайта перед публикацией: `npm run set-site-url -- https://vsecheki.ru`.
// Записывает адрес в site.config.json и проставляет его в public/:
// canonical (index, privacy, consent), og:url и og:image, url/logo/image в JSON-LD,
// строку Sitemap в robots.txt и файл sitemap.xml.
// Пустой адрес (`npm run set-site-url -- ""`) возвращает исходное состояние: без canonical,
// og:url и sitemap, картинки и логотип — корневыми путями.
// Без аргумента команда заново применяет адрес из site.config.json.
// `--root <папка>` — другая копия проекта (для тестов).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '<!-- site-url: адрес сайта проставляет npm run set-site-url (см. README) -->';
const PAGES = [
  { file: 'index.html', path: '/', og: true, changefreq: 'monthly', priority: '1.0' },
  { file: 'privacy.html', path: '/privacy.html', og: false, changefreq: 'yearly', priority: '0.3' },
  { file: 'consent.html', path: '/consent.html', og: false, changefreq: 'yearly', priority: '0.3' },
];

class UsageError extends Error {}

/** «https://пример.рф/» → «https://xn--e1afmkfd.xn--p1ai»; '' → ''; иначе UsageError. */
export function normalizeSiteUrl(input) {
  const raw = String(input ?? '').trim();
  if (raw === '') return '';
  const hint = 'Пример: npm run set-site-url -- https://vsecheki.ru';
  if (/\s/.test(raw)) throw new UsageError(`В адресе сайта не должно быть пробелов. ${hint}`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UsageError(`«${raw}» — не адрес сайта. ${hint}`);
  }
  if (url.protocol !== 'https:') throw new UsageError(`Адрес сайта должен начинаться с https:// (сейчас ${url.protocol}). ${hint}`);
  if (url.username || url.password) throw new UsageError(`В адресе сайта не должно быть логина и пароля. ${hint}`);
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '' || /[?#]/.test(raw)) {
    throw new UsageError(`Нужен адрес без пути и параметров — только домен. ${hint}`);
  }
  // Хост после punycode — только буквы, цифры и дефис по меткам: кавычки, «&», «_» и т. п. URL-парсер
  // пропускает, а они ломали бы атрибуты, JSON-LD и sitemap.xml.
  const host = url.hostname;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^[\d.]+$/.test(host)) {
    throw new UsageError(`«${raw}» — не доменное имя сайта. ${hint}`);
  }
  return url.origin;
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function replaceOnce(text, re, replacer, what) {
  let count = 0;
  const out = text.replace(re, (...m) => { count += 1; return replacer(...m); });
  if (count !== 1) throw new Error(`${what}: ожидалось одно совпадение, найдено ${count}`);
  return out;
}

function applyToPage(html, page, origin) {
  if (!html.includes(MARKER)) throw new Error(`${page.file}: нет метки ${MARKER}`);
  let out = html
    .replace(/^[ \t]*<link rel="canonical" href="[^"]*">\r?\n/gm, '')
    .replace(/^[ \t]*<meta property="og:url" content="[^"]*">\r?\n/gm, '');
  const indent = (out.match(new RegExp(`^([ \\t]*)${MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm')) || [, '  '])[1];
  if (origin) {
    out = out.replace(MARKER, `${MARKER}\n${indent}<link rel="canonical" href="${escapeAttr(origin + page.path)}">`);
  }
  if (page.og) {
    const base = origin; // '' → корневые пути
    out = replaceOnce(out, /(<meta property="og:image" content=")[^"]*(">)/g, (_, a, b) => `${a}${escapeAttr(`${base}/assets/img/og-image.png`)}${b}`, `${page.file}: og:image`);
    if (origin) {
      out = replaceOnce(out, /^([ \t]*)(<meta property="og:image" content=")/gm, (_, sp, tag) => `${sp}<meta property="og:url" content="${escapeAttr(`${origin}/`)}">\n${sp}${tag}`, `${page.file}: og:url`);
    }
    out = replaceOnce(out, /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (_, open, json, close) => {
      let body = json;
      const set = (key, value) => {
        body = replaceOnce(body, new RegExp(`("${key}":\\s*)"[^"]*"`, 'g'), (__, k) => `${k}${JSON.stringify(value)}`, `${page.file}: JSON-LD ${key}`);
      };
      set('url', `${base}/`);
      set('logo', `${base}/assets/brand/logo.svg`);
      set('image', `${base}/assets/img/og-image.png`);
      JSON.parse(body); // разметка осталась валидным JSON
      return `${open}${body}${close}`;
    }, `${page.file}: JSON-LD`);
  }
  return out;
}

function applyToRobots(text, origin) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => !/^Sitemap:/i.test(line.trim()));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (origin) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

function sitemapXml(origin) {
  const urls = PAGES.map((p) => [
    '  <url>',
    `    <loc>${escapeXml(origin + p.path)}</loc>`,
    `    <changefreq>${p.changefreq}</changefreq>`,
    `    <priority>${p.priority}</priority>`,
    '  </url>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Файл создаёт npm run set-site-url; при пустом адресе его нет. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** Проставляет адрес во всех файлах; сначала всё считает, потом пишет. */
export function setSiteUrl(root, input) {
  const configFile = join(root, 'site.config.json');
  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
  const origin = normalizeSiteUrl(input === undefined ? config.siteUrl : input);
  const pub = join(root, 'public');

  const writes = [];
  for (const page of PAGES) {
    const file = join(pub, page.file);
    writes.push([file, applyToPage(readFileSync(file, 'utf8'), page, origin)]);
  }
  const robots = join(pub, 'robots.txt');
  writes.push([robots, applyToRobots(readFileSync(robots, 'utf8'), origin)]);
  writes.push([configFile, `${JSON.stringify({ ...config, siteUrl: origin }, null, 2)}\n`]);

  for (const [file, content] of writes) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== content) writeFileSync(file, content);
  }
  const sitemap = join(pub, 'sitemap.xml');
  if (origin) {
    const xml = sitemapXml(origin);
    if (!existsSync(sitemap) || readFileSync(sitemap, 'utf8') !== xml) writeFileSync(sitemap, xml);
  } else if (existsSync(sitemap)) {
    rmSync(sitemap);
  }
  return origin;
}

function main(argv) {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') { root = resolve(argv[i + 1] || '.'); i += 1; } else rest.push(argv[i]);
  }
  if (rest.length > 1) throw new UsageError('Укажите один адрес сайта. Пример: npm run set-site-url -- https://vsecheki.ru');
  const origin = setSiteUrl(root, rest.length ? rest[0] : undefined);
  console.log(origin
    ? `Адрес сайта: ${origin}. Обновлены index.html, privacy.html, consent.html, robots.txt, sitemap.xml, site.config.json.`
    : 'Адрес сайта не задан: canonical, og:url и sitemap.xml убраны, ссылки на картинки — корневые пути.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`set-site-url: ${error.message}`);
    process.exit(error instanceof UsageError ? 2 : 1);
  }
}
