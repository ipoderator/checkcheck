// Тексты: место производства не называется, «Производства» отдельным разделом нет (его факты —
// в «Почему ВсеЧеки»), «Сотрудничество» компактное, форматы без «основных», подпись
// «ширина × намотка, мм» везде одна.
import { test, expect } from '@playwright/test';

const PLACE = /лейпц|leipz|лепциг|липецк/i;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Третья задача: отдельного «Производства» нет, его суть — строкой в «Почему ВсеЧеки» (G37, G38).
test('раздела «Производство» нет; номера разделов 01–06 подряд и одинаковы в метках ленты, заголовках и меню', async ({ page }) => {
  await expect(page.locator('#production')).toHaveCount(0);
  await expect(page.locator('a[href="#production"]')).toHaveCount(0);
  expect(await page.content()).not.toContain('production-roll');
  for (const menu of ['.site-nav', '.mobile-menu', '.site-footer__nav']) {
    await expect(page.locator(menu).locator('a', { hasText: /^\s*(\d+\s*)?Производство\s*$/ }), menu).toHaveCount(0);
  }

  const order = ['why', 'products', 'process', 'delivery', 'partners', 'faq'];
  const sections = await page.evaluate(() => [...document.querySelectorAll('main section[id]')].map((s) => ({
    id: s.id,
    mark: (s.querySelector(':scope > .tape-mark') || {}).textContent || '',
    num: (s.querySelector('.section-head__num') || {}).textContent || '',
  })));
  expect(sections.map((s) => s.id)).toEqual(['top', ...order, 'order', 'contacts']);
  const menu = await page.locator('.mobile-menu__list a').evaluateAll((as) => as.map((a) => ({
    href: a.getAttribute('href'), num: a.querySelector('.mono').textContent.trim(),
  })));
  expect(menu.map((m) => m.href)).toEqual([...order, 'contacts'].map((id) => `#${id}`));
  expect(menu.map((m) => m.num)).toEqual(['01', '02', '03', '04', '05', '06', '07']);
  order.forEach((id, i) => {
    const nn = String(i + 1).padStart(2, '0');
    const s = sections.find((x) => x.id === id);
    expect(s.mark, id).toMatch(new RegExp(`^${nn} · `));
    expect(s.num, id).toMatch(new RegExp(`^${nn} / `));
  });
  expect(sections.find((x) => x.id === 'contacts').num).toMatch(/^07 \/ Контакты/);
  const header = await page.locator('.site-nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const footer = await page.locator('.site-footer__nav a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(header).toEqual(menu.map((m) => m.href));
  expect(footer.slice(0, 7)).toEqual(menu.map((m) => m.href));
});

const WHY_FACTS = [
  /только кассов/i,
  /немецк/i,
  /собственн|сво[ёе] производств/i,
  /напрямую/i,
  /оптов/i,
  /любой регион России/i,
];

test('«Почему ВсеЧеки»: шесть фактов о производстве — компактно, в две строки на 1440, и каждый ровно один раз', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const facts = page.locator('#why .why-facts');
  await expect(facts).toBeVisible();
  const text = (await facts.innerText()).replace(/\u00A0/g, ' ');
  for (const fact of WHY_FACTS) expect(text, String(fact)).toMatch(fact);
  expect(text).not.toMatch(PLACE);

  const rows = await facts.locator(':scope > div').evaluateAll((items) => {
    const tops = new Set(items.map((el) => Math.round(el.getBoundingClientRect().top)));
    const lh = parseFloat(getComputedStyle(items[0].querySelector('dd')).lineHeight);
    return { count: items.length, lines: tops.size, tallest: Math.max(...items.map((el) => el.querySelector('dd').getBoundingClientRect().height)), lh };
  });
  expect(rows.count).toBe(6);
  expect(rows.lines).toBeLessThanOrEqual(2);
  expect(rows.tallest).toBeLessThan(rows.lh * 1.5); // каждый факт — одна строка

  // Ничего из строки фактов не повторяется в «Почему ВсеЧеки» второй раз (заголовок h2 — не в счёт).
  const rest = (await page.locator('#why').evaluate((s) => {
    const copy = s.cloneNode(true);
    copy.querySelectorAll('.why-facts, .section-head__title, .tape-mark, .section-head__num').forEach((el) => el.remove());
    return copy.textContent;
  })).replace(/\u00A0/g, ' ');
  for (const fact of WHY_FACTS) expect(rest, String(fact)).not.toMatch(fact);
});

test('главное изображение: alt про два рулона 57 × 40 и 80 × 80, без подписи', async ({ page }) => {
  const img = page.locator('.hero__roll img');
  await expect(img).toHaveAttribute('alt', '3D-визуализация двух рулонов кассовой ленты ВсеЧеки — форматы 57 × 40 и 80 × 80');
  await expect(page.locator('figcaption')).toHaveCount(0);
  expect(await page.content()).not.toContain('rolls-stack');
  await expect(page.locator('.site-footer__legal')).toContainText(/Изображения продукции на\s+сайте\s+—\s+3D-визуализации/);
});

