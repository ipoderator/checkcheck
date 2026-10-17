// HTTP-контракт POST /api/lead.php: коды ответов, порядок проверок, валидация полей.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { startPhpServer, postLead, validLead } from '../helpers/php-server.mjs';

const JSON_TYPE = 'application/json; charset=utf-8';
const FAKE_TOKEN = ['fake', 'token'].join('-');
const OWNER = ['owner', 'example.test'].join('@');
const FAKE_CHAT = ['-100', '1'].join('');
// Порт 9 (discard) на loopback: соединение отклоняется, настоящий Telegram не участвует.
const DEAD_TELEGRAM = ['http://127.0.0.1', '9'].join(':');

describe('метод и тип тела', () => {
  let srv;
  before(async () => { srv = await startPhpServer(); });
  after(() => srv.stop());

  test('GET → 405 method_not_allowed', async () => {
    const res = await postLead(srv.baseUrl, undefined, { method: 'GET' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('content-type'), JSON_TYPE);
    assert.deepEqual(res.body, { ok: false, code: 'method_not_allowed' });
  });

  test('PUT с корректной заявкой всё равно 405', async () => {
    const res = await postLead(srv.baseUrl, validLead(), { method: 'PUT' });
    assert.equal(res.status, 405);
    assert.equal(res.body.code, 'method_not_allowed');
  });

  test('POST с JSON-телом → 400 bad_request', async () => {
    const res = await postLead(srv.baseUrl, validLead(), { encoding: 'json' });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('content-type'), JSON_TYPE);
    assert.deepEqual(res.body, { ok: false, code: 'bad_request' });
  });

  test('Accept: application/json, */* — JSON-контракт для скрипта формы прежний', async () => {
    const res = await postLead(srv.baseUrl, validLead({ phone: '' }), { headers: { Accept: 'application/json, text/plain, */*' } });
    assert.equal(res.status, 422);
    assert.equal(res.headers.get('content-type'), JSON_TYPE);
    assert.equal(res.body.code, 'validation');
  });
});

describe('форма без JS: ответ — страница для человека, а не JSON', () => {
  let srv;
  before(async () => { srv = await startPhpServer(); });
  after(() => srv.stop());

  const HTML_TYPE = 'text/html; charset=utf-8';
  function assertPage(res) {
    assert.equal(res.headers.get('content-type'), HTML_TYPE);
    assert.match(res.text, /^<!doctype html>/i);
    assert.match(res.text, /<html lang="ru">/);
    assert.match(res.text, /<a[^>]+href="[^"]*#order"[^>]*>Вернуться к(?:&nbsp;|\s)форме<\/a>/);
    assert.equal(res.body, undefined, 'тело не JSON');
  }

  test('ошибки полей (браузер шлёт Accept: text/html) → 422 и список ошибок по-русски, ввод экранирован', async () => {
    const res = await postLead(srv.baseUrl, validLead({ phone: '', name: '<script>x</script>', format: 'other', format_custom: '' }),
      { headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } });
    assert.equal(res.status, 422);
    assertPage(res);
    assert.match(res.text, /Заявка не(?:&nbsp;|\s)отправлена/);
    assert.match(res.text, /Телефон/);
    assert.match(res.text, /Укажите телефон\./);
    assert.match(res.text, /Нужный размер/);
    assert.doesNotMatch(res.text, /<script>x<\/script>/);
  });

  test('без заголовка Accept и без каналов → 503 страница «форма пока не подключена» с телефоном', async () => {
    const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: undefined }), { headers: { Accept: '' } });
    assert.equal(res.status, 503);
    assertPage(res);
    assert.match(res.text, /Форма пока не(?:&nbsp;|\s)подключена/);
    assert.match(res.text, /tel:\+79202431957/);
  });

  test('принятая заявка → 200 страница «Заявка принята»', async () => {
    const mailSrv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const res = await postLead(mailSrv.baseUrl, validLead({ form_elapsed_ms: undefined }), { headers: { Accept: 'text/html' } });
      assert.equal(res.status, 200);
      assertPage(res);
      assert.match(res.text, /Заявка принята/);
      assert.equal(mailSrv.outbox().length, 1);
    } finally { await mailSrv.stop(); }
  });

  test('GET без Accept: application/json → 405 страница', async () => {
    const res = await postLead(srv.baseUrl, undefined, { method: 'GET', headers: { Accept: 'text/html' } });
    assert.equal(res.status, 405);
    assertPage(res);
  });
});

