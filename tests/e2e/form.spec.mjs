// Форма заявки: вкладки, валидация, состояния ответа сервера, черновик.
// Настоящий сервер (php -S, пустой конфиг) отвечает not_configured; остальные ответы
// подменяются через page.route — лимит 5 заявок с IP действует и здесь.
import { test, expect } from '@playwright/test';

const DRAFT_KEY = 'vsecheki:lead-draft:v1';

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
  await expect(page.locator('#lead-phone-error')).toContainText('Укажите российский номер');
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