// «Сотрудничество»: без огромного текста, польза для партнёра, ясный призыв (G39–G41).
const SCREENS = [
  { width: 1440, height: 900, max: 1.2 },
  { width: 375, height: 812, max: 2 },
];
for (const screen of SCREENS) {
  test(`«Сотрудничество» на ${screen.width}: заголовок как у других разделов, плашки ≤ 24 px, раздел не выше ${screen.max} экрана`, async ({ page }) => {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const geo = await page.evaluate(() => {
      const size = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      return {
        title: size('#partners-title'),
        other: size('#faq-title'),
        height: document.querySelector('#partners').getBoundingClientRect().height,
        chips: [...document.querySelectorAll('#partners .partner-types li')].map((li) => parseFloat(getComputedStyle(li).fontSize)),
        overflow: document.querySelector('#partners').scrollWidth - document.querySelector('#partners').clientWidth,
      };
    });
    expect(geo.title).toBe(geo.other);
    expect(geo.chips).toHaveLength(5);
    for (const fs of geo.chips) expect(fs).toBeLessThanOrEqual(24);
    expect(geo.height).toBeLessThanOrEqual(screen.height * screen.max);
    expect(geo.overflow).toBeLessThanOrEqual(0);
  });
}

test('«Сотрудничество»: три колонки — кому подходит, что получаете, что указать в заявке — только из фактов и полей формы', async ({ page }) => {
  const section = page.locator('#partners');
  const cols = section.locator('.partners__col');
  await expect(cols).toHaveCount(3);
  await expect(cols.locator('h3')).toHaveText(['Кому подходит', 'Что получаете', 'Что указать в заявке']);
  await expect(cols.nth(0).locator('.partner-types li')).toHaveText(['Магазины', 'Сети', 'Дилеры', 'Сервисные компании', 'Любые партнёры']);
  const gets = (await cols.nth(1).innerText()).replace(/\u00A0/g, ' ');
  for (const fact of [/напрямую от производителя/i, /оптовые поставки/i, /долгосрочное сотрудничество/i, /любой регион России/i, /57 × 40/, /80 × 80/, /под заказ/i]) {
    expect(gets, String(fact)).toMatch(fact);
  }
  // В заявке «Сотрудничество» есть компания, регион и комментарий — формат и объём пишут в комментарии.
  const asks = (await cols.nth(2).innerText()).replace(/\u00A0/g, ' ');
  for (const field of [/компани/i, /регион/i, /формат/i, /объём/i, /комментари/i]) expect(asks, String(field)).toMatch(field);
  for (const label of ['Компания', 'Регион или город доставки', 'Комментарий']) {
    await expect(page.locator('#lead-form .field__label', { hasText: label }).first()).toBeAttached();
  }
});

test('«Сотрудничество»: одна главная кнопка открывает форму на вкладке «Сотрудничество» с фокусом в форме, телефон рядом', async ({ page }) => {
  const cta = page.locator('#partners .partners__cta');
  const main = cta.locator('a.btn');
  await expect(main).toHaveCount(1);
  await expect(main).toHaveText('Оставить заявку на сотрудничество');
  await expect(main).toHaveAttribute('href', '#partner');
  await expect(main).toHaveClass(/btn--accent/);
  await expect(cta.locator('a[href="tel:+79202431957"]')).toBeVisible();
  await expect(cta.locator('a[href="tel:+79202431957"]')).not.toHaveClass(/btn/);

  await main.click();
  await expect(page).toHaveURL(/#partner$/);
  await expect(page.locator('[data-lead-type="partner"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-only="price"]').first()).toBeHidden();
  expect(await page.evaluate(() => !!document.activeElement.closest('#lead-form'))).toBe(true);
  await expect(page.locator('#lead-form')).toBeInViewport();
});

test('форматы: без «основных», другие размеры — под заказ с «например», подпись «ширина × намотка, мм» везде одна', async ({ page }) => {
  const text = await page.evaluate(() => document.body.innerText);
  const head = await page.evaluate(() => [document.title, document.querySelector('meta[name="description"]').content].join(' '));
  expect(text + head).not.toMatch(/основн/i);
  expect(text).not.toMatch(/нестандарт/i);

  const custom = page.locator('.format-card--custom');
  await expect(custom).toContainText(/Другие размеры\s+—\s+под\s+заказ/);
  await expect(custom).toContainText(/например/i);
  const faq = page.locator('#faq');
  await expect(faq).toContainText(/[Дд]ругие размеры\s+—\s+под\s+заказ/);
  await expect(faq).toContainText(/[Нн]апример/);

  // Подпись «ширина × намотка, мм» одинакова в карточках, FAQ и подсказке поля.
  const plain = text.replace(/\u00A0/g, ' ');
  const all = plain.match(/ширина[^\n]{0,20}/gi) || [];
  expect(all.length).toBeGreaterThanOrEqual(5);
  for (const found of all) expect(found).toMatch(/^ширина × намотка, мм/i);
  expect(plain).not.toMatch(/диаметр/i);
  await expect(page.locator('.format-card__caption')).toHaveText(['ширина × намотка, мм', 'ширина × намотка, мм']);
  await expect(page.locator('#lead-format-hint')).toHaveText('ширина × намотка, мм');
});