describe('валидация полей → 422', () => {
  let srv;
  before(async () => { srv = await startPhpServer(); });
  after(() => srv.stop());

  async function errorsFor(overrides, encoding) {
    const res = await postLead(srv.baseUrl, validLead(overrides), { encoding });
    assert.equal(res.status, 422, `ожидали 422, тело: ${res.text}`);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, 'validation');
    return res.body.errors;
  }

  function assertRussian(message) {
    assert.equal(typeof message, 'string');
    assert.match(message, /[А-Яа-яЁё]/, `текст ошибки не по-русски: ${message}`);
  }

  test('пустая заявка: обязательные поля перечислены, тексты по-русски', async () => {
    const errors = await errorsFor({ type: 'price', name: '', phone: '', consent: '' });
    for (const field of ['name', 'phone', 'consent']) {
      assert.ok(errors[field], `нет ошибки для ${field}`);
      assertRussian(errors[field]);
    }
    assert.equal(errors.email, undefined);
  });

  test('type вне price|partner', async () => {
    const errors = await errorsFor({ type: 'spam' });
    assertRussian(errors.type);
  });

  test('name: 1 символ после trim — ошибка, 101 — ошибка, 2 — ок', async () => {
    assertRussian((await errorsFor({ name: '  Я  ', phone: '' })).name);
    assertRussian((await errorsFor({ name: 'Ж'.repeat(101), phone: '' })).name);
    assert.equal((await errorsFor({ name: 'Ян', phone: '' })).name, undefined);
  });

  test('phone: 9 цифр — ошибка', async () => {
    assertRussian((await errorsFor({ phone: '920 243 19 5' })).phone);
  });

  test('phone: 11 цифр, но первая не 7/8 — ошибка; 10 цифр не с 9 — ошибка', async () => {
    assertRussian((await errorsFor({ phone: '59202431957' })).phone);
    assertRussian((await errorsFor({ phone: '4952431957' })).phone);
  });

  const NB = '\u00A0';
  const PHONE_INVALID = `Укажите телефон: 10${NB}цифр после +7 или${NB}8.`;
  const EMAIL_INVALID = `Проверьте адрес e-mail${NB}— например, name@mail.ru.`;

  test('phone с буквами — та же ошибка, что для неверного номера (как в форме)', async () => {
    assert.equal((await errorsFor({ phone: '+7 920 000-00-00 звонить после обеда' })).phone, PHONE_INVALID);
    assert.equal((await errorsFor({ phone: '8 920 ABC 00 00 0' })).phone, PHONE_INVALID);
    assert.equal((await errorsFor({ phone: '12345' })).phone, PHONE_INVALID);
    assert.equal((await errorsFor({ phone: '+7 (920) 000-00-00', name: '' })).phone, undefined);
  });

  test('email: «a..b@mail.ru», без точки в домене — ошибка с одним текстом; кириллический домен допустим', async () => {
    for (const bad of ['a..b@mail.ru', 'ivan@mail', '.ivan@mail.ru', 'ivan.@mail.ru', 'ivan@mail..ru', 'ivan@-mail.ru', 'ivan @mail.ru']) {
      assert.equal((await errorsFor({ email: bad, name: '' })).email, EMAIL_INVALID, bad);
    }
    for (const good of ['ivan@почта.рф', 'ivan@xn--80a1acny.xn--p1ai', 'i.van+shop@mail.ru', 'IVAN@Mail.Ru']) {
      assert.equal((await errorsFor({ email: good, name: '' })).email, undefined, good);
    }
  });

  test('name из неразрывных и других Unicode-пробелов — «Укажите имя.»; по краям такие пробелы обрезаются', async () => {
    for (const blank of ['\u00A0\u00A0', '\u2003\u3000', ' \u202F\uFEFF ']) {
      assert.equal((await errorsFor({ name: blank, phone: '' })).name, 'Укажите имя.', JSON.stringify(blank));
    }
    assert.match((await errorsFor({ name: '\u00A0Я\u00A0', phone: '' })).name, /слишком короткое/);
  });

  test('email: неверный формат и длиннее 254 — ошибка', async () => {
    assertRussian((await errorsFor({ email: 'не-почта' })).email);
    const long = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.ru`;
    assert.ok(long.length > 254);
    assertRussian((await errorsFor({ email: long })).email);
  });

  test('company и region длиннее 150 — ошибка', async () => {
    const errors = await errorsFor({ company: 'К'.repeat(151), region: 'Р'.repeat(151) });
    assertRussian(errors.company);
    assertRussian(errors.region);
  });

  test('format вне списка — ошибка', async () => {
    assertRussian((await errorsFor({ format: '100x100' })).format);
  });

  test('format=other без format_custom — ошибка у format_custom', async () => {
    const errors = await errorsFor({ format: 'other', format_custom: '   ' });
    assertRussian(errors.format_custom);
  });

  test('format_custom длиннее 100, quantity длиннее 100, message длиннее 2000', async () => {
    const errors = await errorsFor({
      format: 'other', format_custom: 'Ф'.repeat(101), quantity: 'К'.repeat(101), message: 'С'.repeat(2001),
    });
    assertRussian(errors.format_custom);
    assertRussian(errors.quantity);
    assertRussian(errors.message);
  });

  test('consent не равен 1 — ошибка', async () => {
    assertRussian((await errorsFor({ consent: 'on' })).consent);
  });

  test('multipart/form-data валидируется так же', async () => {
    const errors = await errorsFor({ phone: '123' }, 'multipart');
    assertRussian(errors.phone);
  });

  test('partner: format не проверяется', async () => {
    const res = await postLead(srv.baseUrl, validLead({ type: 'partner', format: '100x100', phone: '' }));
    assert.equal(res.status, 422);
    assert.equal(res.body.errors.format, undefined);
    assert.ok(res.body.errors.phone);
  });
});

describe('ловушка и время заполнения: притворный успех', () => {
  test('заполнено поле website → 200 ok, без проверки полей и без доставки', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const res = await postLead(srv.baseUrl, validLead({ website: 'http://spam.example', phone: '' }));
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { ok: true });
      assert.equal(srv.outbox().length, 0);
    } finally { await srv.stop(); }
  });

  test('form_elapsed_ms < 3000 → 200 ok, без доставки', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      for (const elapsed of ['0', '2999']) {
        const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: elapsed }));
        assert.equal(res.status, 200, res.text);
        assert.deepEqual(res.body, { ok: true });
      }
      assert.equal(srv.outbox().length, 0);
    } finally { await srv.stop(); }
  });

  test('form_elapsed_ms ≥ 3000 → заявка доставляется', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: '3000' }));
      assert.equal(res.status, 200, res.text);
      assert.equal(srv.outbox().length, 1);
    } finally { await srv.stop(); }
  });

  test('form_elapsed_ms нет (форма без JS) → проверка времени пропускается, заявка доставляется', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: undefined }));
      assert.equal(res.status, 200, res.text);
      assert.equal(srv.outbox().length, 1);
    } finally { await srv.stop(); }
  });

  test('form_elapsed_ms нечисловое, отрицательное или дробное < 3000 → бот: 200 ok, без доставки', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      for (const elapsed of ['abc', '-5', '-4523.7', '2999.9', '12 сек']) {
        const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: elapsed }));
        assert.equal(res.status, 200, `${elapsed}: ${res.text}`);
        assert.deepEqual(res.body, { ok: true });
      }
      assert.equal(srv.outbox().length, 0);
    } finally { await srv.stop(); }
  });

  test('form_elapsed_ms дробное ≥ 3000 (4523.7) → заявка доставляется', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: '4523.7' }));
      assert.equal(res.status, 200, res.text);
      assert.equal(srv.outbox().length, 1);
    } finally { await srv.stop(); }
  });

  test('form_elapsed_ms пустое → как без поля: заявка доставляется', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const res = await postLead(srv.baseUrl, validLead({ form_elapsed_ms: '' }));
      assert.equal(res.status, 200, res.text);
      assert.equal(srv.outbox().length, 1);
    } finally { await srv.stop(); }
  });

  test('ловушка проверяется раньше валидации, но после метода', async () => {
    const srv = await startPhpServer();
    try {
      const res = await postLead(srv.baseUrl, validLead({ website: 'x' }), { method: 'PUT' });
      assert.equal(res.status, 405);
    } finally { await srv.stop(); }
  });
});

describe('не настроено → 503', () => {
  test('пустой конфиг и корректная заявка → 503 not_configured', async () => {
    const srv = await startPhpServer();
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 503);
      assert.deepEqual(res.body, { ok: false, code: 'not_configured' });
    } finally { await srv.stop(); }
  });

  test('только токен Telegram без chat id — всё ещё не настроено', async () => {
    const srv = await startPhpServer({ env: { TELEGRAM_BOT_TOKEN: FAKE_TOKEN } });
    try {
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 503);
    } finally { await srv.stop(); }
  });

  test('ошибки полей важнее «не настроено»: пустой конфиг + плохой телефон → 422', async () => {
    const srv = await startPhpServer();
    try {
      const res = await postLead(srv.baseUrl, validLead({ phone: '12345' }));
      assert.equal(res.status, 422);
    } finally { await srv.stop(); }
  });
});

describe('лимит частоты', () => {
  test('шестая корректная заявка с одного IP за 600 с → 429 rate_limited', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      for (let i = 1; i <= 5; i += 1) {
        const res = await postLead(srv.baseUrl, validLead());
        assert.equal(res.status, 200, `заявка ${i}: ${res.text}`);
      }
      const sixth = await postLead(srv.baseUrl, validLead());
      assert.equal(sixth.status, 429);
      assert.deepEqual(sixth.body, { ok: false, code: 'rate_limited' });
      assert.equal(srv.outbox().length, 5);
    } finally { await srv.stop(); }
  });

  test('«не настроено» (503) не расходует лимит: конфиг проверяется раньше лимита', async () => {
    const srv = await startPhpServer();
    try {
      for (let i = 1; i <= 7; i += 1) {
        const res = await postLead(srv.baseUrl, validLead());
        assert.equal(res.status, 503, `заявка ${i}`);
      }
      assert.equal(existsSync(join(srv.storageDir, 'ratelimit')) ? readdirSync(join(srv.storageDir, 'ratelimit')).length : 0, 0);
    } finally { await srv.stop(); }
  });

  test('сбой доставки (502) по-прежнему расходует лимит', async () => {
    const srv = await startPhpServer({ env: { TELEGRAM_BOT_TOKEN: FAKE_TOKEN, TELEGRAM_CHAT_ID: FAKE_CHAT, TELEGRAM_API_BASE: DEAD_TELEGRAM } });
    try {
      for (let i = 1; i <= 5; i += 1) {
        const res = await postLead(srv.baseUrl, validLead());
        assert.equal(res.status, 502, `заявка ${i}: ${res.text}`);
      }
      assert.equal((await postLead(srv.baseUrl, validLead())).status, 429);
    } finally { await srv.stop(); }
  });

  test('ошибки валидации не расходуют лимит', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      for (let i = 0; i < 6; i += 1) await postLead(srv.baseUrl, validLead({ phone: '1' }));
      const res = await postLead(srv.baseUrl, validLead());
      assert.equal(res.status, 200, res.text);
    } finally { await srv.stop(); }
  });

  test('файлы лимита старше часа удаляются, свежие остаются', async () => {
    const srv = await startPhpServer({ env: { LEAD_EMAIL_TO: OWNER } });
    try {
      const dir = join(srv.storageDir, 'ratelimit');
      mkdirSync(dir, { recursive: true });
      const stale = join(dir, 'stale.json');
      const fresh = join(dir, 'fresh.json');
      writeFileSync(stale, '[]');
      writeFileSync(fresh, '[]');
      const twoHoursAgo = Date.now() / 1000 - 7200;
      const tenMinutesAgo = Date.now() / 1000 - 600;
      utimesSync(stale, twoHoursAgo, twoHoursAgo);
      utimesSync(fresh, tenMinutesAgo, tenMinutesAgo);
      await postLead(srv.baseUrl, validLead());
      assert.equal(existsSync(stale), false, 'файл старше часа не удалён');
      assert.equal(existsSync(fresh), true, 'свежий файл удалён');
      assert.ok(readdirSync(dir).length >= 2, 'не появилась запись текущей заявки');
    } finally { await srv.stop(); }
  });
});
