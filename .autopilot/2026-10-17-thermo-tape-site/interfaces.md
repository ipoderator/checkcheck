# Границы и правила проекта

Читать первым каждому исполнителю и ревьюеру.

## Правила проекта

1. **Факты — только из таблицы «Факты, которые разрешено использовать» в `spec.md`.** Любая цифра, сертификат, клиент, отзыв, срок, адрес улицы, соцсеть — запрещены. Сомневаешься — не пиши.
2. **Никаких секретов в репозитории.** Ключи конфига — только имена; значения пустые.
3. **Ничего не публиковать**: никаких запросов к реальному `api.telegram.org`, никаких писем наружу, никакого деплоя. Тесты используют поддельные каналы.
4. Весь видимый текст — на русском. Типографика: «ёлочки», неразрывный пробел после коротких слов и перед «—», знак «×» в форматах.
5. Без внешних запросов со страницы: шрифты, скрипты и картинки — свои, из `public/`.
6. Без сборщиков и фреймворков на фронте: ES-модули или обычные скрипты, чистый CSS с custom properties.
7. `prefers-reduced-motion: reduce` выключает всю анимацию; без JS весь контент виден, кроме интерактивности формы.

### Договорились с владельцем — не пересматривать (из PROGRESS.md)

- Факты на сайте — только сообщённые владельцем: «Не придумывай цены, характеристики, сертификаты, клиентов, отзывы, контакты и другие факты, которых я не сообщил» (R21–R27)
- «полностью убери упоминания немецкого города Лейпциг»; «Новое место производства не придумывай» (R08 снят, G15–G17) — тест `tests/api/no-leipzig.test.mjs`
- «Липецк в контактах и юридических реквизитах — другой город. Не удаляй и не меняй его.» (G18)
- Форматы 57 × 40 и 80 × 80, без слова «основные»; «57 на 40 это намотка» — подпись «ширина × намотка, мм»; другие размеры — под заказ, примеры с «например» (G01, G02, G23, G24)
- «Фото нет - сделай их сам» — 3D-визуализации, не выдаются за фото (G03, G20)
- Заявки — в Telegram с дублем на e-mail; токен, chat id, адрес почты — пустые, вне кода (G06–G09)
- «Публиковать сайт без моего отдельного разрешения не нужно»; «Сайт не публикуй» (G12, G30)
- Страна — Россия; «Сотрудничество - это все» (R37i, R20)

## Границы, решённые в спецификации

### Структура репозитория

```
public/                      ← ровно то, что загружается в public_html
  index.html  privacy.html  consent.html  404.html
  robots.txt  sitemap.xml  .htaccess  favicon.svg
  assets/css/main.css
  assets/js/main.js          ← навигация, анимации, лента (модуль UI)
  assets/js/lead-form.js     ← модуль формы
  assets/fonts/*.woff2
  assets/img/…               ← см. «Изображения»
  api/lead.php               ← единственная точка входа бэкенда
  app/                       ← библиотека и конфиг; закрыт .htaccess
    .htaccess  (Require all denied)
    config.example.php
    config.php               ← в .gitignore, создаёт владелец
    bootstrap.php  ConfigLoader.php (класс `Config`; имя не `Config.php` — на macOS совпадает с `config.php`)  LeadRequest.php  RateLimiter.php
    TelegramChannel.php  MailChannel.php  SmtpClient.php  LeadService.php
  storage/                   ← закрыт .htaccess; создаётся при необходимости
    .htaccess
tools/render/                ← рендер изображений (Node + Playwright + Three.js)
tests/api/*.test.mjs         ← node:test, HTTP-контракт lead.php
tests/e2e/*.spec.mjs         ← Playwright
package.json                 ← dev, test, images; только devDependencies
README.md
```

### Контракт `POST /api/lead.php` — шов между формой и бэкендом

Запрос: `multipart/form-data` или `application/x-www-form-urlencoded`.

