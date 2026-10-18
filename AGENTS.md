<!-- autopilot:start -->
# Сайт производителя кассовой термоленты

Русскоязычный адаптивный сайт-лендинг производителя кассовой ленты для сбора заявок на расчёт цены и сотрудничество.

## Команды

| Что | Команда |
|---|---|
| Установка | `npm ci` |
| Dev-сервер (http://127.0.0.1:8080, 403 на /app/ и /storage/) | `npm run dev` |
| Всё: php-lint, check-secrets, node:test, Playwright | `npm test` |
| Только API | `npm run test:api` |
| Один файл API | `node --test tests/api/lead.test.mjs` |
| Только e2e | `npm run test:e2e` |
| Один e2e-файл | `npx playwright test tests/e2e/form.spec.mjs` |
| Проверка PHP 7.4 | `node tests/helpers/php-lint.mjs` |
| Проверка секретов | `node tools/check-secrets.mjs` |
| Перерендер картинок (~70 с; python3, Pillow, fontTools) | `npm run images` |
| Адрес сайта перед публикацией (canonical, og, JSON-LD, `robots.txt`, `public/sitemap.xml`; `-- ""` откатывает) | `npm run set-site-url -- https://домен` |
| Квантование PNG в палитру | `node tools/render/quantize.mjs файл.png` |

## Где что

- Архитектура, поток формы -> `api/lead.php` -> каналы, соглашения: `docs/architecture.md`.
- Решения и их причины: `docs/adr/`; словарь предметной области: `CONTEXT.md`.
- Бэкенд заявок: `public/api/lead.php` (вход), `public/app/LeadService.php` (логика), `public/app/LeadRequest.php` (поля и валидация).
- Без JS (`Accept` без `application/json`) `api/lead.php` отвечает HTML-страницей из `public/app/LeadPage.php`, с `Accept: application/json` — JSON.
- Адрес сайта: `site.config.json` (`siteUrl`, пусто до публикации), правит его `tools/set-site-url.mjs`; места в страницах помечены комментарием `site-url`.
- Фронт: `public/index.html`, `public/assets/js/lead-form.js` (форма), `public/assets/js/main.js` (UI), `public/assets/js/theme.js` (светлая/тёмная тема на всех страницах: обычный скрипт в `<head>`, выбор ставит `data-theme` на `<html>`), `public/assets/css/main.css`.
- Тип заявки — радиогруппа `name="type"` (`price` | `partner`): без JS работает как есть, `lead-form.js` делает из неё вкладки.
- e2e по теме и ленте: `tests/e2e/theme.spec.mjs`, `tape.spec.mjs`, `sweep.spec.mjs`; контраст текста считает `tests/helpers/contrast.mjs`.
- Хелперы тестов (PHP-сервер, поддельные SMTP и Telegram): `tests/helpers/`.
- Рендер изображений в `public/assets/img/`: `tools/render/`.

## Подводные камни

- Класс `Config` лежит в `public/app/ConfigLoader.php`: на macOS `Config.php` совпал бы с `config.php`.
- Только синтаксис PHP 7.4 (на хостинге; локально новее): `tests/helpers/php-lint.mjs` ловит `match`, `?->`, `str_contains` и т. п.
- Лимит 5 заявок с IP за 10 минут действует и в e2e: успешные отправки подменять через `page.route`, как в `tests/e2e/form.spec.mjs`.
- Два SMTP-теста в `tests/api/channels.test.mjs` слушают `::1`: без IPv6 на loopback упадут.
- `php -S` отдаёт главную на несуществующие пути; 404 только на Apache через `public/.htaccess`. e2e идёт на `php -S` без `tools/dev-router.php`, поэтому 403 на `/app/` там не проверить.
- `public/storage/` и `public/app/config.php` в `.gitignore`: файлы rate limit и конфиг не коммитить.
- Факты на сайте только те, что сообщил владелец: без цен, характеристик, сертификатов, клиентов, отзывов.
- Место производства на сайте не называется (Лейпциг снят владельцем): тест `tests/api/no-leipzig.test.mjs`. Липецк — город продавца в контактах, его не трогать.
- Светлые значения токенов записаны дважды: в `:root` и в `@media print` в `public/assets/css/main.css` (печать всегда светлая). Правишь светлый токен — меняй оба; сверку держит `tests/e2e/theme.spec.mjs`. Блоки тёмной темы (`prefers-color-scheme` и `data-theme="dark"`) тоже держать одинаковыми.
- На чистой машине для e2e сначала `npx playwright install chromium`.
- Параллельные прогоны Playwright (и любой второй `npm test`): свой `E2E_PORT` и `--output <папка>`, иначе порт и папка результатов общие.
- PNG в `public/assets/img/` после рендера квантуются `tools/render/quantize.mjs`; каждый не тяжелее 400 КБ (`tests/api/images.test.mjs`).
- Изображения не фотографии, а 3D-визуализации (`CONTEXT.md`): не подавать как фото производства.

## Окружение

Значения задаются на сервере в окружении или в `public/app/config.php` (образец `public/app/config.example.php`); в репозитории пусты.

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — канал Telegram; нужны оба.
- `LEAD_EMAIL_TO`, `LEAD_EMAIL_FROM` — получатель и отправитель письма.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` (`ssl` | `tls` | пусто) — SMTP; без `SMTP_HOST` письма идут через `mail()`.
- Только для тестов: `TELEGRAM_API_BASE`, `MAIL_TRANSPORT` (`file` пишет письма в `STORAGE_DIR/outbox/`), `STORAGE_DIR`, `E2E_PORT` (по умолчанию 8091), `E2E_STORAGE_DIR` (по умолчанию временная папка).

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять
только пользователь. Прерванную сборку продолжает «продолжи автопилот».

### Правка без автопилота

Мелкий баг или доводка после сборки — обычная сессия, без прогона.

Сначала прочитай:
1. `.autopilot/PROGRESS.md` — что не доделано, известные баги, о чём договорились с пользователем.
2. Что правили после последней сборки — первая строка таблицы в «История git».
3. Только если правка их касается: почему сделано так — `docs/adr/`; что значат слова — `CONTEXT.md`;
   что именно просили — `manifest.md` в папке сборки (указана в начале `PROGRESS.md`).

После правки:
- коммит — по правилам из «История git»;
- строка в «Правки без автопилота» в `PROGRESS.md`: дата — что — почему;
- починенный пункт из «Не доделано» или «Известные баги» — удали;
- договорились с пользователем о том, что следующая сборка не должна пересматривать, —
  строка в «Договорились», его словами.

### История git

Целиком не читай — бери срез под вопрос:

| Вопрос | Команда |
|---|---|
| что правили после последней сборки | `git log --oneline "$(git log -1 --format=%h --grep='^Autopilot: сборка сдана')"..HEAD -- . ':(exclude).autopilot'` |
| всё, что делали ради требования | `git log --oneline --grep="R02"` |
| история файла | `git log --oneline -10 -- <файл>` |
| когда появился или исчез код | `git log --oneline -S "<фрагмент>"` |
| почему строка такая | `git blame -L <с>,<по> <файл>`, затем `git show <sha>` |
| что внутри коммита | `git show --stat <sha>` |

Срез длиннее ~30 коммитов — отдай его субагенту и возьми выжимку в десять строк.

Коммит: заголовок — что (`fix: даты в одном формате`), тело — почему, трейлер
`--trailer "Requirements: R02"`, если правка касается требования из `manifest.md`.
Заголовок `Autopilot: сборка сдана` пишет только автопилот — по нему находят последнюю сборку.
<!-- autopilot:end -->
