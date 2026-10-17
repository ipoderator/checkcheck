#!/usr/bin/env node
// Проверка «нет секретов в репозитории»: у ключей конфига приёма заявок
// в файлах, которые попадут в git, не должно быть непустых значений.
// Запуск: node tools/check-secrets.mjs [папка-репозитория]. Код выхода: 0 — чисто, 1 — найдено, 2 — сбой.
// Значения в отчёт не выводятся — только файл, строка и имя ключа.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname, basename, join, resolve } from 'node:path';

export const SECRET_KEYS = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'LEAD_EMAIL_TO', 'LEAD_EMAIL_FROM',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE',
];

// Расширения, где «KEY: значение» без кавычек — это значение (а не выражение кода).
const PLAIN_CONFIG_EXT = new Set(['.yml', '.yaml', '.ini', '.conf', '.cfg', '.toml', '.properties', '.txt', '']);
const MAX_SIZE = 2 * 1024 * 1024;

// Значения-подсказки в документации: <токен>, ${VAR}, $VAR, …
const PLACEHOLDER = /^(<[^>]*>|\$\{?[A-Za-z_]\w*\}?|\.\.\.|…|\[[^\]]*\])$/u;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPlainConfig(file) {
  const name = basename(file);
  if (name.startsWith('.env')) return true;
  return PLAIN_CONFIG_EXT.has(extname(name).toLowerCase());
}

function isRealValue(raw) {
  const v = raw.trim();
  if (v === '' || v === '""' || v === "''" || v === '``') return false;
  return !PLACEHOLDER.test(v);
}

/** @returns {{ line: number, key: string }[]} */
export function findLeaks(file, text) {
  const found = [];
  const lines = text.split(/\r?\n/);
  for (const key of SECRET_KEYS) {
    const k = `(?<![A-Za-z0-9_])${escapeRe(key)}(?![A-Za-z0-9_])`;
    const patterns = [
      // dotenv / shell: KEY=value, export KEY="value", а также KEY=value внутри строки (putenv, команды)
      new RegExp(`${k}=(?!=)("[^"]*"|'[^']*'|[^\\s'"\`;,)]*)`, 'g'),
      // PHP / JSON / JS / YAML с кавычками: 'KEY' => 'value', "KEY": "value", KEY: 'value'
      new RegExp(`['"]?${k}['"]?\\s*(?:=>|:|=)\\s*(?:"((?:\\\\.|[^"\\\\])*)"|'((?:\\\\.|[^'\\\\])*)'|\`([^\`]*)\`)`, 'g'),
    ];
    if (isPlainConfig(file)) {
      // YAML / ini без кавычек: KEY: value
      patterns.push(new RegExp(`^\\s*${k}\\s*:\\s*([^\\s#'"][^#]*?)\\s*$`, 'g'));
    }
    lines.forEach((line, i) => {
      for (const re of patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          const valueGroup = m.slice(1).find((g) => g !== undefined) ?? '';
          const unquoted = valueGroup.replace(/^(["'])(.*)\1$/s, '$2');
          if (isRealValue(unquoted)) {
            found.push({ line: i + 1, key });
            return;
          }
          if (m[0].length === 0) re.lastIndex += 1;
        }
      }
    });
  }
  return found;
}

function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(out.split('\0').filter(Boolean))];
}

export function checkRepo(root) {
  const leaks = [];
  for (const rel of listFiles(root)) {
    const abs = join(root, rel);
    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (!stat.isFile() || stat.size > MAX_SIZE) continue;
    const buf = readFileSync(abs);
    if (buf.includes(0)) continue; // двоичный файл
    for (const leak of findLeaks(rel, buf.toString('utf8'))) leaks.push({ file: rel, ...leak });
  }
  return leaks;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const root = resolve(process.argv[2] || process.cwd());
  let leaks;
  try {
    leaks = checkRepo(root);
  } catch (err) {
    console.error(`check-secrets: не удалось проверить ${root}: ${err.message}`);
    process.exit(2);
  }
  if (leaks.length) {
    console.error('check-secrets: найдены непустые значения ключей конфига (значения не показаны):');
    for (const l of leaks) console.error(`  ${l.file}:${l.line} — ${l.key}`);
    console.error('Секреты задаются только на сервере: переменные окружения или public/app/config.php (в .gitignore).');
    process.exit(1);
  }
  console.log('check-secrets: ок — непустых значений ключей конфига нет');
}
