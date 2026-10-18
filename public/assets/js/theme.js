// Тема сайта: светлая или тёмная. Обычный скрипт в <head> без defer — тема ставится до первой отрисовки.
// Выбор посетителя — data-theme на <html> и localStorage['vsecheki:theme']; без выбора атрибута нет
// и действует тема системы (@media (prefers-color-scheme: dark) в main.css).
// Кнопки: [data-theme-toggle] с aria-pressed="true", когда тёмная тема активна. Их может быть несколько.
(function () {
  'use strict';

  var KEY = 'vsecheki:theme';
  var root = document.documentElement;
  var system = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (e) {
      return null; // хранилище закрыто (приватный режим) — как нет выбора
    }
  }

  function write(value) {
    try {
      window.localStorage.setItem(KEY, value);
    } catch (e) {
      /* без хранилища выбор живёт до ухода со страницы */
    }
  }

  var choice = read();

  function current() {
    return choice || (system && system.matches ? 'dark' : 'light');
  }

  // theme-color — цвет фона текущей темы (токен --paper из main.css).
  function syncThemeColor() {
    var color = getComputedStyle(root).getPropertyValue('--paper').trim();
    if (!color) return;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i += 1) metas[i].setAttribute('content', color);
  }

  function syncButtons() {
    var pressed = current() === 'dark' ? 'true' : 'false';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i += 1) buttons[i].setAttribute('aria-pressed', pressed);
  }

  function apply() {
    if (choice) root.setAttribute('data-theme', choice);
    else root.removeAttribute('data-theme');
    syncThemeColor();
    syncButtons();
  }

  // Класс js включает кнопку (без JS она скрыта); на главной его уже поставил inline-скрипт.
  root.classList.add('js');
  apply();

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-theme-toggle]');
    if (!button) return;
    choice = current() === 'dark' ? 'light' : 'dark';
    write(choice);
    apply();
  });

  document.addEventListener('DOMContentLoaded', apply);

  // Пока посетитель не выбрал сам, тема идёт за системой — и на лету.
  function onSystemChange() {
    if (!choice) apply();
  }
  if (system) {
    if (system.addEventListener) system.addEventListener('change', onSystemChange);
    else if (system.addListener) system.addListener(onSystemChange);
  }

  // Выбор в другой вкладке сайта.
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    choice = read();
    apply();
  });
})();
