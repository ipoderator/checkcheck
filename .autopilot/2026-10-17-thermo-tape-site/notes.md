# Аудит сайта «ВсеЧеки», 2026-10-17

Только чтение: файлы проекта не менялись. Сервер `npm run dev` на http://127.0.0.1:8080 отвечал (200), свой не поднимался.
Скрипты и скриншоты: `/private/tmp/claude-501/-Users-glebchurkin-Desktop-checklena/3b38492e-88c9-4f8d-842d-0545f1321da6/scratchpad/audit/` (`mobile.cjs`, `tab.cjs`, `form.cjs`, `docs.cjs`, `secrets.mjs`, `timeout.cjs`, папка `shots/`).
Реальные отправки на `api/lead.php` с валидными данными: 2 (обе 503 `not_configured`), в `public/storage/ratelimit/` два хита: `[1792265586,1792265652]`. Одна из них случайная: Chromium перевёл `ivan@почта.рф` в punycode, и сервер её принял (см. п. 5). Остальные отправки были либо 422 (лимит не тратят), либо подменены через `page.route`.

Итого проблем: 16 (ниже помечены «ПРОБЛЕМА»).

---

## 1. Упоминания Лейпцига

Поиск (без учёта регистра): `лейп|ляйп|лепц|лейц|лепз|лейпс|leip|lejp|lepz|leipc` в `public/`, `tools/` (вместе с `tools/render/`), `README.md`, `AGENTS.md`, `CONTEXT.md`, `docs/`, `tests/`.
Написаний «Leipzig», «Leipz…» и опечаток («лепциг» и т. п.) нет нигде. Все найденные места пишутся правильно, «Лейпциг» или «Лейпциге».

ПРОБЛЕМА: требование G15 из `manifest.md` («полностью убери упоминания…») не выполнено. Ниже 14 вхождений в 12 строках `public/index.html` и ещё по одному в `AGENTS.md` и `README.md`.

| Файл:строка | Форма | Контекст |
|---|---|---|
| public/index.html:7 | Лейпциге | `<meta name="description">` «…собственное производство в Лейпциге, оптовые поставки…» |
| public/index.html:16 | Лейпциге | `<meta property="og:description">` «Немецкие материалы, собственное производство в Лейпциге, …» |
| public/index.html:39 | Лейпциге | JSON-LD `Organization.description` «…собственное производство в Лейпциге, оптовые поставки…» |
| public/index.html:146 | Лейпциге | `p.hero__lead` «…на&nbsp;собственном производстве в&nbsp;Лейпциге. Поставляем оптом…» |
| public/index.html:172 | Лейпциге | `.ticker__track` `<span>Производство в&nbsp;Лейпциге</span>` (первая копия, `aria-hidden`) |
| public/index.html:173 | Лейпциге | `.ticker__track`, вторая копия того же списка |
| public/index.html:197 | Лейпциге | `h3.why-card__title` «Своё производство в&nbsp;Лейпциге» (карточка 02 в `ol.why-main`) |
| public/index.html:198 | Лейпциге | `<p>` той же карточки «Производство собственное и&nbsp;находится в&nbsp;Лейпциге.» |
| public/index.html:199 | Лейпциг | `span.why-card__stamp` (`aria-hidden`), штамп «Лейпциг» |
| public/index.html:301 | Лейпциг | `p.production__word` (`aria-hidden`), большое фоновое слово, CSS `text-transform: uppercase` → «ЛЕЙПЦИГ» |
| public/index.html:305 | Лейпциге | `h2#production-title` «Собственное производство <em>в&nbsp;Лейпциге</em>» |
| public/index.html:311 | Лейпциг | `dl.spec-list` → `<dt>Производство</dt><dd>собственное, Лейпциг</dd>` |
| AGENTS.md:4 | Лейпциге | «…производителя кассовой ленты (производство в Лейпциге) для сбора заявок…» |
| README.md:117 | Лейпциге | раздел «Тексты и факты»: «…немецкие материалы, производство в Лейпциге, работа напрямую…» |

