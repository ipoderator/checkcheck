// Форма заявки: вкладки, валидация, состояния ответа сервера, черновик.
// Настоящий сервер (php -S, пустой конфиг) отвечает not_configured; остальные ответы
// подменяются через page.route — лимит 5 заявок с IP действует и здесь.
import { test, expect } from '@playwright/test';

const DRAFT_KEY = 'vsecheki:lead-draft:v1';
const NB = '\u00A0';
const PHONE_INVALID = `Укажите телефон: 10${NB}цифр после +7 или${NB}8.`;
const EMAIL_INVALID = `Проверьте адрес e-mail${NB}— например, name@mail.ru.`;

async function fillRequired(page, { name = 'Иван Петров', phone = '8 920 000-00-00' } = {}) {
  await page.fill('#lead-name', name);
  await page.fill('#lead-phone', phone);
  await page.check('#lead-consent');
}

function mockLead(page, status, body, { delay = 0, onRequest } = {}) {
  return page.route('**/api/lead.php', async (route) => {
    if (onRequest) onRequest(route.request());
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => { try { localStorage.removeItem(key); } catch (e) {} }, DRAFT_KEY);
});

test('пустой конфиг: «Форма пока не подключена…», введённое остаётся и переживает перезагрузку', async ({ page }) => {
  await page.goto('/#price');
  await fillRequired(page, { name: 'Мария', phone: '+7 (920) 111-22-33' });
  await page.fill('#lead-email', 'maria@example.ru');
  await page.check('#lead-format-80x80');
  await page.fill('#lead-quantity', 'Две коробки');
  await page.fill('#lead-message', 'Нужна лента для магазина');
  await page.click('[data-lead-submit]');

  const status = page.locator('[data-lead-status]');
  await expect(status).toContainText(/Форма пока не\s+подключена\s+— заявка не\s+отправлена/, { timeout: 15000 });
  await expect(status).toContainText(/8\s920\s243-19-57/);
  await expect(status).toContainText('ipoderator@yandex.ru');
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#lead-name')).toHaveValue('Мария');
  await expect(page.locator('#lead-phone')).toHaveValue('+7 (920) 111-22-33');
  await expect(page.locator('[data-lead-submit]')).toBeEnabled();

  // Согласие даёт только тот, кто сейчас за компьютером: в черновик оно не пишется.
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toContain('Мария');
  const saved = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY));
  expect(saved).not.toHaveProperty('consent');

  await page.reload();
  await expect(page.locator('#lead-consent')).not.toBeChecked();
  await expect(page.locator('#lead-name')).toHaveValue('Мария');
  await expect(page.locator('#lead-email')).toHaveValue('maria@example.ru');
  await expect(page.locator('#lead-format-80x80')).toBeChecked();
  await expect(page.locator('#lead-quantity')).toHaveValue('Две коробки');
  await expect(page.locator('#lead-message')).toHaveValue('Нужна лента для магазина');
});

test('ошибки полей по-русски у самих полей, фокус на первое ошибочное, введённое не стирается', async ({ page }) => {
  let requests = 0;
  await mockLead(page, 200, { ok: true }, { onRequest: () => { requests += 1; } });
  await page.fill('#lead-email', 'не-почта');
  await page.click('[data-lead-submit]');

  await expect(page.locator('#lead-name-error')).toHaveText('Укажите имя.');
  await expect(page.locator('#lead-phone-error')).toHaveText('Укажите телефон.');
  await expect(page.locator('#lead-email-error')).toContainText('Проверьте адрес e-mail');
  await expect(page.locator('#lead-consent-error')).toContainText(/Нужно согласие на\s+обработку/);
  await expect(page.locator('#lead-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#lead-name')).toHaveAttribute('aria-describedby', /lead-name-error/);
  await expect(page.locator('#lead-name')).toBeFocused();
  await expect(page.locator('#lead-email')).toHaveValue('не-почта');

  await page.fill('#lead-name', 'Ольга');
  await page.fill('#lead-phone', '123');
  await page.fill('#lead-email', '');
  await page.check('#lead-consent');
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-phone-error')).toHaveText(PHONE_INVALID);
  await expect(page.locator('#lead-phone')).toBeFocused();
  await expect(page.locator('#lead-name-error')).toHaveText('');
  await expect(page.locator('#lead-name')).not.toHaveAttribute('aria-invalid', 'true');

  await page.check('#lead-format-other');
  await page.fill('#lead-phone', '9201112233');
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-format_custom-error')).toHaveText('Укажите нужный размер ленты.');
  expect(requests).toBe(0);
});