| Поле | Тип | Обязательно | Ограничение |
|---|---|---|---|
| `type` | `price` \| `partner` | да | |
| `name` | строка | да | 2–100 символов после trim |
| `phone` | строка | да | после удаления всего, кроме цифр: 11 цифр с первой 7 или 8, либо 10 цифр с первой 9 → нормализуется в `+7XXXXXXXXXX` |
| `email` | строка | нет | `filter_var FILTER_VALIDATE_EMAIL`, ≤ 254 |
| `company` | строка | нет | ≤ 150 |
| `region` | строка | нет | ≤ 150 |
| `format` | `57x40` \| `80x80` \| `other` \| пусто | нет | только при `type=price` |
| `format_custom` | строка | нет | ≤ 100; обязательно при `format=other` |
| `quantity` | строка | нет | ≤ 100 (свободный текст: «200 рулонов», «5 коробок») |
| `message` | строка | нет | ≤ 2000 |
| `consent` | `1` | да | |
| `website` | строка | — | ловушка: должна быть пустой |
| `form_elapsed_ms` | число ≥ 0 (дробь допустима; клиент шлёт `Math.round`) | нет | мс с момента готовности формы, **измерено в браузере** (`performance.now()`); `< 3000`, отрицательное, нечисловое → считается ботом; поле отсутствует **или пустое** (форма без JS) → проверка времени пропускается; в разметке скрытого поля с пустым значением нет — JS добавляет его при отправке. *D01, таск 01: сравнение часов браузера и сервера теряло настоящие заявки при спешащих часах.* |
| `page` | строка | нет | ≤ 300, путь страницы-источника |

Ответ — всегда JSON `Content-Type: application/json; charset=utf-8`:

| HTTP | Тело | Когда |
|---|---|---|
| 200 | `{"ok":true}` | доставлено хотя бы в один канал; **или** сработала ловушка/слишком быстро (притворный успех, ничего не отправлено) |
| 400 | `{"ok":false,"code":"bad_request"}` | не POST-тело / не тот тип |
| 405 | `{"ok":false,"code":"method_not_allowed"}` | не POST |
| 422 | `{"ok":false,"code":"validation","errors":{"phone":"Укажите телефон…"}}` | ошибки полей; ключи = имена полей; тексты по-русски |
| 429 | `{"ok":false,"code":"rate_limited"}` | > 5 заявок с IP за 600 с |
| 503 | `{"ok":false,"code":"not_configured"}` | не настроен ни Telegram (токен **и** chat id), ни e-mail (`LEAD_EMAIL_TO`) |
| 502 | `{"ok":false,"code":"delivery_failed"}` | все настроенные каналы упали; заявка записана в `storage/failed-leads.jsonl` |

Проверки идут в этом порядке: метод → ловушка/время → валидация → конфиг → лимит → доставка. Валидация идёт раньше «не настроено», чтобы посетитель сначала исправил поля; «не настроено» не расходует лимит (вторая задача, ист. 62). Без `application/json` в `Accept` ответ — HTML-страница для человека (ист. 63).

### Конфиг — `app/Config.php`

`Config::load(): array` возвращает ключи (все строки, по умолчанию `''`):

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `LEAD_EMAIL_TO`, `LEAD_EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` (`ssl` | `tls` | `''`),
и **тестовые переключатели**: `TELEGRAM_API_BASE` (по умолчанию `https://api.telegram.org`), `MAIL_TRANSPORT` (`''` — авто: smtp, если есть `SMTP_HOST`, иначе `mail`; `file` — писать письма в `storage/outbox/` для тестов), `STORAGE_DIR` (по умолчанию `public/storage`).

Источник для каждого ключа: `getenv(KEY)`, если непустое, иначе `app/config.php` (возвращает массив), иначе `''`.

### Каналы — `app/*Channel.php`

```php
interface LeadChannel { public function name(): string; public function isConfigured(): bool; public function send(array $lead): void; /* throws RuntimeException */ }
```

`$lead` — нормализованная заявка: те же ключи, что в запросе (без `website`, `form_elapsed_ms`, `consent`), плюс `type_label` («Рассчитать цену» | «Сотрудничество»), `phone` в `+7…`, `received_at` (ISO, Europe/Moscow), `ip`.
`LeadService::handle(array $post, string $ip): array{status:int, body:array}` — вся логика контракта; `api/lead.php` только вызывает его и печатает ответ.

Логи — `error_log()` без персональных данных (только канал и текст ошибки).

### Модуль формы — DOM-контракт (`index.html` ↔ `lead-form.js`)

