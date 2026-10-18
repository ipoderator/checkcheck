// Сквозная проверка (T09): ссылки всех страниц ведут на существующие id и файлы; обе вкладки
// формы — ошибки полей, «не настроено», успех — читаются в светлой и тёмной теме на телефоне и
// компьютере. Ответы сервера подменяются через page.route: настоящих отправок нет.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { lowContrastTexts } from '../helpers/contrast.mjs';

const PAGES = ['/', '/privacy.html', '/consent.html', '/404.html'];
const SHOTS = process.env.SHOT_DIR || '';

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
}

// HTML-ответ api/lead.php (LeadPage): отправка без полей — 422 страницей, лимит не тратит.
async function openLeadPage(page) {
  await page.goto('/');
  await Promise.all([
    page.waitForURL('**/api/lead.php'),
    page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'post';
      form.action = 'api/lead.php';
      form.innerHTML = '<input name="type" value="partner">';
      document.body.append(form);
      HTMLFormElement.prototype.submit.call(form);
    }),
  ]);
}

test('все ссылки и ресурсы страниц ведут на существующий id или файл', async ({ page, request, baseURL }) => {
  const missing = [];
  const checked = new Set();
  const pages = [...PAGES, '/api/lead.php'];
  for (const path of pages) {
    if (path === '/api/lead.php') await openLeadPage(page); else await page.goto(path);
    const refs = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[href], [src], [srcset], [poster]')) {
        if (el.matches('form')) continue;
        for (const attr of ['href', 'src', 'poster']) if (el.hasAttribute(attr)) out.push([el.tagName.toLowerCase(), el.getAttribute(attr)]);
        if (el.hasAttribute('srcset')) {
          for (const part of el.getAttribute('srcset').split(',')) out.push([el.tagName.toLowerCase(), part.trim().split(/\s+/)[0]]);
        }
      }
      return out;
    });
    const ids = await page.evaluate(() => new Set([...document.querySelectorAll('[id]')].map((e) => e.id)).size && [...document.querySelectorAll('[id]')].map((e) => e.id));
    const here = page.url();
    for (const [tag, ref] of refs) {
      if (/^(tel:|mailto:|data:|javascript:)/.test(ref)) continue;
      if (/^https?:\/\//.test(ref) && !ref.startsWith(baseURL)) { missing.push(`${path}: внешняя ${ref}`); continue; }
      if (ref.startsWith('#')) {
        const id = decodeURIComponent(ref.slice(1));
        if (id && !ids.includes(id)) missing.push(`${path}: нет id ${ref}`);
        continue;
      }
      const url = new URL(ref, here);
      const [hash] = [url.hash];
      url.hash = '';
      if (hash && url.pathname === new URL(here).pathname) {
        if (!ids.includes(decodeURIComponent(hash.slice(1)))) missing.push(`${path}: нет id ${hash}`);
      }
      const key = url.href;
      if (checked.has(key)) continue;
      checked.add(key);
      const res = await request.get(url.href);
      if (res.status() >= 400) missing.push(`${path}: ${tag} ${ref} → ${res.status()}`);
    }
  }
  expect(missing).toEqual([]);
  expect(checked.size).toBeGreaterThan(10);
});

test('якорные ссылки главной из других страниц ведут на существующие id главной', async ({ page }) => {
  await page.goto('/');
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  const bad = [];
  for (const path of PAGES.slice(1)) {
    await page.goto(path);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    for (const href of hrefs) {
      const m = href.match(/^(?:\.\/|\/|index\.html)(?:index\.html)?#(.+)$/);
      if (m && !ids.includes(m[1])) bad.push(`${path}: ${href}`);
    }
  }
  expect(bad).toEqual([]);
});

for (const scheme of ['light', 'dark']) {
  for (const width of [375, 1440]) {
    test.describe(`форма: ${scheme}, ${width}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: width < 700 ? 800 : 900 });
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto('/');
        await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      });

      for (const type of ['price', 'partner']) {
        test(`вкладка «${type}»: ошибки полей, «не настроено» и успех читаются, консоль чистая`, async ({ page }) => {
          const errors = [];
          page.on('pageerror', (err) => errors.push(err.message));
          page.on('console', (msg) => { if (msg.type() === 'error' && !/status of 50[34]/.test(msg.text())) errors.push(msg.text()); });
          let sent = '';
          let mode = 'not_configured';
          await page.route('**/api/lead.php', (route) => {
            sent = route.request().postData() || '';
            if (mode === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
            return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"code":"not_configured"}' });
          });
          await page.goto(`/#${type}`);
          await expect(page.locator(`[data-lead-type="${type}"]`)).toHaveAttribute('aria-selected', 'true');
          const form = page.locator('#lead-form');
          await form.scrollIntoViewIfNeeded();

          // Ошибки полей.
          await page.click('[data-lead-submit]');
          await expect(page.locator('#lead-name-error')).not.toBeEmpty();
          await expect(page.locator('#lead-phone-error')).not.toBeEmpty();
          expect(sent).toBe('');
          expect(await lowContrastTexts(page)).toEqual([]);
          await shot(page, `form-errors-${type}-${scheme}-${width}`);

          // «Не настроено».
          await page.fill('#lead-name', 'Иван Петров');
          await page.fill('#lead-phone', '8 920 000-00-00');
          await page.check('#lead-consent');
          await page.click('[data-lead-submit]');
          await expect(form).toHaveAttribute('data-state', 'error', { timeout: 10000 });
          await expect(page.locator('[data-lead-status]')).toContainText(/не\s+подключена/);
          await expect(page.locator('[data-lead-status]')).toBeVisible();
          expect(await lowContrastTexts(page)).toEqual([]);
          await shot(page, `form-notconfigured-${type}-${scheme}-${width}`);

          // Успех: тип уходит в запросе.
          mode = 'ok';
          await page.click('[data-lead-submit]');
          await expect(form).toHaveAttribute('data-state', 'success', { timeout: 10000 });
          expect(sent).toMatch(new RegExp(`name="type"\\r\\n\\r\\n${type}`));
          await expect(page.locator('[data-lead-status]')).toContainText('Заявка принята');
          expect(await lowContrastTexts(page)).toEqual([]);
          await shot(page, `form-success-${type}-${scheme}-${width}`);
          expect(errors).toEqual([]);
        });
      }

      test('мобильное меню, страницы документов и 404 — снимки и контраст', async ({ page }) => {
        if (width < 1380) {
          await page.locator('[data-menu-toggle]').click();
          await expect(page.locator('[data-menu]')).toBeVisible();
          await shot(page, `menu-${scheme}-${width}`);
          expect(await lowContrastTexts(page)).toEqual([]);
          await page.keyboard.press('Escape');
        }
        for (const path of PAGES.slice(1)) {
          await page.goto(path);
          await shot(page, `${path.replace(/\W/g, '')}-${scheme}-${width}`);
          expect(await lowContrastTexts(page), path).toEqual([]);
        }
        await openLeadPage(page);
        await shot(page, `leadpage-${scheme}-${width}`);
      });
    });
  }
}
