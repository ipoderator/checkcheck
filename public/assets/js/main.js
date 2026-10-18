// Модуль UI: мобильное меню, подсветка активного раздела, появление секций,
// лента-«чек» через всю страницу и лёгкий параллакс героя. Формой не владеет (см. lead-form.js).

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

root.setAttribute('data-ui-ready', '');

/* ---------- Шапка: подложка после начала прокрутки ---------- */
function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* ---------- Мобильное меню ---------- */
function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (!toggle || !menu) return;
  const label = toggle.querySelector('[data-menu-toggle-label]');
  const panel = menu.querySelector('.mobile-menu__panel');

  const focusables = () => [toggle, ...panel.querySelectorAll('a[href], button:not([disabled])')];

  function open() {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (label) label.textContent = 'Закрыть меню';
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('click', onOutside, true);
    const first = panel.querySelector('a[href]');
    if (first) first.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (label) label.textContent = 'Открыть меню';
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onOutside, true);
    if (restoreFocus) toggle.focus();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.shiftKey) next = index <= 0 ? items[items.length - 1] : items[index - 1];
    else next = index === -1 || index === items.length - 1 ? items[0] : items[index + 1];
    event.preventDefault();
    next.focus();
  }

  function onOutside(event) {
    if (panel.contains(event.target) || toggle.contains(event.target)) return;
    close({ restoreFocus: false });
  }

  toggle.addEventListener('click', () => (menu.hidden ? open() : close()));
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) close({ restoreFocus: false });
  });
  const wide = window.matchMedia('(min-width: 1380px)');
  wide.addEventListener('change', () => { if (wide.matches) close({ restoreFocus: false }); });
}

/* ---------- Активный раздел в навигации ---------- */
function initActiveSection() {
  const links = [...document.querySelectorAll('[data-nav-link]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((link) => [link.getAttribute('href').slice(1), link]));
  const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const visible = new Map();

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
    let best = null;
    let bestRatio = 0;
    for (const [id, ratio] of visible) if (ratio > bestRatio) { best = id; bestRatio = ratio; }
    for (const [id, link] of byId) {
      const active = id === best;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01, 0.5, 1] });
  sections.forEach((section) => observer.observe(section));
}

/* ---------- Появление секций ---------- */
function initReveal() {
  const items = [...document.querySelectorAll('[data-reveal]')];
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => {
    // Всё, что уже на первом экране, проявляется сразу — даже если край элемента у самого низа.
    if (el.getBoundingClientRect().top < window.innerHeight) requestAnimationFrame(() => el.classList.add('is-visible'));
    else observer.observe(el);
  });
}

/* ---------- Лента: выезжает при прокрутке вниз, сматывается при прокрутке вверх ---------- */
function initTape() {
  const tape = document.querySelector('[data-tape]');
  const marks = [...document.querySelectorAll('.tape-mark')];
  if (!tape) return;
  const clip = tape.querySelector('[data-tape-clip]');
  const paper = tape.querySelector('[data-tape-paper]');
  const tip = tape.querySelector('[data-tape-tip]');

  if (reducedMotion.matches) {
    marks.forEach((mark) => mark.classList.add('is-printed'));
    return;
  }

  let height = 0;
  let top = 0;
  let markTops = [];
  let printed = 0;
  let target = 0;
  let frame = 0;

  function measure() {
    const rect = tape.getBoundingClientRect();
    height = tape.offsetHeight;
    top = rect.top + window.scrollY;
    markTops = marks.map((mark) => mark.getBoundingClientRect().top + window.scrollY - top);
  }

  function aim() {
    // Кончик ленты держится чуть выше нижнего края экрана — в обе стороны прокрутки.
    const wanted = window.scrollY + window.innerHeight * 0.84 - top;
    target = Math.max(0, Math.min(height, wanted));
  }

  function render() {
    const hidden = Math.max(0, height - printed);
    clip.style.transform = `translate3d(0, ${-hidden}px, 0)`;
    paper.style.transform = `translate3d(0, ${hidden}px, 0)`;
    tip.style.transform = `translate3d(0, ${printed}px, 0)`;
    // Метка «напечатана», пока кончик ниже неё; при смотке выше — «стирается».
    markTops.forEach((y, i) => marks[i].classList.toggle('is-printed', y + 24 < printed));
  }

  function tick() {
    frame = 0;
    const diff = target - printed;
    printed = Math.abs(diff) < 0.5 ? target : printed + diff * 0.14;
    render();
    if (printed !== target) frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (reducedMotion.matches) return; // движение выключили на лету — лента остаётся целиком
    aim();
    if (!frame) frame = requestAnimationFrame(tick);
  }

  measure();
  render();
  // Небольшая пауза — и лента «выезжает» из логотипа.
  setTimeout(schedule, 250);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', () => { measure(); schedule(); });
  window.addEventListener('load', () => { measure(); schedule(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); schedule(); }).observe(tape);
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    printed = target = height;
    [clip, paper, tip].forEach((el) => { el.style.transform = ''; });
    marks.forEach((mark) => mark.classList.add('is-printed'));
  });
}

/* ---------- Параллакс героя ---------- */
function initParallax() {
  const el = document.querySelector('[data-parallax]');
  if (!el || reducedMotion.matches) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const y = Math.min(window.scrollY, window.innerHeight * 1.2);
    el.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0) rotate(${(y * 0.006).toFixed(2)}deg)`;
  };
  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  update();
}

/* ---------- Бегущая строка: пауза и пуск (WCAG 2.2.2) ---------- */
function initTicker() {
  const ticker = document.querySelector('.ticker');
  const toggle = ticker && ticker.querySelector('[data-ticker-toggle]');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const paused = ticker.classList.toggle('is-paused');
    toggle.setAttribute('aria-label', paused ? 'Запустить бегущую строку' : 'Остановить бегущую строку');
  });
}

initHeader();
initMenu();
initTicker();
initActiveSection();
initReveal();
initTape();
initParallax();