- `<form id="lead-form" data-lead-form novalidate action="api/lead.php" method="post">`
- Вкладки: `<button role="tab" data-lead-type="price">` и `data-lead-type="partner"`; скрытое `<input name="type">`. Поля, которые есть только у price, обёрнуты в `[data-only="price"]`.
- Каждое поле: `<input name="…" id="lead-…">`, рядом `<p class="field-error" id="lead-…-error" data-error-for="…">`; поле получает `aria-invalid="true"` и `aria-describedby`.
- Статус: `<div data-lead-status role="status" aria-live="polite">`; состояния на форме: `data-state="idle|sending|success|error"`.
- Кнопка: `<button type="submit" data-lead-submit>`.
- Внешние ссылки на форму: `href="#price"`, `href="#partner"`; кнопка формата: `data-lead-format="57x40|80x80|other"` → открывает вкладку price и выставляет формат.
- Черновик: ключ `localStorage` `vsecheki:lead-draft:v1` — JSON полей (без `website`, `form_elapsed_ms`); доступ в try/catch.
- Без JS: форма отправляется обычным POST; `lead.php` при `Accept`, не содержащем `application/json`, отвечает HTML-страницей для человека (`LeadPage`, ADR 0007). JS шлёт `Accept: application/json` и получает JSON.

### Модуль UI — `main.js`

Владеет: мобильным меню, подсветкой активного раздела, появлением секций (`[data-reveal]` → класс `is-visible`), лентой (`[data-tape]`), параллаксом героя. Формой не владеет.

### Изображения — `public/assets/img/`

Имена фиксированы, рендерит `tools/render/`:

| Файл | Где | Размер |
|---|---|---|
| `production-roll.webp` / `.png` | раздел «Производство», под тёмный фон `#141517`, край растворяется в фон | 1600 × 1200 |
| `hero-roll.webp` / `.png` | первый экран: рулон с размотанной лентой, прозрачный фон | 1600 × 1600 |
| `roll-57x40.webp` / `.png` | карточка формата | 1000 × 1000, прозрачный фон |
| `roll-80x80.webp` / `.png` | карточка формата | 1000 × 1000, прозрачный фон |
| `og-image.png` | Open Graph | 1200 × 630 |
| `favicon.svg` (в корне `public/`), `apple-touch-icon.png` (180) | иконки | |

Рулон: белая термобумага с лёгкой фактурой, серая картонная втулка, мягкая тень. На размотанной ленте — «чек» со словом ВсеЧеки и абстрактными строками без цифр-фактов.

### Швы для тестов

1. HTTP-контракт `lead.php` — `tests/api`, PHP-сервер на случайном порту, `MAIL_TRANSPORT=file`, `TELEGRAM_API_BASE` → локальный поддельный сервер на Node.
2. Браузер — `tests/e2e` через Playwright против `php -S`: состояния формы, адаптивность, reduced motion.

### Команды

| Команда | Что делает |
|---|---|
| `npm install` | dev-зависимости (Playwright, Three.js для рендера) |
| `npm run dev` | `php -S 127.0.0.1:8080 -t public` |
| `npm test` | `php -l` по всем PHP + `tests/api` + `tests/e2e` |
| `npm run images` | перерендерить изображения |

## Стек, версии, проверка

- Локально: PHP 8.5 (Homebrew, `/opt/homebrew/bin/php`), Node 25, Python 3.11 + Pillow. Chromium для Playwright уже в кеше (`~/Library/Caches/ms-playwright`); при несовпадении версии — `npx playwright install chromium`.
- **Хостинг — PHP ≥ 7.4.** Локальный PHP новее, поэтому синтаксис ограничен 7.4: **нельзя** `match`, именованные аргументы, `?->`, `enum`, `readonly`, union-типы в сигнатурах, `mixed`, `static` как возвращаемый тип, атрибуты `#[…]`, `str_contains`/`str_starts_with`/`str_ends_with` (писать через `strpos`), конструктор-промоушн. Без расширений, кроме стандартных (`json`, `mbstring` — с запасным путём, если нет; `curl` — с запасным путём через `stream_context`).
- **Одна команда проверки — `npm test`** (создаёт таск 01): `php -l` всех файлов в `public/` + проверка «нет секретов» + `node --test tests/api` + `npx playwright test` (e2e добавит таск 03; пока e2e нет — шаг не падает).
- Один файл: `node --test tests/api/lead.test.mjs`; `npx playwright test tests/e2e/form.spec.mjs`.
- Не трогать: `.autopilot/` (кроме чтения), `AGENTS.md`, `CLAUDE.md`.

## Выставлено готовыми тасками

