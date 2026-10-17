// Доставка заявки: Telegram (поддельный Bot API), e-mail (file / smtp / mail), частичный и полный сбой.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPhpServer, postLead, validLead, freePort } from '../helpers/php-server.mjs';
import { startFakeTelegram } from '../helpers/fake-telegram.mjs';
import { startFakeSmtp } from '../helpers/fake-smtp.mjs';
import { parseMail, decodeHeader } from '../helpers/mail.mjs';

// Поддельные значения собираются в рантайме: в репозитории нет литералов секретов.
const LOCALHOST = ['127', '0', '0', '1'].join('.');
const fake = {
  token: ['123456', 'TEST-token'].join(':'),
  chat: ['-100', '42'].join(''),
  owner: ['owner', 'example.test'].join('@'),
  sender: ['site', 'example.test'].join('@'),
  smtpUser: ['mailer', 'example.test'].join('@'),
  smtpPass: ['pass', 'word', '1'].join('-'),
};

function telegramEnv(tg) {
  return { TELEGRAM_BOT_TOKEN: fake.token, TELEGRAM_CHAT_ID: fake.chat, TELEGRAM_API_BASE: tg.base };
}

function moscowStamp(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

const fullLead = () => validLead({
  name: 'Иван <b>Петров</b> & Co',
  email: 'client@example.test',
  company: 'ООО «Касса»',
  region: 'Липецкая область',
  format: 'other',
  format_custom: '57 × 30',
  quantity: '5 коробок',
  message: 'Первая строка\nВторая строка',
  page: '/#price',
});

describe('Telegram', () => {
  test('настроен только Telegram: одно сообщение sendMessage со всеми заполненными полями → 200', async () => {
    const tg = await startFakeTelegram();
    const srv = await startPhpServer({ env: telegramEnv(tg) });
    try {
      const before = new Date();
      const res = await postLead(srv.baseUrl, fullLead());
      const afterDate = new Date();
      assert.equal(res.status, 200, res.text);
      assert.deepEqual(res.body, { ok: true });
      assert.equal(tg.requests.length, 1);
      const [req] = tg.requests;
      assert.equal(req.method, 'POST');
      assert.equal(req.url, `/bot${fake.token}/sendMessage`);
      assert.equal(String(req.body.chat_id), fake.chat);
      assert.equal(req.body.parse_mode, 'HTML');
      const text = req.body.text;
      for (const piece of [
        'Рассчитать цену', '+79202431957', 'client@example.test', 'ООО «Касса»', 'Липецкая область',
        '57 × 30', '5 коробок', 'Первая строка\nВторая строка', '/#price',
      ]) {
        assert.ok(text.includes(piece), `в сообщении нет «${piece}»:\n${text}`);
      }
      assert.ok(text.includes('Иван &lt;b&gt;Петров&lt;/b&gt; &amp; Co'), `имя не экранировано:\n${text}`);
      assert.ok(!text.includes('<b>Петров</b>'));
      const stamps = [moscowStamp(before), moscowStamp(afterDate)];
      assert.ok(stamps.some((s) => text.includes(s)), `нет времени по Москве (${stamps.join(' / ')}):\n${text}`);
      assert.match(text, /МСК|Москв/);
      assert.equal(srv.outbox().length, 0, 'e-mail не настроен, писем быть не должно');
    } finally { await srv.stop(); await tg.close(); }
  });

  test('незаполненные поля в сообщение не попадают; partner без формата', async () => {
    const tg = await startFakeTelegram();
    const srv = await startPhpServer({ env: telegramEnv(tg) });
    try {
      const res = await postLead(srv.baseUrl, validLead({ type: 'partner', format: '57x40', quantity: '10' }));
      assert.equal(res.status, 200, res.text);
      const { text } = tg.requests[0].body;
      assert.ok(text.includes('Сотрудничество'));
      assert.ok(!text.includes('Рассчитать цену'));
      assert.ok(!text.includes('57 × 40'), 'формат у партнёрской заявки');
      assert.ok(!/Компания|E-mail|Регион|Комментарий/.test(text), `пустые поля в сообщении:\n${text}`);
    } finally { await srv.stop(); await tg.close(); }
  });

  test('без расширения curl сообщение уходит через потоки', async () => {
    const tg = await startFakeTelegram();
    const srv = await startPhpServer({ env: telegramEnv(tg), ini: { disable_functions: 'curl_init,curl_exec,curl_setopt_array' } });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 200, res.text + srv.log());
      assert.equal(tg.requests.length, 1);
      assert.ok(tg.requests[0].body.text.includes('+79202431957'));
    } finally { await srv.stop(); await tg.close(); }
  });

  test('слишком быстрая отправка и ловушка ничего не шлют в Telegram', async () => {
    const tg = await startFakeTelegram();
    const srv = await startPhpServer({ env: telegramEnv(tg) });
    try {
      assert.equal((await postLead(srv.baseUrl, validLead({ form_elapsed_ms: '500' }))).status, 200);
      assert.equal((await postLead(srv.baseUrl, validLead({ website: 'bot' }))).status, 200);
      assert.equal(tg.requests.length, 0);
    } finally { await srv.stop(); await tg.close(); }
  });
});