test('ошибка поля от сервера (422) показывается у поля', async ({ page }) => {
  await mockLead(page, 422, { ok: false, code: 'validation', errors: { phone: 'Сервер: проверьте телефон.' } });
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-phone-error')).toHaveText('Сервер: проверьте телефон.', { timeout: 10000 });
  await expect(page.locator('#lead-phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#lead-name')).toHaveValue('Иван Петров');
});

test('успех: «Заявка принята», телефон для срочных вопросов, поля и черновик очищены', async ({ page }) => {
  let body = '';
  await mockLead(page, 200, { ok: true }, { onRequest: (req) => { body = req.postData() || ''; } });
  await page.click('[data-lead-format="57x40"]');
  await fillRequired(page);
  await page.fill('#lead-region', 'Липецкая область');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toContain('Иван Петров');

  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'success', { timeout: 10000 });
  await expect(page.locator('[data-lead-status]')).toContainText('Заявка принята');
  await expect(page.locator('[data-lead-success]')).toBeVisible();
  await expect(page.locator('[data-lead-success]')).toContainText(/8\s920\s243-19-57/);

  expect(body).toMatch(/name="type"\r\n\r\nprice/);
  expect(body).toMatch(/name="format"\r\n\r\n57x40/);
  expect(body).toMatch(/name="consent"\r\n\r\n1/);
  const elapsed = Number((body.match(/name="form_elapsed_ms"\r\n\r\n([^\r]*)/) || [])[1]);
  expect(Number.isInteger(elapsed)).toBe(true);
  expect(elapsed).toBeGreaterThanOrEqual(3000);
  expect(body).not.toMatch(/name="website"\r\n\r\n[^\r]/);

  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
  await page.click('[data-lead-again]');
  await expect(page.locator('#lead-name')).toHaveValue('');
  await expect(page.locator('#lead-region')).toHaveValue('');
  await expect(page.locator('#lead-consent')).not.toBeChecked();
});

test('двойной клик не создаёт две заявки: кнопка заблокирована и пишет «Отправляем…»', async ({ page }) => {
  let requests = 0;
  await mockLead(page, 200, { ok: true }, { delay: 1500, onRequest: () => { requests += 1; } });
  await fillRequired(page);
  const submit = page.locator('[data-lead-submit]');
  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect(submit).toContainText('Отправляем…');
  await page.locator('#lead-form').evaluate((f) => f.requestSubmit());
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'success', { timeout: 10000 });
  expect(requests).toBe(1);
});

const failures = [
  ['сбой доставки (502)', 502, { ok: false, code: 'delivery_failed' }, /Не\s+удалось доставить заявку/],
  ['ошибка сервера (500)', 500, { ok: false, code: 'server_error' }, /Не\s+удалось доставить заявку/],
  ['лимит заявок (429)', 429, { ok: false, code: 'rate_limited' }, /Слишком много заявок/],
];
for (const [title, status, response, text] of failures) {
  test(`${title}: понятное сообщение, данные на месте, можно повторить`, async ({ page }) => {
    await mockLead(page, status, response);
    await fillRequired(page);
    await page.click('[data-lead-submit]');
    await expect(page.locator('[data-lead-status]')).toContainText(text, { timeout: 10000 });
    await expect(page.locator('[data-lead-status]')).toContainText(/8\s920\s243-19-57/);
    await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('#lead-name')).toHaveValue('Иван Петров');
    await expect(page.locator('[data-lead-submit]')).toBeEnabled();
  });
}

test('нет связи: отдельный текст, данные на месте, кнопка снова активна', async ({ page }) => {
  await page.route('**/api/lead.php', (route) => route.abort('internetdisconnected'));
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  const status = page.locator('[data-lead-status]');
  await expect(status).toContainText(/Нет связи с\s+сервером/, { timeout: 10000 });
  await expect(status).not.toContainText(/Не\s+удалось доставить/);
  await expect(page.locator('#lead-phone')).toHaveValue('8 920 000-00-00');
  await expect(page.locator('[data-lead-submit]')).toBeEnabled();
});

test('вкладки: #partner и #price открывают нужную вкладку, кнопка формата подставляет формат', async ({ page }) => {
  await page.locator('main a[href="#partner"]').first().click();
  await expect(page.locator('[data-lead-type="partner"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#lead-form input[name="type"]')).toHaveValue('partner');
  await expect(page.locator('[data-only="price"]').first()).toBeHidden();

  await page.locator('main a[href="#price"]').first().click();
  await expect(page.locator('[data-lead-type="price"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#lead-form input[name="type"]')).toHaveValue('price');
  await expect(page.locator('#lead-quantity')).toBeVisible();

  await page.click('[data-lead-type="partner"]');
  await page.click('[data-lead-format="80x80"]');
  await expect(page.locator('[data-lead-type="price"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#lead-format-80x80')).toBeChecked();

  await page.click('[data-lead-format="other"]');
  await expect(page.locator('#lead-format-other')).toBeChecked();
  await expect(page.locator('#lead-format_custom')).toBeVisible();

  await page.goto('/#partner');
  await expect(page.locator('[data-lead-type="partner"]')).toHaveAttribute('aria-selected', 'true');
});