### T01 — бэкенд заявок
- `LeadService::handle(array $post, string $ip, string $method='POST', string $contentType=…): array{status,body}`; `LeadService::fromConfig(array $config)`; `Config::load(): array` (файл `app/ConfigLoader.php`); `LeadChannel::name()` = `telegram` | `email`.
- Дополнительный ответ 500 `{"ok":false,"code":"server_error"}` — только непойманное исключение; форма показывает его как «не удалось доставить».
- Хранилище: `STORAGE_DIR/ratelimit/*.json`, `STORAGE_DIR/outbox/*.eml` (тесты), `STORAGE_DIR/failed-leads.jsonl`.
- npm-скрипты: `dev`, `test`, `test:api`, `test:e2e`, `images`. e2e-сервер Playwright: `127.0.0.1:8091` (`E2E_PORT`), `MAIL_TRANSPORT=file`, конфиг пустой → `not_configured`. **Лимит 5 заявок с IP действует и в e2e** — успешные отправки в e2e подменять через `page.route` или держать ≤ 4 реальных.
- `page` обрезается до 300 символов; у `type=partner` поля format/format_custom/quantity отбрасываются.
- SMTP: при `SMTP_USER` и `SMTP_SECURE` ∉ {ssl,tls} клиент включает STARTTLS, если сервер его объявил, иначе ошибка канала (кроме localhost).

## Вторая задача

- Адрес сайта: `site.config.json` (`siteUrl`), `npm run set-site-url -- <url>` (`tools/set-site-url.mjs`). Пустой `siteUrl` → нет canonical/og:url/sitemap, ссылки корневые.
- Правило «нет Лейпцига» проверяется тестом по `public/`, `README.md`, `tools/render`.

## Третья задача (2026-10-18) — границы

Карта кода с точными именами и строками — `notes.md` → «Третья задача (2026-10-18): карта кода». Истории 71–89 — `spec.md` → «Третья задача».

### Порядок разделов после удаления `#production`

`#top` (без номера) → 01 `#why` «Почему ВсеЧеки» → 02 `#products` → 03 `#process` → 04 `#delivery` → 05 `#partners` → 06 `#faq` → `#order` → `#contacts`. Номера в `tape-mark` («NN · …»), `section-head__num` («NN / …»), в меню шапки, мобильном меню и подвале — подряд, одинаковые везде. Пункт «Производство» исчезает из всех трёх меню.

### Тема — `public/assets/js/theme.js` (новый, владеет темой целиком)

- Обычный (не module) скрипт, подключается в `<head>` **без `defer`/`async`** на `index.html`, `privacy.html`, `consent.html`, `404.html` и в HTML-ответе `LeadPage.php` — чтобы тема применилась до отрисовки.
- Состояние: атрибут `data-theme="light|dark"` на `<html>` — **только когда посетитель выбрал сам**. Нет выбора → атрибута нет, действует система.
- Хранилище: `localStorage['vsecheki:theme']` = `light` | `dark`; чтение и запись в try/catch; мусорное значение = нет выбора.
- Кнопки: `<button type="button" class="theme-toggle" data-theme-toggle aria-pressed="true|false" aria-label="Тёмная тема">` — `aria-pressed="true"`, когда активна тёмная (выбранная или системная). Кнопок на странице может быть несколько (шапка, мобильное меню) — все синхронны. Скрипт сам вешает обработчики после `DOMContentLoaded` и следит за `matchMedia('(prefers-color-scheme: dark)')`, пока выбора нет.
- Без JS кнопка скрыта: CSS `html:not(.js) .theme-toggle { display: none }` (класс `js` уже ставит inline-скрипт в `<head>` index; на остальных страницах его ставит `theme.js`).
- `<meta name="theme-color">` — `theme.js` выставляет значение токена фона текущей темы.
- `main.js` и `lead-form.js` темой не занимаются.

### Цвета — `main.css`

- Все цвета — через токены `:root`. Хардкоды из `notes.md` (шапка, подвал, ошибки формы, `#8E9096`, `#FF8A80` и т. п.) переводятся на токены (новые токены допустимы).
- Тёмная тема — переопределение тех же токенов в двух местах с одним набором значений:
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` и `:root[data-theme="dark"] { … }`.
- Светлая тема — **те же значения**, что сейчас (стиль сохранён, история 86).
- SVG-логотип/иконки — `currentColor` или токены, а не `#FFF`/`#141517`.

### Лента — `initTape` в `main.js`, стили `.tape*` в `main.css`

- Разметка `[data-tape]`, `[data-tape-clip]`, `[data-tape-paper]`, `[data-tape-tip]`, `.tape-mark` — прежняя.
- `aim()`: цель = положение у нижней части экрана **в обе стороны** (без `Math.max` с прежней целью), ограничено `[0, height]`. Метки: `is-printed` ставится, когда кончик ниже метки, и **снимается**, когда выше.
- Reduced motion — как сейчас: никаких `transform` внутри `[data-tape]` (тест `layout.spec.mjs`), все метки напечатаны.
- Ширина — через `--tape-w`/`--rail-x`/`--rail-gap` по брейкпоинтам; всё, что от них зависит (сетка контента, логотип, мобильное меню, `.order__cut`, `.doc`), должно остаться выровненным.

