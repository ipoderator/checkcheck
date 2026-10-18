// Левая лента: ширина по экранам, контраст края к фону в обеих темах, выравнивание сетки
// и движение за прокруткой в обе стороны.
import { test, expect } from '@playwright/test';

const TAPE_SECTIONS = ['.hero', '#why', '#products', '#process', '#delivery', '#partners', '#faq'];

for (const [width, min] of [[360, 22], [375, 22], [639, 22], [640, 32], [768, 32], [1023, 32], [1024, 40], [1440, 40]]) {
  test(`лента на ${width}: шире ${min} px, не наезжает на текст, сетка выровнена`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const geo = await page.evaluate(() => {
      const rect = (el) => el.getBoundingClientRect();
      const tape = rect(document.querySelector('[data-tape]'));
      const mark = rect(document.querySelector('.site-header .logo__mark'));
      const contentLeft = Math.min(...[...document.querySelectorAll('main .section-head, .hero__copy')].map((el) => rect(el).left));
      return {
        tapeWidth: tape.width,
        tapeRight: tape.right,
        tapeCenter: tape.left + tape.width / 2,
        markCenter: mark.left + mark.width / 2,
        contentLeft,
        cutLeft: rect(document.querySelector('.order__cut span')).left,
        orderHeadLeft: rect(document.querySelector('.order__head')).left,
        overflow: document.scrollingElement.scrollWidth - window.innerWidth,
      };
    });
    expect(geo.tapeWidth).toBeGreaterThanOrEqual(min);
    expect(geo.contentLeft - geo.tapeRight).toBeGreaterThanOrEqual(8);
    expect(Math.abs(geo.markCenter - geo.tapeCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(geo.cutLeft - geo.orderHeadLeft)).toBeLessThanOrEqual(1);
    expect(geo.overflow).toBeLessThanOrEqual(0);

    if (width < 1380) {
      await page.locator('[data-menu-toggle]').click();
      const menuLeft = await page.locator('.mobile-menu__list a').first().evaluate((el) => el.getBoundingClientRect().left);
      expect(Math.abs(menuLeft - geo.contentLeft)).toBeLessThanOrEqual(1);
    }
  });
}

// Пиксели одной строки экрана → цвета фона слева от ленты, её края и бумаги.
async function sampleTape(page, selector) {
  const spot = await page.evaluate((sel) => {
    const section = document.querySelector(sel);
    section.scrollIntoView({ block: 'center', behavior: 'instant' });
    const tape = document.querySelector('[data-tape]').getBoundingClientRect();
    const box = section.getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
    const top = Math.max(box.top, header);
    const bottom = Math.min(box.bottom, window.innerHeight);
    return { left: Math.round(tape.left), right: Math.round(tape.right), y: Math.round((top + bottom) / 2) };
  }, selector);
  const shot = await page.screenshot({ clip: { x: 0, y: spot.y, width: spot.right + 8, height: 1 } });
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(0, 0, img.width, 1).data];
  }, shot.toString('base64'));
  const at = (x) => ({ r: px[x * 4], g: px[x * 4 + 1], b: px[x * 4 + 2] });
  return { bg: at(spot.left - 3), edge: at(spot.left), paper: at(spot.left + 3) };
}

function contrast(a, b) {
  const lum = ({ r, g, b: bl }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

for (const scheme of ['light', 'dark']) {
  for (const width of [1440, 375]) {
    test(`край ленты отделён от фона ≥ 3:1 на светлых и тёмных секциях: ${scheme}, ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/');
      for (const selector of TAPE_SECTIONS) {
        const { bg, edge, paper } = await sampleTape(page, selector);
        const best = Math.max(contrast(edge, bg), contrast(paper, bg));
        expect(best, `${selector}: фон ${JSON.stringify(bg)}, край ${JSON.stringify(edge)}, бумага ${JSON.stringify(paper)}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
}

test('лента выезжает при прокрутке вниз и сматывается при прокрутке вверх', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const state = () => page.evaluate(() => {
    const tape = document.querySelector('[data-tape]').getBoundingClientRect();
    const clip = document.querySelector('[data-tape-clip]').getBoundingClientRect();
    const printed = clip.bottom - tape.top;
    const marks = [...document.querySelectorAll('.tape-mark')].map((mark) => ({
      below: mark.getBoundingClientRect().top - tape.top > printed + 24,
      printed: mark.classList.contains('is-printed'),
    }));
    return { printed: Math.round(printed), marks };
  });
  // Ждём, пока лента доедет: два замера подряд совпадают.
  const settled = async () => {
    let last = -1;
    await expect.poll(async () => {
      const { printed } = await state();
      const same = printed === last;
      last = printed;
      return same;
    }, { intervals: [150], timeout: 8000 }).toBe(true);
    return state();
  };
  const scrollTo = (y) => page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);

  await scrollTo(2500);
  const middle = await settled();
  await scrollTo(5000);
  const deep = await settled();
  expect(deep.printed).toBeGreaterThan(middle.printed + 1000);

  await scrollTo(1200);
  const back = await settled();
  expect(back.printed).toBeLessThan(deep.printed - 1000);
  const below = back.marks.filter((mark) => mark.below);
  expect(below.length).toBeGreaterThan(0);
  expect(below.filter((mark) => mark.printed)).toEqual([]);
  expect(back.marks.some((mark) => !mark.below && mark.printed)).toBe(true);
});
