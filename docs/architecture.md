# Архитектура

## Поток данных

Форма `#lead-form` (`public/index.html`) → `public/assets/js/lead-form.js` → `POST api/lead.php` → `LeadService::handle()` → каналы Telegram и e-mail → JSON-ответ → состояние формы.

- `public/api/lead.php` — единственная точка входа бэкенда: берёт метод, Content-Type, IP, вызывает `LeadService::fromConfig(Config::load())->handle(...)`, печатает JSON. Непойманное исключение -> 500 `server_error`.
- Порядок проверок в `LeadService`: метод -> ловушка и время -> валидация -> лимит по IP -> конфиг -> доставка. Валидация раньше «не настроено», чтобы посетитель сначала исправил поля.
- Коды ответов: 200 `ok` (в том числе притворный успех для бота), 400 `bad_request`, 405, 422 `validation` (+ `errors` по именам полей), 429 `rate_limited`, 503 `not_configured`, 502 `delivery_failed`, 500 `server_error`.
- Доставка: каналы `TelegramChannel` и `MailChannel` (интерфейс `LeadChannel`: `name()`, `isConfigured()`, `send()` бросает `RuntimeException`). Успех — хотя бы один канал. Все настроенные упали -> заявка в `STORAGE_DIR/failed-leads.jsonl`, ответ 502.
- Заявки больше нигде не хранятся (ADR 0003). Лимит: 5 заявок с IP за 600 с, файлы `STORAGE_DIR/ratelimit/*.json` (`RateLimiter`).
- Поля запроса и их ограничения — в `public/app/LeadRequest.php` (источник истины, не дублировать сюда).

## Границы модулей

- `public/` — ровно то, что грузится на хостинг. `tests/`, `tools/`, `docs/` на хостинг не идут.
- `public/app/` — библиотека и конфиг; закрыта от браузера (`.htaccess`, на `php -S` — `tools/dev-router.php`). Вход туда только через `api/lead.php` (константа `VSECHEKI_APP`, `app/bootstrap.php`).
- `public/storage/` — рабочие файлы (rate limit, письма-файлы для тестов, резерв заявок); в git только `.htaccess`.
- `main.js` владеет UI: меню, подсветка раздела, `[data-reveal]` -> `is-visible`, лента `[data-tape]`, параллакс героя. Формой не владеет.
- `lead-form.js` владеет формой и не знает о UI-модуле. DOM-контракт: `[data-lead-form]`, вкладки `[data-lead-type]` (`price` | `partner`), поля только для price в `[data-only="price"]`, ошибки `[data-error-for]`, статус `[data-lead-status]`, состояния `data-state="idle|sending|success|error"`, кнопки формата `[data-lead-format]`.
- Черновик формы — `localStorage` `vsecheki:lead-draft:v1`, всегда в try/catch.
- Без JS форма уходит обычным POST; ответ тот же JSON.
- Изображения — `public/assets/img/*`, имена фиксированы; рендер `tools/render/` (Three.js + Playwright, затем Python-кодирование). Руками не править.

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