### Тип заявки без JS — DOM-контракт формы (правка)

- Вместо `<input type="hidden" name="type">` — две радиокнопки `<input type="radio" name="type" value="price">` (checked) и `value="partner"` с подписями «Рассчитать цену» / «Сотрудничество», видимые и рабочие без JS.
- С JS — те же вкладки, что сейчас: элементы с `data-lead-type="price|partner"` и `role="tab"`, `aria-selected`; внешний вид вкладок не меняется. Как именно (радио внутри `label`-вкладок или радио скрываются, а кнопки показываются) — решает исполнитель, но селекторы `[data-lead-type="…"]`, якоря `#price`/`#partner` и поле `type` в POST остаются.
- Черновик `vsecheki:lead-draft:v1` и контракт `POST /api/lead.php` не меняются.

### Изображения (правка таблицы выше)

| Файл | Где | Размер |
|---|---|---|
| `hero-roll.webp` / `.png` (имя прежнее, содержимое новое) | первый экран: два рулона 57 × 40 и 80 × 80, прозрачный фон, годится для обеих тем | 1600 × 1600 |
| `og-image.png` | Open Graph — из той же сцены героя | 1200 × 630 |

Имя `hero-roll.*` сохраняется, чтобы смена картинки не трогала `index.html` (alt меняет таск со страницей). `production-roll.*` удаляются из `public/`, `tools/render/` (сцена, `render.mjs`, `shots.js`), тестов и README. Каждый PNG ≤ 400 КБ (`quantize.mjs`); порог числа PNG в `images.test.mjs` пересчитать по факту.

### Швы для тестов

Прежние: `tests/api` (HTTP-контракт, файлы) и `tests/e2e` (Playwright против `php -S`). Тема проверяется в e2e через `page.emulateMedia({ colorScheme })` и `localStorage`; без JS — `test.use({ javaScriptEnabled: false })`.

### T06 — короче лендинг (выставлено)

- Тип заявки: `<fieldset class="tabs tabs--choice no-js-only">` с радио `name="type"` (`#lead-type-price` checked, `#lead-type-partner`), подписи «Рассчитать цену»/«Сотрудничество»; с JS радио скрыты, вкладки `.tabs.tabs--js[role=tablist]` с `[data-lead-type]` прежние; без JS вкладки скрыты (`html:not(.js) .tabs--js`).
- `typeInput` в `lead-form.js` — RadioNodeList. Клик по `a[href="#price"|"#partner"]` переводит фокус на выбранную вкладку. POST-контракт и черновик не менялись.
- Новые классы: `.why-facts` (dl, 6 строк), `.partners__grid/__col/__col-title/__list(--steps)`; `.partner-types li` — плашки. Удалены `.production*`, `.spec-list`, `.why-list`, `.why-row*`. Новый CSS — только на токенах.

### T07 — два рулона (выставлено)

- `hero-roll.webp/.png` 1600×1600 — два рулона (80×80 с хвостом «чека», 57×40 слева спереди); `og-image.png` 1200×630 из той же сцены. Кадр `production` и `--only production-roll` убраны из `tools/render`. Тест: под изображениями нет подписи «3D-визуализация…».

### T08 — тема и лента (выставлено)

- `<button class="theme-toggle" type="button" data-theme-toggle aria-pressed aria-label="Тёмная тема">` в `.site-header__actions` на всех 5 страницах; `theme.js` — обычный скрипт в `<head>` (на index — после inline-скрипта); `localStorage['vsecheki:theme']` = light|dark; `data-theme` на `<html>` только при ручном выборе; два `meta[name=theme-color]` с `media`, `theme.js` выставляет их из `--paper`.
- Новые токены: `--sheet`, `--tape-ink`, `--tape-edge`, `--accent-text`, `--on-accent`, `--error*`, `--header-bg`, `--scrim`, `--footer-bg`, `--dark-edge`; `:root, .receipt` — светлые значения: форма-«чек» бумажная в обеих темах. Лента `--tape-w`: 44 / 40 (≤1099) / 32 (≤1023 и ≤699) / 24 (≤639). Логотип: `.logo__paper/.logo__print/.logo__cut`.
- `.js .tape__*` ограничены `[data-tape]` — статичная лента на privacy/consent не прячется. Тесты: `tests/e2e/theme.spec.mjs`, `tests/e2e/tape.spec.mjs`.
