// Конфиг (env важнее app/config.php), шаблоны без значений, закрытые app/ и storage/.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startPhpServer, postLead, validLead, ROOT, PUBLIC_DIR, PHP } from '../helpers/php-server.mjs';
import { startFakeTelegram } from '../helpers/fake-telegram.mjs';
import { parseMail } from '../helpers/mail.mjs';

const KEYS = [
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'LEAD_EMAIL_TO', 'LEAD_EMAIL_FROM',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE',
];

const fileOwner = ['from-file', 'example.test'].join('@');
const envOwner = ['from-env', 'example.test'].join('@');

/** app/config.php из объекта; значения подставляются в рантайме. */
function phpConfig(values) {
  const rows = Object.entries(values).map(([k, v]) => `  '${k}' => ${JSON.stringify(String(v)).replace(/\$/g, '\\$')},`);
  return `<?php\nreturn [\n${rows.join('\n')}\n];\n`;
}

describe('источник настроек', () => {
  test('app/config.php работает сам по себе', async () => {
    const tg = await startFakeTelegram();
    const token = ['777', 'file-token'].join(':');
    const srv = await startPhpServer({
      configPhp: phpConfig({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: String(5), TELEGRAM_API_BASE: tg.base }),
    });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 200, res.text + srv.log());
      assert.equal(tg.requests.length, 1);
      assert.equal(tg.requests[0].url, `/bot${token}/sendMessage`);
    } finally { await srv.stop(); await tg.close(); }
  });

  test('переменная окружения важнее app/config.php', async () => {
    const srv = await startPhpServer({
      configPhp: phpConfig({ LEAD_EMAIL_TO: fileOwner }),
      env: { LEAD_EMAIL_TO: envOwner },
    });
    try {
      assert.equal((await postLead(srv.baseUrl, validLead())).status, 200);
      const mail = parseMail(srv.outbox()[0]);
      assert.equal(mail.headers.to, envOwner);
    } finally { await srv.stop(); }
  });

  test('пустая переменная окружения не затирает значение из app/config.php', async () => {
    const srv = await startPhpServer({
      configPhp: phpConfig({ LEAD_EMAIL_TO: fileOwner }),
      env: { LEAD_EMAIL_TO: '' },
    });
    try {
      assert.equal((await postLead(srv.baseUrl, validLead())).status, 200);
      assert.equal(parseMail(srv.outbox()[0]).headers.to, fileOwner);
    } finally { await srv.stop(); }
  });
});

describe('шаблоны конфига', () => {
  test('config.example.php возвращает все ключи с пустыми значениями', () => {
    const file = join(PUBLIC_DIR, 'app', 'config.example.php');
    const out = execFileSync(PHP, ['-r', `define('VSECHEKI_APP', true); echo json_encode(include $argv[1]);`, file], { encoding: 'utf8' });
    const config = JSON.parse(out);
    for (const key of KEYS) {
      assert.ok(key in config, `нет ключа ${key}`);
      assert.equal(config[key], '', `${key} не пустой`);
    }
  });

  test('.env.example перечисляет все ключи с пустыми значениями', () => {
    const lines = readFileSync(join(ROOT, '.env.example'), 'utf8').split('\n');
    for (const key of KEYS) {
      const line = lines.find((l) => l.startsWith(`${key}=`));
      assert.ok(line, `нет ${key} в .env.example`);
      assert.equal(line, `${key}=`);
    }
  });

  test('.gitignore исключает рабочий конфиг, .env и содержимое storage', () => {
    const files = ['public/app/config.php', '.env', 'public/storage/failed-leads.jsonl', 'public/storage/ratelimit/x.json'];
    for (const file of files) {
      const out = execFileSync('git', ['check-ignore', '--no-index', file], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(out.trim(), file);
    }
    for (const file of ['.env.example', 'public/storage/.htaccess', 'public/app/config.example.php']) {
      assert.throws(() => execFileSync('git', ['check-ignore', '--no-index', file], { cwd: ROOT, stdio: 'pipe' }), `${file} не должен игнорироваться`);
    }
  });
});

describe('закрытые папки', () => {
  test('app/ и storage/ закрыты .htaccess (Require all denied)', () => {
    for (const dir of ['app', 'storage']) {
      const htaccess = readFileSync(join(PUBLIC_DIR, dir, '.htaccess'), 'utf8');
      assert.match(htaccess, /^\s*Require all denied\s*$/m, `${dir}/.htaccess`);
    }
  });

  test('прямой запрос к любому app/*.php ничего не исполняет: 404 и пустое тело', async () => {
    const srv = await startPhpServer();
    try {
      const files = readdirSync(join(PUBLIC_DIR, 'app')).filter((f) => f.endsWith('.php'));
      assert.ok(files.length >= 8);
      for (const file of files) {
        const res = await fetch(`${srv.baseUrl}/app/${file}`);
        const body = await res.text();
        assert.equal(res.status, 404, file);
        assert.equal(body, '', `${file} что-то вывел`);
      }
      assert.ok(!/Fatal|Warning|Notice/.test(srv.log()), srv.log());
    } finally { await srv.stop(); }
  });

  test('public/.htaccess: 404-страница, без листинга каталогов, служебные файлы закрыты', () => {
    const htaccess = readFileSync(join(PUBLIC_DIR, '.htaccess'), 'utf8');
    assert.match(htaccess, /ErrorDocument 404 \/404\.html/);
    assert.match(htaccess, /Options -Indexes/);
    assert.ok(existsSync(join(PUBLIC_DIR, 'storage', '.htaccess')));
  });
});