ОК, Лейпцига нет в следующих местах:
- `tools/render/og/og.html`: тексты OG-картинки «Кассовая лента от производителя», «57 × 40», «80 × 80», «под заказ». `og-image.png` я посмотрел глазами, Лейпцига на нём нет.
- `tools/render/scene/textures.js:273,278`: на рулонах рендерятся только «ВсеЧеки» и «КАССОВАЯ ЛЕНТА».
- `tools/render/brand.mjs`: только слово «ВсеЧеки».
- `privacy.html`, `consent.html`, `404.html`, `CONTEXT.md`, `docs/` (включая `docs/adr/`).
- `tests/`: ни одна проверка не завязана на «Лейпциг».
- Вне области поиска Лейпциг встречается в `.autopilot/…/spec.md:5,24,52`, `2026-10-17-brief.md:9,30–36`, `manifest.md:14,60,61`, `tickets/03-site.md:12,19`, `.autopilot/state.js:713,715,939,944` и `dashboard.html` (это история требований).

Связанное, но не Лейпциг: «Германия» есть в `span.why-card__stamp` (index.html:193). Слово «немецкие» встречается в index.html:7,16,39,146,172,173,191,192,306,310.

### Липецк (не трогать)
| Файл:строка | Контекст |
|---|---|
| public/index.html:44 | JSON-LD `address.addressLocality: "Липецк"` |
| public/index.html:598 | `p.contacts__city` «Липецк» |
| public/index.html:605 | `.requisites` → `<dt>Город</dt><dd>Липецк</dd>` |
| public/index.html:642 | `.site-footer__contacts` `<span>Липецк</span>` |
| public/privacy.html:37 | «…ИНН 270399373377, город Липецк (далее — Оператор…» |
| public/privacy.html:90 | `p.doc__sign` «ИП Чуркин Глеб Олегович · ИНН 270399373377 · Липецк» |
| public/consent.html:36 | «…ИНН 270399373377, город Липецк (далее — Оператор)…» |
| public/consent.html:53 | `p.doc__sign` «Оператор: ИП… · Липецк · ipoderator@yandex.ru» |
| tests/e2e/pages.spec.mjs:36 | `expect(ld.address.addressLocality).toBe('Липецк')` |
| tests/e2e/form.spec.mjs:105 | `page.fill('#lead-region', 'Липецкая область')` |
| tests/api/channels.test.mjs:38,64,156 | тестовые данные «Липецкая область» |

---

## 2. Раздел «Производство»

Разметка: `public/index.html:297–324`.
- 298: `<section class="section production section--dark" id="production" aria-labelledby="production-title">`
- 299: `span.tape-mark` (`aria-hidden`) «03 · производство»
- 300: `div.frame`
- 301: `p.production__word` (`aria-hidden="true"`) «Лейпциг»
- 302: `div.production__grid`, внутри него:
  - 303–307: `header.section-head[data-reveal]` с `p.section-head__num` «03 / Производство», `h2.section-head__title#production-title` «Собственное производство <em>в Лейпциге</em>» и `p.section-head__lead` «Кассовая лента — единственное, что мы делаем. Производство у нас своё, материалы — качественные немецкие. А продаём мы напрямую, без цепочки посредников между производством и вашей кассой.»
  - 308–314: `dl.spec-list[data-reveal]` из пяти пар `div > dt + dd`: Продукт / Материалы / Производство («собственное, Лейпциг») / Продажа / Поставки.
- 316–322: `figure.production__media[data-reveal]`, в нём `picture` с `source srcset="assets/img/rolls-stack.webp" type="image/webp"`, `img src="assets/img/rolls-stack.png" width="1600" height="1000" alt="3D-визуализация стопки рулонов кассовой ленты" loading="lazy" decoding="async"` и `figcaption` «3D-визуализация рулонов кассовой ленты ВсеЧеки». На экране подпись набрана моноширинным капсом.
- В подвале есть вторая подпись: `.site-footer__legal` «Изображения продукции на сайте — 3D-визуализации.» (index.html:647). README.md:109 ссылается на обе подписи.

Фон и CSS (`public/assets/css/main.css`):
- Фон секции даёт `.section--dark { background: var(--dark) }` (479), `--dark: #141517`. Текст получает `color: var(--on-dark)` (#F7F6F2).
- 870: `.production { overflow: clip; }`.
- 871–881: `.production__word`: `var(--f-display)`, 800, `font-size: min(12.4vw, 11.5rem)`, uppercase, `color: #26282D` (тёмно-серое слово на тёмном фоне), `white-space: nowrap`, `margin-bottom: clamp(32px, 4vw, 64px)`. Слово стоит в потоке над заголовком, это не абсолютное позиционирование.
- 882–888: `.production__grid` — сетка `1.3fr / 1fr`, `gap: 32px 80px`, `align-items: end`. На ≤899px одна колонка (920).
- 889–903: `.spec-list` — моноширинный шрифт, верхняя граница 2px, у строк пунктирная `var(--dark-line)`.
- 904–911: `.production__media img`: `aspect-ratio: 16/10`, `object-fit: cover`, `border-radius`, `background: radial-gradient(70% 70% at 50% 40%, #2A2C31, #17181B)`. Сама картинка прозрачная (RGBA, угол (0,0,0,0) и в webp, и в png). Подложку под рулонами рисует этот градиент на `<img>`, в файле фона нет.
- 912–919: `figcaption` 12px, моно, uppercase, `color: var(--on-dark-muted)`.
- Ссылка навигации на раздел — `#production` в `.site-nav`, `.mobile-menu__list` («03 Производство») и `.site-footer__nav`.

Где ещё используется `rolls-stack`:
- `public/index.html:318–319`: только этот раздел.
- `README.md:105`: таблица «Как заменить изображения» («раздел «Производство», 1600 × 1000»).
- `tests/api/images.test.mjs:23–24`: `['rolls-stack.webp', 1600, 1000, false]` и `['rolls-stack.png', …]`. Значение `false` здесь значит «прозрачность не проверяется», а не «файл непрозрачный».
- `tools/render/render.mjs:90–92`: `shot(browser, 'stack', {1600×1000})`, лимит `webp_max_bytes: 200_000`.
- `tools/render/scene/shots.js:26,51`: `stackShot()` — пирамида 4-3-2 из рулонов 80 × 80 на боку, две стопки 57 × 40 стоя и один 57 × 40 впереди.
- `.autopilot/…/interfaces.md:123`.
- В CSS и JS имя файла не встречается.

ОК: на 360 и 1440 картинка загружается при прокрутке (`currentSrc` = `rolls-stack.webp`, 1600×1000). Пропорции 1.6 совпадают с блоком, `object-fit: cover` ничего не обрезает.

---

## 3. Заглушки `ДОМЕН`

| Файл:строка | Где |
|---|---|
| public/index.html:8 | HTML-комментарий с инструкцией |
| public/index.html:9 | `<link rel="canonical" href="https://ДОМЕН/">` |
| public/index.html:17 | `og:url` `https://ДОМЕН/` |
| public/index.html:18 | `og:image` `https://ДОМЕН/assets/img/og-image.png` |
| public/index.html:36 | JSON-LD `url` |
| public/index.html:37 | JSON-LD `logo` `https://ДОМЕН/assets/brand/logo.svg` |
| public/index.html:38 | JSON-LD `image` `https://ДОМЕН/assets/img/og-image.png` |
| public/privacy.html:8 | canonical `https://ДОМЕН/privacy.html` |
| public/consent.html:8 | canonical `https://ДОМЕН/consent.html` |
| public/robots.txt:1 | комментарий |
| public/robots.txt:8 | `Sitemap: https://ДОМЕН/sitemap.xml` |
| public/sitemap.xml:2 | комментарий |
| public/sitemap.xml:5,10,15 | `<loc>` для `/`, `/privacy.html`, `/consent.html` |
| README.md:49–50 | шаг 5 «Замените заглушку домена» и список файлов |
| README.md:123 | «Купить домен и заменить `https://ДОМЕН`» |
| tests/e2e/pages.spec.mjs:26,27,28,103,106,107 | тесты ждут именно `https://ДОМЕН/…` и упадут после замены |

ПРОБЛЕМА: до замены у сайта нет рабочих canonical, og:url, og:image и Sitemap. Кириллический хост `ДОМЕН` не годится как URL для парсеров превью. Воспроизведение: `rg -n 'ДОМЕН' public`.

ОК: относительных `og:image` нет. Единственный `og:image` абсолютный (index.html:18). `twitter:image` не задан, есть `twitter:card=summary_large_image` (index.html:22), так что берётся og:image. У `privacy.html`, `consent.html` и `404.html` OG-тегов нет вообще.

---

## 4. Тексты про форматы

Страница `public/index.html`:
- 6 `<title>` «…57 × 40, 80 × 80 и любые размеры под заказ»
- 7 meta description «Форматы 57 × 40 и 80 × 80, другие размеры под заказ.»
- 241 `h2#products-title` «Два основных формата. <em>И любой — под заказ.</em>»
- 243 `p.section-head__lead` «…Формат записываем как «ширина × намотка, мм».»
- 255, 270 `p.format-card__tag` «Основной формат»; 256, 271 `h3.format-card__size` «57×40» / «80×80» (знак `span.format-card__x`)
- 257, 272 `p.format-card__caption` «ширина × намотка, мм»
- 258, 273 `button[data-lead-format="57x40"|"80x80"]` «Рассчитать цену на 57 × 40 / 80 × 80»
- 279 `p.format-card__tag` «Под заказ»; 280 `h3.format-card__title` «Любой другой размер»; 281 «Нужен нестандартный формат — сделаем под заказ. Например, из распространённых на рынке:»
- 282–288 `ul.size-chips[aria-label="Примеры размеров под заказ"]`: 57 × 30, 57 × 50, 57 × 60, 80 × 60, 80 × 70, 80 × 83, у каждого `<small>под заказ</small>`
- 290 `button[data-lead-format="other"]` «Заказать свой размер»
- 423 FAQ «Основные форматы — 57 × 40 и 80 × 80 (ширина × намотка, мм). Любые другие размеры делаем под заказ.»
- 426–427 FAQ «Можно заказать нестандартный размер?» — «Да, любые размеры — под заказ. Например, из распространённых на рынке форматов: 57 × 30, 57 × 50, 57 × 60, 80 × 60, 80 × 70, 80 × 83. В заявке выберите «Другой размер» и укажите нужный.»

Поле формата в форме:
- 515–523 `fieldset.field.formats-field[aria-describedby="lead-format-hint"]` с `legend` «Формат» и `span.field__hint#lead-format-hint` «ширина × намотка, мм». Радиокнопки `input.chips__input[name=format]`: `#lead-format-57x40` (57x40), `#lead-format-80x80` (80x80), `#lead-format-other` (other, «Другой размер»). Ошибка выводится в `p#lead-format-error[data-error-for=format]`.
- 525–529 `div.field[data-format-custom][hidden]`: label «Нужный размер *», `input#lead-format_custom[name=format_custom][maxlength=100][placeholder="Например, 57 × 30"]`, ошибка в `#lead-format_custom-error`.
- 533 `input#lead-quantity` с placeholder «Сколько рулонов или коробок»
- `[data-summary="format"]` в `dl.receipt__summary` («—», «57 × 40», свой текст)

Код:
- `public/assets/js/lead-form.js:15–16`: `PRICE_ONLY` и `FORMAT_LABELS` (`other: 'другой размер'`); 61–63 валидация `format_custom`; 177 сводка; 265 `format_custom` удаляется из запроса, если формат не `other`; 417 фокус на `format_custom`.
- `public/app/LeadRequest.php:14`: `FORMATS = ['57x40' => '57 × 40', '80x80' => '80 × 80', 'other' => 'Другой размер']`; 117–131 валидация; 196–197 в заявке пишется «Другой размер: <текст>».

Прочее: `tools/render/og/og.html:29` (57 × 40, 80 × 80, «под заказ»), `README.md:103–104,117`, `CONTEXT.md:24–34` (словарь).

ПРОБЛЕМА: страница расходится со словарём `CONTEXT.md:34` («_Избегать_: нестандарт…»). Слово «нестандартный» стоит в index.html:281 («Нужен нестандартный формат») и 426 («Можно заказать нестандартный размер?»).

---

## 5. Форма и PHP-обработчик (проверено в браузере, 390×844, и через curl)

### ОК
- Пустая отправка: запроса к серверу нет, `data-state="error"`. Статус: «Проверьте поля, отмеченные красным. Введённое сохранено — исправьте и отправьте ещё раз.» Ошибки «Укажите имя.», «Укажите телефон.», «Нужно согласие на обработку персональных данных.». `aria-invalid` стоит на `#lead-name`, `#lead-phone`, `#lead-consent`, фокус уходит на `#lead-name`. После первой попытки ошибка снимается прямо во время ввода.
- Клиентские ошибки по полям (`validate()`, lead-form.js:42–70) по тексту совпадают с серверными (`LeadRequest::parse`):
  - имя: «Имя слишком короткое — нужно хотя бы 2 символа.» / «…длинное — не больше 100 символов.»;
  - телефон: «Укажите российский номер: +7 XXX XXX-XX-XX или 8 XXX XXX-XX-XX.»;
  - e-mail: «Проверьте адрес e-mail — в нём должны быть «@» и домен.» / «…слишком длинный…»;
  - компания и регион: «— не больше 150 символов»; «Количество» и «Размер» — 100; комментарий — 2000;
  - «Укажите нужный размер ленты.»
- `maxlength` в браузере обрезает ввод: имя до 100, телефон до 40.
- Сервер (curl), без каналов:
  - пустое тело → 422 с ошибками type, name, phone, consent;
  - GET → 405 `method_not_allowed`;
  - JSON → 400 `bad_request`;
  - `format=99x99` → «Выберите формат из списка.»;
  - `consent=on` → ошибка согласия (принимается только `1`);
  - для `type=partner` поля формата игнорируются;
  - `name[]=` → «Укажите имя.»;
  - ловушка `website` и `form_elapsed_ms<3000` или нечисловое → притворный 200 `{"ok":true}` (так задумано, ADR 0004/0005).
- Успех (подмена `{"ok":true}`): поля и черновик в `localStorage` очищены, вкладка снова «Рассчитать цену», открыт `[data-lead-success]`. Тексты: «ЗАЯВКА ПРИНЯТА», «Спасибо! Заявка у нас», «Мы свяжемся с вами по телефону, который вы указали.», «Если вопрос срочный — звоните: 8 920 243-19-57». Фокус на `h3[data-lead-success-title]`. «Новая заявка» возвращает `idle` и фокус на имя.
- Ответы сервера (подменены):
  - 503 `not_configured` (проверено и на реальном сервере): «Форма пока не подключена — заявка не отправлена. Ваши данные сохранены на странице. Позвоните … или напишите на …»;
  - 429: «Слишком много заявок подряд. Подождите 10 минут…»;
  - 502: «Не удалось доставить заявку. Ваши данные сохранены…».
  Во всех случаях введённое остаётся на месте, кнопка снова активна.
- Сетевая ошибка (`route.abort`, а также `context.setOffline(true)`): «Нет связи с сервером — заявка не отправлена. Проверьте интернет и нажмите «Отправить заявку» ещё раз. Введённое сохранено. Телефон для связи: …». Поля сохраняются. Таймаут 20 с (`REQUEST_TIMEOUT_MS`, lead-form.js:7) срабатывает через 20 075 мс с тем же текстом.
- Защита от двойной отправки: двойной клик плюс третий клик дают 1 запрос; Enter ×3 в `#lead-name` даёт 1 запрос; Enter ×2 раньше 3 с тоже 1 запрос (`busy`, `submit.disabled`, `aria-busy="true"`, кнопка «Отправляем…»). Клиент ждёт до `MIN_FILL_MS` (3000 мс), поэтому успех приходит примерно через 2,8 с.
- Ответ 422 с неизвестными полями (`type`, `foo`): тексты дописываются в статус отдельными строками.
- Черновик: после перезагрузки поля восстанавливаются, согласие нет (так задумано, lead-form.js:13).
- `#partner` открывает вкладку «Сотрудничество» и прячет `[data-only=price]`. `[data-lead-format="80x80"]` ставит радиокнопку, переносит фокус на `#lead-format-80x80` и меняет сводку на «80 × 80». `other` показывает поле размера и фокусирует его. Стрелки работают по вкладкам. Заявка «Сотрудничество» уходит без format, format_custom, quantity.
- `ivan@почта.рф`: Chromium сам переводит `type=email` в punycode (`ivan@xn--80a1acny.xn--p1ai`), сервер такой адрес принимает.

### ПРОБЛЕМЫ
1. ПРОБЛЕМА: без JS заказать «Другой размер» нельзя, а ответ приходит сырым JSON. Поле `div.field[data-format-custom]` скрыто атрибутом `hidden` прямо в HTML (index.html:525), а `[hidden] { display:none !important }` (main.css:121).
   → Воспроизведение: Playwright с `javaScriptEnabled:false`, имя и телефон заполнены, выбран «Другой размер», «Отправить». Браузер уходит на `/api/lead.php`, на экране текст `{"ok":false,"code":"validation","errors":{"format_custom":"Укажите нужный размер ленты.",…}}`. Вкладку «Сотрудничество» без JS тоже не выбрать: `type=price` зашит в hidden-поле. Скриншот: `shots/nojs-submit.png`.
2. ПРОБЛЕМА: клиент и сервер по-разному считают длину телефона. Клиент берёт `phone.length > 40` (символы, lead-form.js:32), сервер — `strlen($phone) > 40` (байты, LeadRequest.php:148). Номер с кириллической припиской проходит клиент, сервер его отклоняет, и сообщение неверное: «Укажите российский номер…», хотя номер российский.
   → Воспроизведение: телефон `+7 920 000-00-00 звонить после обеда` (36 символов, 53 байта), остальное валидно, «Отправить». Сервер отвечает 422, ошибка у `#lead-phone`.
3. ПРОБЛЕМА: клиентская проверка e-mail (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, lead-form.js:55) мягче серверного `FILTER_VALIDATE_EMAIL` (LeadRequest.php:104). Такой адрес проходит клиент и отклоняется только сервером, причём текст «в нём должны быть «@» и домен» не подходит к адресу, где «@» и домен есть.
   → Воспроизведение: e-mail `a..b@mail.ru`, «Отправить». Сервер отвечает 422, ошибка у `#lead-email`, фокус на поле.
4. ПРОБЛЕМА: сервер не считает NBSP пробелом при обрезке. `Text::line()` вызывает `trim()` (Text.php:75), а он снимает только ASCII-пробелы, поэтому имя из двух U+00A0 принимается. В браузере это закрывает клиент: JS `trim()` снимает NBSP.
   → Воспроизведение: `curl -d 'type=price' --data-urlencode $'name=  ' -d phone=123 http://127.0.0.1:8080/api/lead.php`. В ответе нет ошибки `name`, остаются только phone и consent.
5. ПРОБЛЕМА: после неудачной отправки (сеть, 503, 429, 502, 500) фокус уходит на `<body>`. Сфокусированная кнопка становится `disabled` в `setBusy(true)` (lead-form.js:247), браузер снимает с неё фокус, а `onSubmit` при ошибке фокус никуда не переносит. Следующий Tab попадает на «Очистить».
   → Воспроизведение: заполнить форму, `page.route` → `abort`, фокус на «Отправить заявку», Enter. Затем `document.activeElement` = BODY.
6. ПРОБЛЕМА: во время отправки «Очистить» (`[data-lead-clear]`), вкладки и поля остаются активными. Если очистить форму во время запроса, при ответе 503 статус пишет «Ваши данные сохранены на странице», а поля пустые.
   → Воспроизведение: подменить ответ 503 с задержкой 2 с, «Отправить», через 200 мс «Очистить». Итог: `#lead-name` пуст, статус «Форма пока не подключена… Ваши данные сохранены на странице…».
7. ПРОБЛЕМА: сообщение об успехе в живой области не озвучивается. `MESSAGES.success` пишется в `[data-lead-status][role=status]`, но `.receipt[data-state="success"] .receipt__status { display:none }` (main.css:1333) убирает его из дерева доступности. Объявление держится только на фокусе `h3[tabindex=-1]`.
   → Воспроизведение: успех через `page.route`, затем `getComputedStyle([data-lead-status]).display === 'none'`.
8. ПРОБЛЕМА: попытки, которые кончаются 503 или 502, тоже расходуют лимит. В `LeadService::handle()` лимит (`$this->limiter->hit`, LeadService.php:69) проверяется до конфига и доставки. Посетитель, который следует совету «попробуйте отправить ещё раз», после 5 попыток за 10 минут получает 429.
   → Воспроизведение: при пустом конфиге каждая валидная отправка добавляет метку в `public/storage/ratelimit/<sha256(ip)>.json`. После двух отправок в этом аудите там две метки.
9. ПРОБЛЕМА: при таймауте (20 с) пишется «заявка не отправлена», хотя сервер мог её получить и доставить (запрос только прерывается на клиенте), а защиты от дублей нет. Повторная отправка может прийти владельцу второй раз.
   → Воспроизведение: `page.route` без ответа даёт сообщение через 20 075 мс. Это вывод из кода (lead-form.js:268–285), на реальном медленном сервере не проверялось.

Факты без оценки:
- Код `server_error` (500) и ответ 500 с HTML показывают текст `delivery_failed` («Не удалось доставить заявку…»): отдельного сообщения нет, `MESSAGES` lead-form.js:18–26.
- Статус ошибки выводится под кнопками «Отправить заявку» и «Очистить».

---

## 6. Мобильная версия 360 / 375 / 390 (+ privacy, consent, 404)

### ОК
- Горизонтальной прокрутки нет: `scrollWidth == clientWidth`, `scrollTo(500,0)` даёт `scrollX = 0` на всех трёх ширинах. За край выходит только `.trap` (`left:-9999px`), и это задумано.
- Консоль и сеть на `/`, `/privacy.html`, `/consent.html`, `/404.html` при всех ширинах: ни ошибок, ни предупреждений, ни упавших запросов, ни ответов ≥400.
- Изображения: `hero-roll.webp` (1:1, блок 306–336 px), `roll-57x40.webp` и `roll-80x80.webp` (`object-fit: contain` в блоке 1.196), `rolls-stack.webp` (1.6 в блоке 1.6, `cover`). Битых нет, пропорции не искажены, грузится `.webp` (`currentSrc`).
- Мобильное меню (`[data-menu-toggle]`, `#mobile-menu`):
  - открывается с `aria-expanded=true`, подпись «Закрыть меню», фокус на первой ссылке `#why`;
  - Tab циклится по ссылкам панели, двум кнопкам, телефону, почте и `[data-menu-toggle]`, наружу не выходит; Shift+Tab с кнопки идёт на последний элемент;
  - Esc закрывает меню и возвращает фокус на кнопку; повторный клик по кнопке тоже закрывает;
  - панель 60–744 px помещается в 800 px.
- Якоря (через `.mobile-menu__list` и `.mobile-menu__actions`, плюс `#requisites` и `#order` из подвала): `#why #products #production #process #delivery #partners #faq #contacts #price #partner #requisites #order`. Цель встаёт на 76 px, низ шапки на 60 px (`scroll-padding-top: calc(var(--header-h) + 16px)`, main.css:99). `section-head__num` и заголовок шапкой не перекрыты ни на одной ширине. После перехода из меню следующий Tab идёт к первому интерактивному элементу после цели.
- Tab по всей `/` (53 остановки): skip-link «Перейти к содержимому» → логотип → телефон → меню → герой → пауза бегущей строки → кнопки форматов → … → `summary` FAQ → вкладка → поля → согласие и ссылки → отправка и «Очистить» → контакты → подвал. Ловушек нет. После прокрутки каждый элемент виден на экране и не под шапкой, обводка `:focus-visible` есть везде. У радиокнопок и чекбокса обводка рисуется на соседнем `label`. Скрытые элементы (`.trap` с `tabindex=-1`, закрытое меню, `aria-hidden`) фокус не получают.
- `privacy.html` (11 остановок), `consent.html` (10), `404.html` (5): без горизонтальной прокрутки, Tab работает.

### ПРОБЛЕМЫ
1. ПРОБЛЕМА: в `ul.partner-types` (раздел «Сотрудничество») разделитель «/» после «Сервисные компании» отрывается к правому краю на 360, 375 и 390. Так происходит, потому что `li` с `display:inline-flex` (main.css:1024) переносится на две строки и занимает всю ширину, а `::after` с «/» (1025) остаётся в конце строки.
   → Воспроизведение: `shots/partner-types-390.png`, `shots/slice360-05.png`.
2. ПРОБЛЕМА: на 360 px не влезает placeholder `#lead-quantity` «Сколько рулонов или коробок» (index.html:533): текст 275 px при доступных 262 px, видно «…коробо». На 375 впритык (275 из 277), на 390 помещается.
   → Воспроизведение: `shots/slice360-07.png`, скрипт `ph.cjs`.
3. ПРОБЛЕМА: в `404.html` нет `a.skip-link`, хотя на `privacy.html` и `consent.html` он есть. Кроме того, у `h1.not-found__title` (404.html:32) доступный текст «404Здесь лента оборвалась», без пробела: `404<span class="not-found__sub">`.
   → Воспроизведение: `document.querySelector('h1').textContent`.

Факты без оценки:
- При открытом меню прокрутка страницы не заблокирована: `body` и `html` `overflow` = `clip/visible`, `visible`.
- Только на dev-сервере: `php -S` отдаёт `index.html` на любой несуществующий путь. На вложенном пути (`/deep/nested/missing`) относительные `assets/…` резолвятся неверно: CSS не грузится, в консоли 2 ошибки «Failed to load module script… MIME type text/html». На Apache это перекрывает `ErrorDocument 404 /404.html`, где пути абсолютные (`/assets/css/main.css`); там не проверялось.
- Скриншоты: `shots/index-{360,375,390}-{top,full}.png` (на full ленивая `rolls-stack` ещё не загружена), `menu-*.png`, `anchor-*-{production,price}.png`, `form-*.png`, `focus-grid.png`, `doc-360_*.png`, `production-{360,1440}.png`.

---

## 7. Тяжёлые PNG в `public/assets/img`

| Файл | КБ | Где используется |
|---|---|---|
| rolls-stack.png | 1139 | запасной `<img src>` в `<picture>` (index.html:319), рядом webp 147 КБ |
| hero-roll.png | 934 | запасной `<img src>` в `<picture>` (index.html:159), webp 110 КБ, `fetchpriority="high"` |
| roll-80x80.png | 352 | запасной в `<picture>` (index.html:266), webp 41 КБ |
| og-image.png | 232 | только `og:image` (index.html:18) и JSON-LD `image` (index.html:38), абсолютный URL с `ДОМЕН` |
| roll-57x40.png | 185 | запасной в `<picture>` (index.html:251), webp 28 КБ |
| apple-touch-icon.png | 3 | `<link rel="apple-touch-icon">` (index.html:24) |

ОК: все четыре продуктовые PNG стоят только как запасной `src` внутри `<picture>` с `<source type="image/webp">`. Chromium грузит `.webp` (проверено через `currentSrc` и сетевые запросы), PNG качает только браузер без WebP. В CSS и JS ссылок на PNG нет. PNG — RGBA с прозрачным фоном, og-image — RGB.

Факт: `srcset` с несколькими размерами и `sizes` нет. На экранах 360–390 px грузятся те же файлы 1600×1600 (hero) и 1600×1000 (stack). Ограничения на вес webp заданы в `tests/api/images.test.mjs:18–21` (250 и 120 КБ) и в `tools/render/render.mjs` (`webp_max_bytes`), на PNG ограничений нет.

---

## 8. `tools/check-secrets.mjs`: какие записи не ловит

Как устроен: проверяются ключи `SECRET_KEYS` (9 ключей конфига). Файлы берутся из `git ls-files --cached --others --exclude-standard`, поэтому игнорируемые `.env` и `public/app/config.php` не проверяются (так задумано). Пропускаются файлы больше 2 МБ и бинарные (есть байт 0). Поиск построчный, тремя регулярками:
- `KEY=value`;
- `'KEY' =>|:|= 'value'`, где значение обязательно в кавычках;
- для файлов без расширения и с `.yml/.ini/.toml/.txt/.env*` ещё `KEY: value` в начале строки.

`node tools/check-secrets.mjs` на репозитории возвращает «ок» с кодом 0.

ПРОБЛЕМА: ниже перечислено, что проверка пропускает. Проверено вызовом `findLeaks()` из `secrets.mjs` в scratchpad, ключи собирались из частей.
- Значения без кавычек в коде и JSON: `{"TELEGRAM_CHAT_ID": -100500}` и `100500` в `.json`; `['SMTP_PASSWORD' => 12345]` в PHP; `{ TELEGRAM_CHAT_ID: -100500 }` в JS; `TELEGRAM_CHAT_ID = -100500` в `.toml`.
- Запись через пробел, а не через `=` или `:`: `SetEnv SMTP_PASSWORD s3cr3t` в `.htaccess` (обычный способ задать окружение на Apache-хостинге), `ENV SMTP_PASSWORD s3cr3t` в Dockerfile.
- Пробелы вокруг `=` в ini: `SMTP_PASSWORD = s3cr3t` в `.ini`; `env[SMTP_PASSWORD] = s3cr3t` в `.user.ini` и php-fpm.
- PHP: `define('SMTP_PASSWORD', 's3cr3t')`; `$c['SMTP_PASSWORD'] = 's3cr3t'`; `getenv('SMTP_PASSWORD') ?: 's3cr3t'`; значение на следующей строке (`'SMTP_PASSWORD' =>⏎ 's3cr3t'`); heredoc.
- JS: запасное значение `process.env.SMTP_PASSWORD || 's3cr3t'`.
- Python: `os.environ['SMTP_PASSWORD'] = 's3cr3t'`.
- YAML: ключ в кавычках, значение без (`"SMTP_PASSWORD": s3cr3t`); значение вида `[s3cr3t]` или `<s3cr3t>` считается подсказкой (`PLACEHOLDER`).
- Markdown: таблица `| LEAD_EMAIL_TO | owner@example.ru |`; строка `SMTP_PASSWORD: s3cr3t` в `.md` (правило `KEY: value` действует только для «простых» конфигов).
- Без имени ключа: токен Telegram в URL (`https://api.telegram.org/bot123456789:AAH…/sendMessage`) или голый `123456789:AAH…`. Формат токена нигде не ищется.
- Другие имена и регистр: `$smtp_password = '…'`, `'smtp_password' => '…'` (сравнение регистрозависимое, только 9 точных имён).

Для сравнения ловит: dotenv `KEY=value`, `export KEY="…"`, `putenv('KEY=…')`, `'KEY' => '…'`, `"KEY": "…"`, `KEY: '…'`, YAML `KEY: value` в `.yml`, `ENV KEY=value`, `- KEY=value`, Makefile `KEY := value`, TOML `KEY = "…"`.
