// Проверка в браузере на 360 / 375 / 390 / 1440 (G27, G29): прокрутка, меню, якоря, картинки,
// клавиатура, консоль. Плюс мобильные правки аудита: «/» в списке партнёров, подсказка
// количества на 360, 404 со ссылкой «Перейти к содержимому».
import { test, expect } from '@playwright/test';

const WIDTHS = [360, 375, 390, 1440];
const DESKTOP_MIN = 1380; // с этой ширины навигация в шапке, меню скрыто (main.js)

/** Сбор ошибок консоли, исключений страницы и упавших запросов. */
function watchErrors(page) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`console.${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} ${req.failure() && req.failure().errorText}`));
  page.on('response', (res) => { if (res.status() >= 400) errors.push(`HTTP ${res.status()}: ${res.url()}`); });
  return errors;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
}

for (const width of WIDTHS) {
  const mobile = width < DESKTOP_MIN;

  test.describe(`ширина ${width}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: mobile ? 800 : 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    test('без горизонтальной прокрутки; все изображения загружены с верными пропорциями; консоль чистая', async ({ page }) => {
      const errors = watchErrors(page);
      for (const path of ['/', '/privacy.html', '/consent.html', '/404.html']) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await scrollThrough(page);
        const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
        if (path !== '/') continue;
        await page.waitForLoadState('networkidle');
        const images = await page.evaluate(async () => {
          const imgs = [...document.querySelectorAll('img')];
          await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
          return imgs.map((img) => ({
            src: img.currentSrc || img.src,
            natural: [img.naturalWidth, img.naturalHeight],
            declared: [Number(img.getAttribute('width')), Number(img.getAttribute('height'))],
          }));
        });
        expect(images.length).toBeGreaterThanOrEqual(4);
        for (const img of images) {
          expect(img.natural[0], img.src).toBeGreaterThan(0);
          expect(img.natural[0] / img.natural[1], img.src).toBeCloseTo(img.declared[0] / img.declared[1], 2);
          expect(img.src, img.src).toMatch(/\.webp$/);
        }
      }
      expect(errors).toEqual([]);
    });

    test('каждая ссылка навигации доводит до раздела, шапка его не перекрывает', async ({ page }) => {
      await page.goto('/');
      const hrefs = await page.locator(mobile ? '.mobile-menu__list a' : '.site-nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs.length).toBe(8);
      for (const href of hrefs) {
        if (mobile) {
          await page.locator('[data-menu-toggle]').click();
          await page.locator(`.mobile-menu__list a[href="${href}"]`).click();
          await expect(page.locator('[data-menu]')).toBeHidden();
        } else {
          await page.locator(`.site-nav a[href="${href}"]`).click();
        }
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        const geo = await page.evaluate((id) => {
          const target = document.getElementById(id);
          const head = target.querySelector('.section-head__num') || target;
          return {
            header: document.querySelector('.site-header').getBoundingClientRect().bottom,
            top: target.getBoundingClientRect().top,
            headTop: head.getBoundingClientRect().top,
            vh: window.innerHeight,
          };
        }, href.slice(1));
        expect(geo.top, href).toBeGreaterThanOrEqual(geo.header - 1);
        expect(geo.headTop, href).toBeGreaterThanOrEqual(geo.header - 1);
        expect(geo.headTop, href).toBeLessThan(geo.vh * 0.6);
      }
    });

    test('обход Tab: фокус всегда виден, не уходит под шапку и не застревает', async ({ page }) => {
      await page.goto('/');
      const seen = new Set();
      let first = null;
      for (let i = 0; i < 90; i += 1) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return { body: true };
          const id = el.id || `${el.tagName}:${el.getAttribute('href') || ''}:${(el.textContent || '').trim().slice(0, 20)}`;
          const rect = el.getBoundingClientRect();
          const header = document.querySelector('.site-header').getBoundingClientRect();
          const inHeader = !!el.closest('.site-header') || el.matches('.skip-link'); // ссылка-пропуск рисуется поверх шапки
          const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
          const ring = (node) => {
            if (!node) return false;
            const cs = getComputedStyle(node);
            return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
          };
          const box = label && (el.type === 'radio' || el.type === 'checkbox') ? label.getBoundingClientRect() : rect;
          return {
            id,
            ring: ring(el) || (label && (el.type === 'radio' || el.type === 'checkbox') && ring(label)) || ring(el.closest('.check')),
            inView: box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth,
            underHeader: !inHeader && box.bottom <= header.bottom + 4,
          };
        });
        if (info.body && seen.size > 30) break; // после последнего элемента фокус уходит из документа
        expect(info.body, `шаг ${i}: фокус ушёл на body`).toBeFalsy();
        if (first === info.id && i > 5) break; // круг замкнулся
        if (first === null) first = info.id;
        expect(info.ring, `${info.id}: нет видимого фокуса`).toBe(true);
        expect(info.inView, `${info.id}: вне экрана`).toBe(true);
        expect(info.underHeader, `${info.id}: под шапкой`).toBe(false);
        seen.add(info.id);
      }
      expect(seen.size).toBeGreaterThan(30);
    });

    if (mobile) {
      test('меню: открывается, фокус внутри, закрывается кнопкой и Esc с возвратом фокуса', async ({ page }) => {
        await page.goto('/');
        const toggle = page.locator('[data-menu-toggle]');
        const menu = page.locator('[data-menu]');
        await toggle.click();
        await expect(menu).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('.mobile-menu__list a').first()).toBeFocused();
        const panel = await page.locator('.mobile-menu__panel').boundingBox();
        expect(panel.y + panel.height).toBeLessThanOrEqual(800 + 1);
        await page.keyboard.press('Escape');
        await expect(menu).toBeHidden();
        await expect(toggle).toBeFocused();
        await toggle.click();
        await expect(menu).toBeVisible();
        await toggle.click();
        await expect(menu).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      });

      test('«/» в списке партнёров стоит сразу за словом, а не у правого края', async ({ page }) => {
        await page.goto('/#partners');
        const gaps = await page.evaluate(() => [...document.querySelectorAll('.partner-types li:not(:last-child)')].map((li) => {
          const range = document.createRange();
          range.selectNodeContents(li);
          const rects = [...range.getClientRects()];
          const textRight = rects.length ? rects[rects.length - 1].right : li.getBoundingClientRect().left;
          const after = getComputedStyle(li, '::after');
          // Правый край текста последней строки + «/» и отступы не должны упираться в край списка, если строка короткая.
          const fs = parseFloat(after.fontSize);
          return { text: li.textContent, textRight, liRight: li.getBoundingClientRect().right, fs };
        }));
        for (const g of gaps) expect(g.liRight - g.textRight, g.text).toBeLessThan(g.fs * 1.5);
      });

      test('подсказка «Количество» помещается в поле', async ({ page }) => {
        await page.goto('/#price');
        const fit = await page.locator('#lead-quantity').evaluate((input) => {
          const cs = getComputedStyle(input);
          const canvas = document.createElement('canvas').getContext('2d');
          canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const text = canvas.measureText(input.placeholder).width;
          const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          return { text, room };
        });
        expect(fit.text).toBeLessThanOrEqual(fit.room);
      });
    }
  });
}

test('404: ссылка «Перейти к содержимому», заголовок читается раздельно', async ({ page }) => {
  await page.goto('/404.html');
  await page.keyboard.press('Tab');
  const skip = page.locator('a.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute('href', '#main');
  await expect(skip).toHaveText(/Перейти к\s+содержимому/);
  const name = await page.locator('h1').evaluate((h) => h.textContent.replace(/\s+/g, ' ').trim());
  expect(name).toMatch(/^404\W+\s?Здесь лента оборвалась$/);
  expect(name).not.toContain('404Здесь');
});
