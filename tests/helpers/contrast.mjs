// Проверка контраста WCAG AA в браузере: общий помощник e2e (тема и сквозная проверка).
// AA: обычный текст ≥ 4.5:1, крупный (≥ 24 px или ≥ 18.66 px жирный) ≥ 3:1 — к фону под ним.
export async function lowContrastTexts(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const p = (c.match(/[\d.]+/g) || []).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (top, under) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const lum = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    // Сплошной фон под элементом; null — если под ним картинка или градиент (такие места смотрят глазами).
    const backgroundOf = (el) => {
      const layers = [];
      for (let node = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage !== 'none' && !node.matches('.ship-label, .tape__end')) return null;
        const bg = parse(cs.backgroundColor);
        if (bg.a > 0) { layers.push(bg); if (bg.a >= 1) break; }
      }
      return layers.reverse().reduce((acc, layer) => over(layer, acc), { r: 255, g: 255, b: 255, a: 1 });
    };
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[aria-hidden="true"], .visually-hidden, script, style, svg')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const cs = getComputedStyle(el);
      const bg = backgroundOf(el);
      if (!bg) continue;
      // Контурные цифры (прозрачная заливка + обводка) читаются по цвету обводки.
      const fill = parse(cs.color);
      const fg = over(fill.a === 0 && parseFloat(cs.webkitTextStrokeWidth) > 0 ? parse(cs.webkitTextStrokeColor) : fill, bg);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const value = ratio(fg, bg);
      if (value < (large ? 3 : 4.5)) bad.push(`${el.tagName.toLowerCase()}.${el.className} «${el.textContent.trim().slice(0, 30)}» ${value.toFixed(2)}`);
    }
    return bad;
  });
}

