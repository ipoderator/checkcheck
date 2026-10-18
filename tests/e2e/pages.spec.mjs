// Юридические страницы, 404, файлы для поисковиков, мета-теги и разрешённые факты.
import { test, expect } from '@playwright/test';

// Числа, которые разрешено показывать на главной: форматы, телефон, ИНН, номера разделов и шагов.
const ALLOWED_NUMBERS = new Set([
  '57', '40', '80', '30', '50', '60', '70', '83',
  '8', '920', '243', '19', '7', '9202431957', '79202431957', '270399373377',
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
]);
const FORBIDDEN = /₽|руб|скидк|ГОСТ|ISO|BPA|сертифик|лидер|№\s*1|клиент(ов|ы)\s+довер|отзыв|г\/м|микрон|метр|год(а|у)?\s+на\s+рынке|ул\.|улица|ВКонтакте|Telegram-канал|фото/i;

test('главная: только разрешённые числа и ни одного запрещённого утверждения', async ({ page }) => {
  await page.goto('/');
  const text = await page.evaluate(() => document.body.innerText);
  const numbers = text.replace(/3D-/g, 'D-').match(/\d+/g) || [];
  const unknown = [...new Set(numbers.filter((n) => !ALLOWED_NUMBERS.has(n)))];
  expect(unknown).toEqual([]);
  expect(text).not.toMatch(FORBIDDEN);
  expect(text).not.toMatch(/lorem|ipsum/i);
});

test('мета-теги, Open Graph и JSON-LD Organization только из разрешённых фактов', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ВсеЧеки/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /кассов/i);
  // Адрес сайта не задан (site.config.json): canonical и og:url нет, картинка — корневой путь.
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', '/assets/img/og-image.png');
  expect(await page.content()).not.toContain('ДОМЕН');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /Собственное производство/);
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(ld['@type']).toBe('Organization');
  expect(ld.name).toBe('ВсеЧеки');
  expect(ld.telephone).toBe('+79202431957');
  expect(ld.email).toBe('ipoderator@yandex.ru');
  expect(ld.taxID).toBe('270399373377');
  expect(ld.legalName).toBe('ИП Чуркин Глеб Олегович');
  expect(ld.address.addressLocality).toBe('Липецк');
  expect(ld.address.streetAddress).toBeUndefined();
});

test('изображения: размеры заданы, ниже первого экрана — lazy, alt без слова «фото»', async ({ page }) => {
  await page.goto('/');
  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((img) => ({
    src: img.getAttribute('src'), w: img.getAttribute('width'), h: img.getAttribute('height'),
    alt: img.getAttribute('alt'), loading: img.getAttribute('loading'), hero: !!img.closest('.hero, .site-header'),
  })));
  expect(imgs.length).toBeGreaterThanOrEqual(3); // герой и два формата
  for (const img of imgs) {
    expect(img.w, img.src).toBeTruthy();
    expect(img.h, img.src).toBeTruthy();
    expect(img.alt, img.src).not.toBeNull();
    expect(img.alt, img.src).not.toMatch(/фото/i);
    if (!img.hero) expect(img.loading, img.src).toBe('lazy');
  }
});

for (const path of ['/privacy.html', '/consent.html']) {
  test(`${path}: оператор ИП Чуркин Г. О., ИНН, контакт для отзыва, без выдуманного адреса`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toMatch(/ИП\sЧуркин\sГлеб\sОлегович/);
    expect(text).toContain('270399373377');
    expect(text).toContain('ipoderator@yandex.ru');
    expect(text).not.toMatch(/ул\.|улица|проспект|дом\s\d/i);
    await expect(page.locator('a[href="./"], a[href="/"], a[href="index.html"]').first()).toBeVisible();
  });
}

test('privacy.html описывает данные, цели, сроки и права субъекта', async ({ page }) => {
  await page.goto('/privacy.html');
  const text = await page.evaluate(() => document.body.innerText);
  for (const word of ['Какие данные', 'Цели', 'Сроки', 'Права', 'отозвать']) expect(text).toContain(word);
});

for (const path of ['/privacy.html', '/consent.html']) {
  test(`${path}: называет передачу заявки через Telegram (трансграничную) и по e-mail`, async ({ page }) => {
    await page.goto(path);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).toContain('Telegram Messenger Inc.');
    expect(text).toMatch(/трансграничн/i);
    expect(text).toMatch(/электронн\S*\sпочт/i);
  });
}

test('privacy.html: срок хранения хеша IP описан так, как работает лимит частоты', async ({ page }) => {
  await page.goto('/privacy.html');
  const text = await page.evaluate(() => document.body.innerText);
  // Записи чистятся только при следующих заявках, а не по таймеру.
  expect(text).not.toMatch(/не\sпозднее\sчем\sчерез\sчас/);
  expect(text).toMatch(/при\sпоследующих\sобращениях\sк\sформе,\sесли\s\S+\sстарше\sчаса/);
});

test('404.html: оборванная лента и ссылка на главную', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('h1')).toContainText('404');
  await expect(page.locator('.tape-torn')).toBeVisible();
  await page.locator('a', { hasText: 'На главную' }).click();
  await expect(page.locator('h1')).toContainText('Кассовая лента');
});

test('robots.txt без заглушки домена; Sitemap появляется только с адресом сайта', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).not.toContain('ДОМЕН');
  expect(robots).not.toMatch(/^Sitemap:/m);
  expect(robots).toMatch(/Disallow: \/api\//);
});
