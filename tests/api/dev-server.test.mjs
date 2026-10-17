// `npm run dev`: локальный сервер не отдаёт библиотеку (app/) и хранилище (storage/),
// как и .htaccess на хостинге; сайт и api/lead.php работают как обычно.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, PHP, freePort, postLead, validLead } from '../helpers/php-server.mjs';

const CONFIG_KEYS = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'LEAD_EMAIL_TO', 'LEAD_EMAIL_FROM',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE',
  'TELEGRAM_API_BASE', 'MAIL_TRANSPORT', 'STORAGE_DIR',
];

let child;
let base;
let storageDir;

before(async () => {
  const script = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts.dev;
  const [bin, ...args] = script.trim().split(/\s+/);
  assert.equal(bin, 'php', `npm run dev: ${script}`);
  const port = await freePort();
  const hostArg = args.findIndex((a) => /^127\.0\.0\.1:\d+$/.test(a));
  assert.ok(hostArg >= 0, `npm run dev без адреса 127.0.0.1:порт: ${script}`);
  args[hostArg] = `127.0.0.1:${port}`;

  storageDir = mkdtempSync(join(tmpdir(), 'vsecheki-dev-'));
  const env = { ...process.env };
  for (const key of CONFIG_KEYS) delete env[key];
  Object.assign(env, { MAIL_TRANSPORT: 'file', STORAGE_DIR: storageDir, TELEGRAM_API_BASE: 'http://127.0.0.1:9' });
  child = spawn(PHP, args, { cwd: ROOT, env, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  const started = Date.now();
  for (;;) {
    if (child.exitCode !== null) throw new Error(`npm run dev завершился с кодом ${child.exitCode}`);
    try { await fetch(`${base}/robots.txt`); break; } catch {
      if (Date.now() - started > 5000) throw new Error('npm run dev не поднялся');
      await new Promise((r) => setTimeout(r, 40));
    }
  }
});

after(async () => {
  if (child && child.exitCode === null) await new Promise((r) => { child.once('exit', r); child.kill(); });
  if (storageDir) rmSync(storageDir, { recursive: true, force: true });
});

const raw = (path) => fetch(base + path, { redirect: 'manual' });

for (const path of [
  '/app/', '/app/config.example.php', '/app/ConfigLoader.php', '/app/.htaccess',
  '/storage/', '/storage/ratelimit/', '/storage/.htaccess',
  '/App/ConfigLoader.php', '/%61pp/ConfigLoader.php', '//app/ConfigLoader.php',
  '/assets/../app/ConfigLoader.php', '/api/%2E%2E/app/ConfigLoader.php', '/STORAGE/',
]) {
  test(`GET ${path} → 403`, async () => {
    const res = await raw(path);
    assert.equal(res.status, 403);
    const body = await res.text();
    assert.doesNotMatch(body, /<\?php|VSECHEKI_APP/);
  });
}

test('страницы и статика отдаются как обычно', async () => {
  for (const path of ['/', '/privacy.html', '/assets/css/main.css', '/assets/js/lead-form.js']) {
    assert.equal((await raw(path)).status, 200, path);
  }
});

test('api/lead.php работает через тот же сервер (пустой конфиг → 503)', async () => {
  const res = await postLead(base, validLead());
  assert.equal(res.status, 503, res.text);
  assert.deepEqual(res.body, { ok: false, code: 'not_configured' });
});