test('«Очистить» стирает поля и черновик', async ({ page }) => {
  await fillRequired(page);
  await page.fill('#lead-company', 'ООО «Ромашка»');
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toContain('Ромашка');
  await page.click('[data-lead-clear]');
  await expect(page.locator('#lead-name')).toHaveValue('');
  await expect(page.locator('#lead-company')).toHaveValue('');
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
  await page.reload();
  await expect(page.locator('#lead-name')).toHaveValue('');
});

test('галочка согласия ссылается на политику и согласие', async ({ page }) => {
  const label = page.locator('label[for="lead-consent"]');
  await expect(label.locator('a[href="consent.html"]')).toHaveCount(1);
  await expect(label.locator('a[href="privacy.html"]')).toHaveCount(1);
});

/* ---------- Правки по аудиту: одинаковые правила, фокус, озвучивание, отправка без JS ---------- */

test('клиент и сервер проверяют поля одинаково и одними текстами', async ({ page }) => {
  const base = { type: 'price', name: 'Иван', phone: '8 920 000-00-00', email: '', company: '', region: '', format: '', format_custom: '', quantity: '', message: '' };
  const cases = [
    { phone: '+7 920 000-00-00 звонить после обеда' },
    { phone: '8 920 ABC 00 00 0' },
    { phone: '12345' },
    { email: 'a..b@mail.ru' },
    { email: 'ivan@mail' },
    { email: 'ivan@почта.рф' },
    { email: 'ivan@xn--80a1acny.xn--p1ai' },
    { name: '  ' },
    { name: ' 　' },
    { name: ' Я ' },
    { phone: '8 920\t243-19-57' },
    { email: 'ivan.@mail.ru' },
    { email: '.ivan@mail.ru' },
    { email: 'i.van@mail.ru' },
  ];
  const client = await page.evaluate(async ({ base, cases }) => {
    const { validate } = await import('/assets/js/lead-form.js');
    return cases.map((c) => validate({ ...base, ...c, consent: true }));
  }, { base, cases });
  for (const [i, c] of cases.entries()) {
    const res = await page.request.post('/api/lead.php', {
      form: { ...base, ...c, consent: '1', website: '', form_elapsed_ms: '10000', page: '/' },
      headers: { Accept: 'application/json' },
    });
    const body = await res.json();
    const server = body.code === 'validation' ? body.errors : {};
    const field = Object.keys(c)[0];
    expect(client[i][field], `${field}=${JSON.stringify(c[field])}: клиент «${client[i][field]}», сервер «${server[field]}»`).toBe(server[field]);
    expect(res.status(), JSON.stringify(c)).not.toBe(429);
  }
  expect(client[0].phone).toBe(PHONE_INVALID);
  expect(client[3].email).toBe(EMAIL_INVALID);
  expect(client[5].email).toBeUndefined();
  expect(client[7].name).toBe('Укажите имя.');
  // Таб внутри номера: оба принимают (сервер заменяет управляющие символы пробелом).
  expect(client[10].phone).toBeUndefined();
  expect(client[11].email).toBe(EMAIL_INVALID);
  expect(client[13].email).toBeUndefined();

  // То же в самой форме: телефон с припиской — ошибка у поля, запроса нет.
  let requests = 0;
  await mockLead(page, 200, { ok: true }, { onRequest: () => { requests += 1; } });
  await fillRequired(page, { phone: '+7 920 000-00-00 звонить после обеда' });
  await page.fill('#lead-email', 'a..b@mail.ru');
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-phone-error')).toHaveText(PHONE_INVALID);
  await expect(page.locator('#lead-email-error')).toHaveText(EMAIL_INVALID);
  await expect(page.locator('#lead-phone')).toBeFocused();
  expect(requests).toBe(0);
});