describe('E-mail', () => {
  test('настроен только e-mail (file): письмо UTF-8, тема в base64, Reply-To клиента → 200', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: fake.owner, LEAD_EMAIL_FROM: fake.sender } });
    try {
      const res = await postLead(srv.baseUrl, fullLead());
      assert.equal(res.status, 200, res.text);
      const mails = srv.outbox();
      assert.equal(mails.length, 1);
      const mail = parseMail(mails[0]);
      assert.match(mail.headers.subject, /^=\?UTF-8\?B\?/);
      assert.equal(decodeHeader(mail.headers.subject), 'Заявка с сайта: Рассчитать цену — Иван <b>Петров</b> & Co');
      assert.ok(mail.headers.to.includes(fake.owner));
      assert.ok(mail.headers.from.includes(fake.sender));
      assert.equal(mail.headers['reply-to'], 'client@example.test');
      assert.match(mail.headers['content-type'], /text\/plain;\s*charset=UTF-8/i);
      for (const piece of ['+79202431957', 'ООО «Касса»', 'Липецкая область', '57 × 30', '5 коробок', 'Вторая строка', '/#price']) {
        assert.ok(mail.body.includes(piece), `в письме нет «${piece}»`);
      }
    } finally { await srv.stop(); }
  });

  test('без e-mail клиента заголовка Reply-To нет', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: fake.owner } });
    try {
      assert.equal((await postLead(srv.baseUrl, validLead())).status, 200);
      const mail = parseMail(srv.outbox()[0]);
      assert.equal(mail.headers['reply-to'], undefined);
    } finally { await srv.stop(); }
  });

  test('SMTP: EHLO → AUTH LOGIN → MAIL/RCPT/DATA → QUIT', async () => {
    const smtp = await startFakeSmtp({ user: fake.smtpUser, password: fake.smtpPass });
    const srv = await startPhpServer({
      env: {
        MAIL_TRANSPORT: '', LEAD_EMAIL_TO: fake.owner, SMTP_HOST: LOCALHOST, SMTP_PORT: String(smtp.port),
        SMTP_USER: fake.smtpUser, SMTP_PASSWORD: fake.smtpPass,
      },
    });
    try {
      const res = await postLead(srv.baseUrl, validLead({ email: 'client@example.test' }));
      assert.equal(res.status, 200, res.text + srv.log());
      assert.equal(smtp.sessions.length, 1);
      const [s] = smtp.sessions;
      assert.deepEqual(s.auth, { user: fake.smtpUser, ok: true });
      assert.deepEqual(s.commands.filter((c) => c !== 'RSET'), ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);
      assert.equal(s.from, `<${fake.smtpUser}>`);
      assert.deepEqual(s.rcpt, [`<${fake.owner}>`]);
      const mail = parseMail(s.data);
      assert.equal(decodeHeader(mail.headers.subject), 'Заявка с сайта: Рассчитать цену — Иван Петров');
      assert.equal(mail.headers['reply-to'], 'client@example.test');
      assert.ok(mail.body.includes('+79202431957'));
      assert.ok(!srv.log().includes(fake.smtpPass));
    } finally { await srv.stop(); await smtp.close(); }
  });

  // Хост не 127.0.0.1 и не localhost, но тоже петля: поддельный сервер слушает IPv6 ::1.
  const IPV6_LOOPBACK = '::1';

  test('SMTP с логином без SMTP_SECURE на нелокальном хосте без STARTTLS: AUTH не отправляется, 502, понятный лог', async () => {
    const smtp = await startFakeSmtp({ user: fake.smtpUser, password: fake.smtpPass, host: IPV6_LOOPBACK });
    const srv = await startPhpServer({
      env: {
        MAIL_TRANSPORT: 'smtp', LEAD_EMAIL_TO: fake.owner, SMTP_HOST: IPV6_LOOPBACK, SMTP_PORT: String(smtp.port),
        SMTP_USER: fake.smtpUser, SMTP_PASSWORD: fake.smtpPass,
      },
    });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 502, res.text + srv.log());
      assert.equal(smtp.sessions.length, 1, 'клиент не подключился');
      assert.ok(!smtp.sessions[0].commands.includes('AUTH'), `AUTH ушёл открытым текстом: ${smtp.sessions[0].commands}`);
      assert.equal(smtp.sessions[0].auth, null);
      await new Promise((r) => setTimeout(r, 50));
      const log = srv.log();
      assert.match(log, /SMTP.*(TLS|шифр)/i, log);
      assert.ok(!log.includes(fake.smtpPass), 'пароль в логе');
    } finally { await srv.stop(); await smtp.close(); }
  });

  test('SMTP с логином без SMTP_SECURE: сервер объявил STARTTLS → клиент включает его до AUTH', async () => {
    const smtp = await startFakeSmtp({ user: fake.smtpUser, password: fake.smtpPass, host: IPV6_LOOPBACK, starttls: true });
    const srv = await startPhpServer({
      env: {
        MAIL_TRANSPORT: 'smtp', LEAD_EMAIL_TO: fake.owner, SMTP_HOST: IPV6_LOOPBACK, SMTP_PORT: String(smtp.port),
        SMTP_USER: fake.smtpUser, SMTP_PASSWORD: fake.smtpPass,
      },
    });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      // У подделки нет TLS (отвечает 454), поэтому доставка падает — важно, что STARTTLS был, а AUTH нет.
      assert.equal(res.status, 502, res.text + srv.log());
      const { commands } = smtp.sessions[0];
      assert.ok(commands.includes('STARTTLS'), `STARTTLS не отправлен: ${commands}`);
      assert.ok(!commands.includes('AUTH'), `AUTH ушёл открытым текстом: ${commands}`);
      assert.ok(!srv.log().includes(fake.smtpPass), 'пароль в логе');
    } finally { await srv.stop(); await smtp.close(); }
  });

  test('mail(): без SMTP_HOST письмо уходит через sendmail хостинга', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vsecheki-sendmail-'));
    const captured = join(dir, 'mail.eml');
    const srv = await startPhpServer({
      env: { MAIL_TRANSPORT: '', LEAD_EMAIL_TO: fake.owner },
      ini: { sendmail_path: `"cat > ${captured}"` },
    });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 200, res.text + srv.log());
      assert.ok(existsSync(captured), 'sendmail не вызван');
      const mail = parseMail(readFileSync(captured, 'utf8'));
      assert.equal(decodeHeader(mail.headers.subject), 'Заявка с сайта: Рассчитать цену — Иван Петров');
      assert.ok(mail.headers.to.includes(fake.owner));
      assert.ok(mail.body.includes('+79202431957'));
    } finally { await srv.stop(); rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('частичный и полный сбой', () => {
  test('оба настроены, Telegram падает → 200, письмо ушло, в лог без персональных данных', async () => {
    const tg = await startFakeTelegram({ status: 500 });
    const srv = await startPhpServer({ env: { ...telegramEnv(tg), LEAD_EMAIL_TO: fake.owner } });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 200, res.text);
      assert.deepEqual(res.body, { ok: true });
      assert.equal(tg.requests.length, 1);
      assert.equal(srv.outbox().length, 1);
      assert.deepEqual(srv.failedLeads(), []);
      await new Promise((r) => setTimeout(r, 50));
      const log = srv.log();
      assert.match(log, /telegram/i);
      for (const secret of ['Иван', '9202431957', fake.token]) assert.ok(!log.includes(secret), `в логе «${secret}»`);
    } finally { await srv.stop(); await tg.close(); }
  });

  test('оба настроены, почта падает → 200, Telegram доставил', async () => {
    const tg = await startFakeTelegram();
    const closedPort = await freePort();
    const srv = await startPhpServer({
      env: { ...telegramEnv(tg), LEAD_EMAIL_TO: fake.owner, MAIL_TRANSPORT: 'smtp', SMTP_HOST: LOCALHOST, SMTP_PORT: String(closedPort) },
    });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 200, res.text);
      assert.equal(tg.requests.length, 1);
      assert.deepEqual(srv.failedLeads(), []);
    } finally { await srv.stop(); await tg.close(); }
  });

  test('оба падают → 502 delivery_failed и строка в failed-leads.jsonl', async () => {
    const tg = await startFakeTelegram({ status: 502 });
    const smtp = await startFakeSmtp({ rejectData: true });
    const srv = await startPhpServer({
      env: { ...telegramEnv(tg), LEAD_EMAIL_TO: fake.owner, MAIL_TRANSPORT: 'smtp', SMTP_HOST: LOCALHOST, SMTP_PORT: String(smtp.port) },
    });
    try {
      const res = await postLead(srv.baseUrl, validLead({ email: 'client@example.test' }));
      assert.equal(res.status, 502, res.text);
      assert.deepEqual(res.body, { ok: false, code: 'delivery_failed' });
      const failed = srv.failedLeads();
      assert.equal(failed.length, 1);
      const line = JSON.stringify(failed[0]);
      for (const piece of ['Иван Петров', '+79202431957', 'client@example.test', 'Рассчитать цену']) {
        assert.ok(line.includes(piece), `в резервной записи нет «${piece}»`);
      }
      const second = await postLead(srv.baseUrl, validLead({ name: 'Пётр' }));
      assert.equal(second.status, 502);
      assert.equal(srv.failedLeads().length, 2, 'записи дописываются, а не перезаписываются');
    } finally { await srv.stop(); await tg.close(); await smtp.close(); }
  });
});

describe('без mbstring', () => {
  test('длина имени в символах, а не байтах; заявка доставляется', async () => {
    const srv = await startPhpServer({
      env: { LEAD_EMAIL_TO: fake.owner },
      ini: { disable_functions: 'mb_strlen,mb_substr,mb_convert_encoding,mb_substitute_character,mb_str_split,mb_encode_mimeheader' },
    });
    try {
      const tooLong = await postLead(srv.baseUrl, validLead({ name: 'Ж'.repeat(101) }));
      assert.equal(tooLong.status, 422);
      assert.ok(tooLong.body.errors.name);
      const ok = await postLead(srv.baseUrl, validLead({ name: 'Ж'.repeat(100) }));
      assert.equal(ok.status, 200, ok.text + srv.log());
      const mail = parseMail(srv.outbox()[0]);
      assert.equal(decodeHeader(mail.headers.subject), `Заявка с сайта: Рассчитать цену — ${'Ж'.repeat(100)}`);
    } finally { await srv.stop(); }
  });
});
