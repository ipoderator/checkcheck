# Архитектура

## Поток данных

Форма `#lead-form` (`public/index.html`) → `public/assets/js/lead-form.js` → `POST api/lead.php` → `LeadService::handle()` → каналы Telegram и e-mail → JSON-ответ → состояние формы.

- `public/api/lead.php` — единственная точка входа бэкенда: берёт метод, Content-Type, IP, вызывает `LeadService::fromConfig(Config::load())->handle(...)`. С `application/json` в `Accept` печатает JSON (так шлёт скрипт формы), иначе — HTML-страницу с тем же итогом и ссылкой «Вернуться к форме» (`LeadPage::render()`, форма без JS). Непойманное исключение -> 500 `server_error`.
- Порядок проверок в `LeadService`: метод -> ловушка и время -> валидация -> конфиг -> лимит по IP -> доставка. Валидация раньше «не настроено», чтобы посетитель сначала исправил поля; «не настроено» не расходует лимит, сбой доставки (502) расходует.
- Правила полей (телефон: только цифры и знаки номера; e-mail: без `..`, домен с точкой, кириллица допустима; обрезка Unicode-пробелов) и тексты ошибок одинаковы в `LeadRequest.php` и `lead-form.js` (`PHONE_CHARS`, `EMAIL_PATTERN`); `tests/e2e/form.spec.mjs` сверяет клиент с сервером.
- Коды ответов: 200 `ok` (в том числе притворный успех для бота), 400 `bad_request`, 405, 422 `validation` (+ `errors` по именам полей), 429 `rate_limited`, 503 `not_configured`, 502 `delivery_failed`, 500 `server_error`.
- Доставка: каналы `TelegramChannel` и `MailChannel` (интерфейс `LeadChannel`: `name()`, `isConfigured()`, `send()` бросает `RuntimeException`). Успех — хотя бы один канал. Все настроенные упали -> заявка в `STORAGE_DIR/failed-leads.jsonl`, ответ 502.
- Заявки больше нигде не хранятся (ADR 0003). Лимит: 5 заявок с IP за 600 с, файлы `STORAGE_DIR/ratelimit/*.json` (`RateLimiter`).
- Поля запроса и их ограничения — в `public/app/LeadRequest.php` (источник истины, не дублировать сюда).

## Границы модулей

- `public/` — ровно то, что грузится на хостинг. `tests/`, `tools/`, `docs/` на хостинг не идут.
- `public/app/` — библиотека и конфиг; закрыта от браузера (`.htaccess`, на `php -S` — `tools/dev-router.php`). Вход туда только через `api/lead.php` (константа `VSECHEKI_APP`, `app/bootstrap.php`).
- `public/storage/` — рабочие файлы (rate limit, письма-файлы для тестов, резерв заявок); в git только `.htaccess`.
- `theme.js` владеет темой целиком на пяти страницах: `index.html`, `privacy.html`, `consent.html`, `404.html` и HTML-ответ `LeadPage.php`. Обычный скрипт в `<head>` без `defer`/`async` (на index — после inline-скрипта), чтобы тема встала до первой отрисовки. Выбор посетителя — `data-theme="light|dark"` на `<html>` и `localStorage['vsecheki:theme']` (в try/catch, мусор = нет выбора); без выбора атрибута нет и действует тема системы, за её сменой скрипт следит. Кнопки `[data-theme-toggle]` (`aria-pressed="true"` при тёмной, их может быть несколько) синхронны; `meta[name="theme-color"]` получает `--paper`. Класс `js` на `<html>` на остальных страницах ставит он; без JS кнопка скрыта.
- Цвета — токены `:root` в `main.css`; тёмная тема переопределяет те же токены в двух одинаковых блоках (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` и `:root[data-theme="dark"]`), форма-«чек» `.receipt` — со светлыми значениями в обеих темах. При печати (`@media print`) в любой теме действуют светлые значения.
- `main.js` владеет UI: меню, подсветка раздела, `[data-reveal]` -> `is-visible`, лента `[data-tape]`, параллакс героя. Формой и темой не владеет.
- `lead-form.js` владеет формой, не знает о UI-модуле и тему не трогает. DOM-контракт: `[data-lead-form]`; тип заявки — радиогруппа `name="type"` (`price` checked | `partner`) в `fieldset.tabs--choice`, видимая без JS; с JS радио скрыты, а вкладки `.tabs--js` с `[data-lead-type]` (`price` | `partner`, `role="tab"`, `aria-selected`) выставляют значение радиогруппы; поля только для price в `[data-only="price"]`, ошибки `[data-error-for]`, статус `[data-lead-status]`, состояния `data-state="idle|sending|success|error"`, кнопки формата `[data-lead-format]`, ссылки `#price`/`#partner` открывают вкладку.
- Черновик формы — `localStorage` `vsecheki:lead-draft:v1`, всегда в try/catch.
- Без JS форма уходит обычным POST: тип выбирается радиокнопками, поле «Нужный размер» видно (прячет его скрипт), ответ — HTML-страница.
- Изображения — `public/assets/img/*`, имена фиксированы; рендер `tools/render/` (Three.js + Playwright, затем Python-кодирование). Руками не править.
- Адрес сайта — `site.config.json` (`siteUrl`); `tools/set-site-url.mjs` (`npm run set-site-url -- https://…`) проставляет canonical, `og:url`/`og:image`, JSON-LD, `Sitemap:` в robots.txt и пишет `sitemap.xml`. Места для canonical в страницах помечены комментарием `site-url`. Пустой адрес: без canonical, `og:url` и `sitemap.xml`, картинки корневыми путями.

## Принятые соглашения

- Конфиг: `getenv(KEY)`, если непустое, иначе `public/app/config.php` (массив), иначе `''`. Имена ключей — `.env.example` и `ConfigLoader.php`.
- Тестовые переключатели конфига: `TELEGRAM_API_BASE`, `MAIL_TRANSPORT=file` (письма в `STORAGE_DIR/outbox/`), `STORAGE_DIR`.
- Время заполнения формы (`form_elapsed_ms`) меряет браузер; поле пустое или отсутствует — проверка пропускается (ADR 0005).
- Антиспам без капчи: скрытое поле `website`, минимальное время 3000 мс, лимит по IP (ADR 0004).
- Секреты не в репозитории: значения ключей пустые, `tools/check-secrets.mjs` это проверяет.
- Без сборщиков и фреймворков, без внешних запросов со страницы (ADR 0001); PHP 7.4 без Composer (ADR 0002).
- Весь видимый текст по-русски; типографика: «ёлочки», неразрывный пробел после коротких слов и перед «—», «×» в форматах.
- `prefers-reduced-motion: reduce` выключает анимацию; без JS контент виден.
- Логи — `error_log()` без персональных данных.
- Тесты: HTTP-контракт `lead.php` — `tests/api` (PHP-сервер на случайном порту, поддельные Telegram и SMTP из `tests/helpers/`); браузер — `tests/e2e` (Playwright против `php -S` на 8091).