for (const [title, setup] of [
  ['нет связи', (page) => page.route('**/api/lead.php', (route) => route.abort('internetdisconnected'))],
  ['503 не настроено', (page) => mockLead(page, 503, { ok: false, code: 'not_configured' })],
  ['429', (page) => mockLead(page, 429, { ok: false, code: 'rate_limited' })],
]) {
  test(`после ошибки (${title}) фокус на статусе, а не на body`, async ({ page }) => {
    await setup(page);
    await fillRequired(page);
    await page.locator('[data-lead-submit]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'error', { timeout: 10000 });
    await expect(page.locator('[data-lead-status]')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('BODY');
  });
}

test('ошибка поля от сервера: фокус на поле; ошибка без поля — на статусе', async ({ page }) => {
  await mockLead(page, 422, { ok: false, code: 'validation', errors: { type: 'Выберите тип заявки.' } });
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  await expect(page.locator('[data-lead-status]')).toContainText('Выберите тип заявки.', { timeout: 10000 });
  await expect(page.locator('[data-lead-status]')).toBeFocused();
});

test('успех озвучивается: живая область остаётся в дереве доступности с текстом «Заявка принята»', async ({ page }) => {
  await mockLead(page, 200, { ok: true });
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'success', { timeout: 10000 });
  const status = page.locator('[data-lead-status]');
  expect(await status.evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
  await expect(status).toHaveAttribute('role', 'status');
  expect(await status.ariaSnapshot()).toMatch(/status:.*Заявка принята/s);
});

test('во время отправки «Очистить» и вкладки недоступны', async ({ page }) => {
  await mockLead(page, 503, { ok: false, code: 'not_configured' }, { delay: 1500 });
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'sending');
  await expect(page.locator('[data-lead-clear]')).toBeDisabled();
  await expect(page.locator('[data-lead-type="partner"]')).toBeDisabled();
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'error', { timeout: 10000 });
  await expect(page.locator('[data-lead-clear]')).toBeEnabled();
  await expect(page.locator('[data-lead-type="partner"]')).toBeEnabled();
});

test('«данные сохранены» не пишется, если поля пусты или опустели', async ({ page }) => {
  await page.click('[data-lead-submit]');
  await expect(page.locator('[data-lead-status]')).toContainText('Проверьте поля');
  await expect(page.locator('[data-lead-status]')).not.toContainText(/сохран/i);

  await mockLead(page, 503, { ok: false, code: 'not_configured' }, { delay: 1500 });
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'sending');
  await page.fill('#lead-name', '');
  await page.fill('#lead-phone', '');
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'error', { timeout: 10000 });
  const status = page.locator('[data-lead-status]');
  await expect(status).toContainText(/Форма пока не\s+подключена/);
  await expect(status).not.toContainText(/сохран/i);
});

test('нет ответа 20 с: не утверждаем, что заявка не дошла, и предлагаем позвонить', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.route('**/api/lead.php', () => { /* сервер молчит */ });
  await fillRequired(page);
  await page.click('[data-lead-submit]');
  await page.clock.runFor(3500);
  await expect(page.locator('#lead-form')).toHaveAttribute('data-state', 'sending');
  await page.clock.runFor(21000);
  const status = page.locator('[data-lead-status]');
  await expect(status).toContainText(/не\s+ответил/);
  await expect(status).not.toContainText(/заявка не\s+отправлена/);
  await expect(status).toContainText(/8\s920\s243-19-57/);
  await expect(page.locator('#lead-name')).toHaveValue('Иван Петров');
});

test('без JS: поле «Нужный размер» видно и уходит на сервер, ответ — страница, а не JSON', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#lead-format_custom')).toBeVisible();
  await page.fill('#lead-name', 'Иван Петров');
  await page.fill('#lead-phone', '8 920 000-00-00');
  await page.check('#lead-format-other');
  await page.fill('#lead-format_custom', '57 × 30');
  await page.check('#lead-consent');
  const [request] = await Promise.all([
    page.waitForRequest('**/api/lead.php'),
    page.click('[data-lead-submit]'),
  ]);
  expect(request.postData()).toMatch(/format_custom=57\+%C3%97\+30/);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('h1')).toContainText(/Форма пока не\s+подключена/);
  await expect(page.locator('a', { hasText: /Вернуться к\s+форме/ })).toHaveAttribute('href', '../#order');
  expect(await page.evaluate(() => document.body.innerText)).not.toContain('"ok"');
  await context.close();
});

test('в модуле формы нет lookbehind: старый Safari (до 16.4) иначе не загрузит модуль целиком', async ({ page }) => {
  const res = await page.request.get('/assets/js/lead-form.js');
  expect(res.ok()).toBe(true);
  expect(await res.text()).not.toMatch(/\(\?<[=!]/);
});

test('без JS: свой размер при отмеченном 57 × 40 — ошибка у «Нужный размер», а не молчаливая потеря', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await page.fill('#lead-name', 'Иван Петров');
  await page.fill('#lead-phone', '8 920 000-00-00');
  await page.check('#lead-format-57x40');
  await page.fill('#lead-format_custom', '57 × 30');
  await page.check('#lead-consent');
  await page.click('[data-lead-submit]');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('li', { hasText: 'Нужный размер:' })).toContainText('«Другой размер»');
  await context.close();
});
