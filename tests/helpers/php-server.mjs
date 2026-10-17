// Запуск встроенного PHP-сервера для тестов HTTP-контракта lead.php.
// Каждый сервер получает свой порт и свою временную папку STORAGE_DIR,
// поэтому тесты не делят лимит частоты и резервные файлы.
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PUBLIC_DIR = join(ROOT, 'public');
export const PHP = process.env.PHP_BIN || 'php';

// Ключи конфига, которые не должны протекать в тесты из окружения разработчика.
const CONFIG_KEYS = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'LEAD_EMAIL_TO', 'LEAD_EMAIL_FROM',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE',
  'TELEGRAM_API_BASE', 'MAIL_TRANSPORT', 'STORAGE_DIR',
];

export function freePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
}

async function waitForPort(port, child, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`php -S завершился с кодом ${child.exitCode}`);
    try {
      await fetch(`http://127.0.0.1:${port}/__ping__`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  throw new Error('php -S не поднялся за отведённое время');
}

/**
 * @param {object} opts
 * @param {Record<string,string>} [opts.env]      переменные окружения для PHP (ключи конфига)
 * @param {Record<string,string>} [opts.ini]      директивы php.ini (-d)
 * @param {string} [opts.configPhp]               содержимое app/config.php; при нём public/ копируется во временную папку
 */
export async function startPhpServer({ env = {}, ini = {}, configPhp } = {}) {
  const storageDir = mkdtempSync(join(tmpdir(), 'vsecheki-storage-'));
  let docroot = PUBLIC_DIR;
  if (configPhp !== undefined) {
    docroot = mkdtempSync(join(tmpdir(), 'vsecheki-public-'));
    cpSync(join(PUBLIC_DIR, 'api'), join(docroot, 'api'), { recursive: true });
    cpSync(join(PUBLIC_DIR, 'app'), join(docroot, 'app'), { recursive: true });
    writeFileSync(join(docroot, 'app', 'config.php'), configPhp);
  }

  const baseEnv = { ...process.env };
  for (const key of CONFIG_KEYS) delete baseEnv[key];
  const childEnv = { ...baseEnv, MAIL_TRANSPORT: 'file', STORAGE_DIR: storageDir, ...env };

  const port = await freePort();
  const args = [];
  for (const [k, v] of Object.entries(ini)) args.push('-d', `${k}=${v}`);
  args.push('-S', `127.0.0.1:${port}`, '-t', docroot);
  const child = spawn(PHP, args, { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  await waitForPort(port, child);

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    storageDir,
    docroot,
    log: () => log,
    outbox() {
      const dir = join(storageDir, 'outbox');
      if (!existsSync(dir)) return [];
      return readdirSync(dir).sort().map((f) => readFileSync(join(dir, f), 'utf8'));
    },
    failedLeads() {
      const file = join(storageDir, 'failed-leads.jsonl');
      if (!existsSync(file)) return [];
      return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
    async stop() {
      if (child.exitCode === null) {
        await new Promise((r) => { child.once('exit', r); child.kill(); });
      }
      rmSync(storageDir, { recursive: true, force: true });
      if (docroot !== PUBLIC_DIR) rmSync(docroot, { recursive: true, force: true });
    },
  };
}

/** Корректная заявка «Рассчитать цену»; браузер намерил 10 с с готовности формы. */
export function validLead(overrides = {}) {
  return {
    type: 'price',
    name: 'Иван Петров',
    phone: '8 (920) 243-19-57',
    email: '',
    company: '',
    region: '',
    format: '57x40',
    format_custom: '',
    quantity: '200 рулонов',
    message: '',
    consent: '1',
    website: '',
    form_elapsed_ms: '10000',
    page: '/',
    ...overrides,
  };
}

/** POST заявки на /api/lead.php; поля со значением undefined не отправляются. Возвращает { status, headers, body, text }. */
export async function postLead(baseUrl, rawFields, { method = 'POST', encoding = 'urlencoded', headers = {} } = {}) {
  const fields = rawFields === undefined ? undefined
    : Object.fromEntries(Object.entries(rawFields).filter(([, v]) => v !== undefined));
  const init = { method, headers: { Accept: 'application/json', ...headers } };
  if (method !== 'GET' && method !== 'HEAD' && fields !== undefined) {
    if (encoding === 'multipart') {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      init.body = fd;
    } else if (encoding === 'json') {
      init.body = JSON.stringify(fields);
      init.headers['Content-Type'] = 'application/json';
    } else {
      init.body = new URLSearchParams(fields).toString();
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }
  const res = await fetch(`${baseUrl}/api/lead.php`, init);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = undefined; }
  return { status: res.status, headers: res.headers, body, text };
}
