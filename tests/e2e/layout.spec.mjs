// Адаптивность, навигация, мобильное меню, анимации и внешние запросы.
import { test, expect } from '@playwright/test';

const WIDTHS = [360, 390, 768, 1024, 1440, 1920];
const SECTIONS = ['why', 'products', 'production', 'process', 'delivery', 'partners', 'faq', 'order', 'contacts', 'requisites'];

for (const width of WIDTHS) {
  test(`без горизонтальной прокрутки на ширине ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el.scrollWidth - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('все разделы есть на странице и в навигации по якорям', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  for (const id of SECTIONS) {
    await expect(page.locator(`#${id}`), id).toHaveCount(1);
    await expect(page.locator(`a[href="#${id}"]`).first(), id).toBeAttached();
  }
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toContainText('Кассовая лента');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.locator('.site-header a[href^="tel:+79202431957"]').first()).toBeVisible();
});

test('мобильное меню: открывается, фокус заперт, закрывается по Esc, ссылке и тапу вне меню', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('[data-menu-toggle]');
  const menu = page.locator('[data-menu]');
  await expect(menu).toBeHidden();

  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const m = document.querySelector('[data-menu]');
      const t = document.querySelector('[data-menu-toggle]');
      return m.contains(document.activeElement) || document.activeElement === t;
    });
    expect(inside).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  await toggle.click();
  await menu.locator('a[href="#faq"]').click();
  await expect(menu).toBeHidden();

  await toggle.click();
  await expect(menu).toBeVisible();
  await page.mouse.click(5, 840);
  await expect(menu).toBeHidden();
});

test('тапы не меньше 44 px на телефоне', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const small = await page.evaluate(() => {
    const els = document.querySelectorAll('.site-header a, .site-header button, main a.btn, main button, #lead-form input[type="radio"] + label, #lead-form input[type="checkbox"]');
    const bad = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const target = el.matches('input[type="checkbox"]') ? el.closest('.check').getBoundingClientRect() : r;
      if (target.height < 44 || target.width < 44) bad.push(`${el.tagName}.${el.className} ${Math.round(target.width)}×${Math.round(target.height)}`);
    }
    return bad;
  });
  expect(small).toEqual([]);
});

test('prefers-reduced-motion: анимаций нет, всё содержимое видно', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => {
    const running = document.getAnimations().filter((a) => a.playState === 'running').length;
    const hidden = [...document.querySelectorAll('[data-reveal]')].filter((el) => getComputedStyle(el).opacity !== '1' || getComputedStyle(el).transform !== 'none').length;
    const tape = document.querySelector('[data-tape]');
    const tapeMoved = [...tape.querySelectorAll('*')].filter((el) => getComputedStyle(el).transform !== 'none' && !el.hasAttribute('data-tape-static')).length;
    return { running, hidden, tapeMoved, reveals: document.querySelectorAll('[data-reveal]').length };
  });
  expect(state.reveals).toBeGreaterThan(5);
  expect(state).toMatchObject({ running: 0, hidden: 0, tapeMoved: 0 });
});

test('без JS всё содержимое видно', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((el) => getComputedStyle(el).opacity !== '1').length);
  expect(hidden).toBe(0);
  await expect(page.locator('#lead-name')).toBeVisible();
  await context.close();
});

test('лента непрерывна от первого экрана до формы', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const geo = await page.evaluate(() => {
    const tape = document.querySelector('[data-tape]').getBoundingClientRect();
    const hero = document.querySelector('.hero').getBoundingClientRect();
    const form = document.querySelector('#lead-form').getBoundingClientRect();
    return { tapeTop: tape.top, tapeBottom: tape.bottom, heroBottom: hero.bottom, formTop: form.top };
  });
  expect(geo.tapeTop).toBeLessThan(geo.heroBottom);
  expect(geo.tapeBottom).toBeGreaterThan(geo.formTop - 400);
});

test('страница не делает внешних запросов и грузит свои шрифты', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
  });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  expect(external).toEqual([]);
  const fonts = await page.evaluate(() => ({
    unbounded: document.fonts.check('700 40px Unbounded', 'Кассовая'),
    manrope: document.fonts.check('400 16px Manrope', 'лента'),
    mono: document.fonts.check('500 14px "JetBrains Mono"', 'ЧЕК'),
    loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
  }));
  expect(fonts.loaded).toEqual(expect.arrayContaining(['Unbounded', 'Manrope', 'JetBrains Mono']));
});
