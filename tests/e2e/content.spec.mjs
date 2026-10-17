// Тексты второй задачи: место производства не называется, раздел «Производство» с новой
// визуализацией без подписи, форматы без «основных», подпись «ширина × намотка, мм» везде одна.
import { test, expect } from '@playwright/test';

const PLACE = /лейпц|leipz|лепциг|липецк/i;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('«Производство»: собственное, без места; фоновое слово не географическое', async ({ page }) => {
  const section = page.locator('#production');
  await expect(section.locator('h2')).toContainText('Собственное производство');
  await expect(section.locator('h2')).not.toContainText(PLACE);
  const word = (await section.locator('.production__word').textContent()).trim();
  expect(word.length).toBeGreaterThan(2);
  expect(word).not.toMatch(PLACE);
  const spec = section.locator('.spec-list > div', { has: page.locator('dt', { hasText: 'Производство' }) });
  await expect(spec.locator('dd')).toHaveText('собственное');
  await expect(page.locator('.why-card').nth(1).locator('.why-card__title')).toHaveText(/^Своё производство$/);
});

test('«Производство»: production-roll 1600 × 1200 в <picture>, без видимой подписи, alt честный', async ({ page }) => {
  const media = page.locator('#production .production__media');
  await expect(media.locator('picture source[type="image/webp"]')).toHaveAttribute('srcset', 'assets/img/production-roll.webp');
  const img = media.locator('img');
  await expect(img).toHaveAttribute('src', 'assets/img/production-roll.png');
  await expect(img).toHaveAttribute('width', '1600');
  await expect(img).toHaveAttribute('height', '1200');
  const alt = await img.getAttribute('alt');
  expect(alt).toMatch(/кассов/i);
  expect(alt).toMatch(/3D-визуализаци/);
  await expect(page.locator('#production figcaption')).toHaveCount(0);
  expect(await page.content()).not.toContain('rolls-stack');
  await expect(page.locator('.site-footer__legal')).toContainText(/Изображения продукции на\s+сайте\s+—\s+3D-визуализации/);
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
