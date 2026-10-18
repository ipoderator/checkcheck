// Светлая и тёмная тема: переключатель в шапке, выбор в localStorage, тема системы, без JS.
import { test, expect } from '@playwright/test';
import { lowContrastTexts } from '../helpers/contrast.mjs';

const KEY = 'vsecheki:theme';
const PAGES = ['/', '/privacy.html', '/consent.html', '/404.html'];

// Цвет фона страницы в RGB — у светлой темы светлый, у тёмной тёмный.
const pageLightness = (page) => page.evaluate(() => {
  const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
  return (r + g + b) / 3;
});
const isDark = async (page) => (await pageLightness(page)) < 80;

// HTML-ответ api/lead.php (LeadPage): обычная отправка формы без полей — 422 страницей, лимит не тратит.
async function openLeadPage(page) {
  await page.goto('/');
  await Promise.all([
    page.waitForURL('**/api/lead.php'),
    page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'post';
      form.action = 'api/lead.php';
      form.innerHTML = '<input name="type" value="price">';
      document.body.append(form);
      HTMLFormElement.prototype.submit.call(form);
    }),
  ]);
  await expect(page.locator('h1')).toBeVisible();
}

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`кнопка темы видна в шапке без меню на ${width}, касание ≥ 44 × 44`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: 'light' });
    for (const path of PAGES) {
      await page.goto(path);
      const toggle = page.locator('.site-header [data-theme-toggle]').first();
      await expect(toggle, path).toBeVisible();
      await expect(toggle, path).toHaveAttribute('aria-label', 'Тёмная тема');
      await expect(toggle, path).toHaveAttribute('aria-pressed', 'false');
      const box = await toggle.boundingBox();
      expect(box.width, path).toBeGreaterThanOrEqual(44);
      expect(box.height, path).toBeGreaterThanOrEqual(44);
      // Целиком в экране, справа хотя бы 8 px поля.
      expect(box.x + box.width, path).toBeLessThanOrEqual(width - 8);
    }
    await page.goto('/');
    await expect(page.locator('[data-menu]')).toBeHidden();
  });
}

test('выбор тёмной темы запоминается и применяется до первой отрисовки', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    // Снимок состояния в момент появления <body> — до любых отложенных скриптов.
    new MutationObserver((list, observer) => {
      if (!document.body) return;
      window.__atBody = {
        theme: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
      };
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  expect(await isDark(page)).toBe(false);
  const toggle = page.locator('.site-header [data-theme-toggle]');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('dark');
  expect(await isDark(page)).toBe(true);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#141517$/i);

  await page.reload();
  expect(await page.evaluate(() => window.__atBody)).toEqual({ theme: 'dark', bg: expect.stringMatching(/^#141517$/i) });
  expect(await isDark(page)).toBe(true);
  await expect(page.locator('.site-header [data-theme-toggle]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('.site-header [data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('light');
  expect(await isDark(page)).toBe(false);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#F7F6F2$/i);
});

test('переключатель работает с клавиатуры', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const toggle = page.locator('.site-header [data-theme-toggle]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await isDark(page)).toBe(false);
});

test('без выбора — тема системы, смена системной подхватывается на лету', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  expect(await isDark(page)).toBe(true);
  const toggle = page.locator('.site-header [data-theme-toggle]');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#141517$/i);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => isDark(page)).toBe(false);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#F7F6F2$/i);

  // Выбор посетителя сильнее системы.
  await toggle.click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await isDark(page)).toBe(true);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

test('мусор в хранилище — как нет выбора', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript((k) => localStorage.setItem(k, 'purple'), KEY);
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  expect(await isDark(page)).toBe(false);
});

test('хранилище недоступно — переключатель всё равно работает на странице, ошибок нет', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException('Доступ запрещён', 'SecurityError'); };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  await page.goto('/');
  const toggle = page.locator('.site-header [data-theme-toggle]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await isDark(page)).toBe(true);
  await toggle.click();
  expect(await isDark(page)).toBe(false);
  expect(errors).toEqual([]);
});

test('выбор общий для всех страниц, кнопка есть на privacy, consent, 404 и в ответе формы без JS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.locator('.site-header [data-theme-toggle]').click();
  for (const path of PAGES.slice(1)) {
    await page.goto(path);
    expect(await isDark(page), path).toBe(true);
    const toggle = page.locator('.site-header [data-theme-toggle]');
    await expect(toggle, path).toBeVisible();
    await expect(toggle, path).toHaveAttribute('aria-pressed', 'true');
  }
  await openLeadPage(page);
  expect(await isDark(page)).toBe(true);
  const toggle = page.locator('.site-header [data-theme-toggle]');
  await expect(toggle).toBeVisible();
  await toggle.click();
  expect(await isDark(page)).toBe(false);
  await page.goto('/privacy.html');
  expect(await isDark(page)).toBe(false);
});

test('без JS: кнопки темы нет, работает тема системы', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  const page = await context.newPage();
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('[data-theme-toggle]').first(), path).toBeAttached();
    await expect(page.locator('[data-theme-toggle]').first(), path).toBeHidden();
    expect(await isDark(page), path).toBe(true);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await isDark(page)).toBe(false);
  await context.close();
});

for (const scheme of ['light', 'dark']) {
  for (const width of [1440, 375]) {
    test(`контраст текста AA: ${scheme}, ${width}, с ошибками формы и открытым меню`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.click('[data-lead-submit]');
      await expect(page.locator('#lead-name-error')).not.toBeEmpty();
      expect(await lowContrastTexts(page)).toEqual([]);
      if (width < 1380) {
        await page.locator('[data-menu-toggle]').click();
        await expect(page.locator('[data-menu]')).toBeVisible();
        expect(await lowContrastTexts(page)).toEqual([]);
      }
      for (const path of PAGES.slice(1)) {
        await page.goto(path);
        expect(await lowContrastTexts(page), path).toEqual([]);
      }
      await openLeadPage(page);
      await expect(page.locator('.lead-result__errors')).toBeVisible();
      expect(await lowContrastTexts(page), 'api/lead.php').toEqual([]);
    });
  }
}
