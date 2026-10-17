// tools/check-secrets.mjs: падает, если у ключа конфига в отслеживаемом файле есть непустое значение.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../helpers/php-server.mjs';

const TOOL = join(ROOT, 'tools', 'check-secrets.mjs');
// Имена ключей собираются из частей, чтобы этот файл сам не выглядел как конфиг.
const key = (...parts) => parts.join('_');
const TOKEN = key('TELEGRAM', 'BOT', 'TOKEN');
const CHAT = key('TELEGRAM', 'CHAT', 'ID');
const PASSWORD = key('SMTP', 'PASSWORD');
const MAIL_TO = key('LEAD', 'EMAIL', 'TO');
const value = ['12345', 'AAH-not-real'].join(':');

function repoWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'vsecheki-secrets-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

function run(dir) {
  const res = spawnSync(process.execPath, [TOOL, dir], { encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
}

describe('check-secrets', () => {
  test('текущий репозиторий чист', () => {
    const res = run(ROOT);
    assert.equal(res.code, 0, res.out);
  });

  test('пустые значения во всех форматах — ок', () => {
    const dir = repoWith({
      '.env.example': `${TOKEN}=\n${CHAT}=\n`,
      'app/config.php': `<?php return ['${TOKEN}' => '', "${PASSWORD}" => ""];`,
      'settings.json': JSON.stringify({ [MAIL_TO]: '' }),
      'code.mjs': `const env = { ${TOKEN}: fake.token, ${CHAT}: process.env.X };\ngetenv('${TOKEN}');`,
      'README.md': `Заполните \`${TOKEN}=\` и ${PASSWORD}=<пароль> на хостинге.`,
    });
    try {
      const res = run(dir);
      assert.equal(res.code, 0, res.out);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  const leaks = {
    dotenv: { '.env.production.example': `${TOKEN}=${value}\n` },
    'export в shell': { 'deploy.sh': `export ${PASSWORD}="s3cr3t"\n` },
    'массив PHP': { 'public/app/config.php': `<?php return ['${TOKEN}' => '${value}'];` },
    JSON: { 'cfg.json': JSON.stringify({ [CHAT]: '-100500' }) },
    'объект JS': { 'tests/x.mjs': `startServer({ ${PASSWORD}: 'hunter2' });` },
    YAML: { '.github/workflows/ci.yml': `env:\n  ${MAIL_TO}: owner@example.ru\n` },
    'putenv в PHP': { 'a.php': `<?php putenv('${TOKEN}=${value}');` },
    'команда в README': { 'README.md': `Запуск: ${CHAT}=12345 npm run dev` },
  };
  for (const [label, files] of Object.entries(leaks)) {
    test(`непустое значение (${label}) → код выхода 1 и имя файла в отчёте, без значения`, () => {
      const dir = repoWith(files);
      try {
        const res = run(dir);
        assert.equal(res.code, 1, res.out);
        assert.ok(res.out.includes(Object.keys(files)[0]), res.out);
        for (const secret of [value, 's3cr3t', 'hunter2', '-100500', 'owner@example.ru']) {
          assert.ok(!res.out.includes(secret), `отчёт раскрыл значение: ${res.out}`);
        }
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }

  test('файлы из .gitignore не проверяются', () => {
    const dir = repoWith({ '.gitignore': '.env\n' });
    writeFileSync(join(dir, '.env'), `${TOKEN}=${value}\n`);
    try {
      const res = run(dir);
      assert.equal(res.code, 0, res.out);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test('новый, ещё не добавленный в git файл проверяется', () => {
    const dir = repoWith({ 'a.txt': 'ok' });
    writeFileSync(join(dir, 'new.php'), `<?php return ['${PASSWORD}' => 'x'];`);
    try {
      assert.equal(run(dir).code, 1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
