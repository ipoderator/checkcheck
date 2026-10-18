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

## Третья задача (2026-10-18): карта кода

Снято с коммита 2e8daf1 (после него код не менялся). Строки — на этот момент; после правок сверять заново.

### 1. Левая лента (`[data-tape]`)

Разметка, `public/index.html`:
- 120–134: `<div class="tape-run">` (position: relative) открывается внутри `<main class="page">` и закрывается перед `#order` (стр. ~484: пустая строка после `#faq`). Лента идёт от героя до конца `#faq`; `#order` (чек) и `#contacts` ЛЕНТОЙ НЕ ОХВАЧЕНЫ.
- 123–132: `.tape[data-tape][aria-hidden]` > `.tape__clip[data-tape-clip]` > `.tape__paper[data-tape-paper]` > `.tape__end` > `.tape__end-text` («лента заканчивается — пора оформить заявку»); рядом `.tape__tip[data-tape-tip]`.
- Метки `<span class="tape-mark" aria-hidden="true">NN · текст</span>` — первый ребёнок каждой секции: 178 (01 почему всечеки), 234 (02 продукция), 297 (03 производство), 325 (04 как&nbsp;работаем), 366 (05 доставка), 387 (06 сотрудничество), 410 (07 вопросы). У `#order` и `#contacts` меток нет; у героя нет.
- privacy.html / consent.html (стр. 29–30): `<main class="tape-run">` + статичная `.tape` БЕЗ `data-tape`, без main.js; на них лента просто белая полоса. 404.html: вместо ленты `.tape-torn` (CSS 1481–1498, тот же `--rail-left`/`--tape-w`).

CSS-переменные, `public/assets/css/main.css`:
- `:root` 75–81: `--frame:1440px; --rail-x:32px; --tape-w:44px; --rail-gap:44px; --gutter:48px; --content-x: rail-x+tape-w+rail-gap; --rail-left: calc(max(0px,(100% - var(--frame))/2) + var(--rail-x))`.
- ≤1099px (91): `--rail-x:20px; --tape-w:30px; --rail-gap:28px; --gutter:32px; --header-h:68px`. ≤699px (94): `--rail-x:8px; --tape-w:16px; --rail-gap:14px; --gutter:16px; --header-h:60px`. Десктоп `--header-h:76px` (83).
- Где ещё читаются: `.site-header__inner` padding-left `rail-x − 4px` (231); `.logo__mark` ширина `tape-w + 8px` (243, логотип визуально = верх ленты — при расширении ленты растёт логотип!); `.mobile-menu__panel` padding-left = content-x (333); `.order__cut span` left (1093); `.tape-torn` (1481); `.doc` max-width/margin (`--content-x`, ~1455). Отступ контента `.frame` — стр. 138 (смотреть, как использует `--content-x`).
- Брейкпоинты шапки: меню-бургер ≤1379px (site-nav скрыт, 315–323), мобильные правки ≤699px (`.header-cta`, номер телефона скрыты).

Как рисуется (CSS 374–474):
- `.tape` absolute, top:0, bottom:0, left `--rail-left`, width `--tape-w`, z-index 3, pointer-events none.
- `.tape__paper` — фон из трёх слоёв: боковые тени-градиенты rgba(20,21,23,.07), SVG data-URI плитка 40×240 (строки чека, штрихкод, `fill=%23141517` opacity .16, repeat-y 100%×240px), `var(--white)`; box-shadow 0 0 0 1px rgba(20,21,23,.14). Контраст бумаги к фону низкий (белая на #F7F6F2).
- `.tape__end` — красный конец рулона: absolute bottom:0, height min(520px,60vh), градиент 62%→100% `--accent`; `.tape__end-text` вертикальный mono 11px. ≤699px: градиент от 55%, текст скрыт.
- `.tape__tip` — зубчатый кончик 10px: белый фон + `mask: conic-gradient(...)`, `top:100%`.
- Начальное состояние (только `@media (prefers-reduced-motion: no-preference)` и класс `.js`, 432–436): clip `translateY(-100%)`, paper `translateY(100%)`, tip `top:0`.
- `.tape-mark` (439–474): absolute, `top: calc(var(--section-y) - 8px)`, left `--rail-left`, width `--tape-w`, `writing-mode: vertical-rl`, mono 11px (≤1099 10px, ≤699 `font-size:0` = текст скрыт, остаётся пунктир `::before`); `.js .tape-mark:not(.is-printed){opacity:0}`; reduced-motion — opacity 1 (1438). Печать: `.tape,.tape-mark` скрыты (1445).

JS, `public/assets/js/main.js`, `initTape` 138–195 (вызов 223):
- Состояние: `height` (offsetHeight ленты), `top` (абсолютный Y ленты), `markTops[]`, `printed`, `target`, `frame`.
- `aim()` 163–166: `target = max(target, min(height, scrollY + innerHeight*0.84 − top))` — МОНОТОННО, назад не сматывается (комментарий «не сматывается обратно»). Для смотки вверх менять именно `Math.max(target, …)` и `markTops`/`is-printed` (метки добавляют `is-printed`, класс не снимается).
- `render()`: `hidden = max(0,height−printed)`; clip `translate3d(0,−hidden,0)`, paper `translate3d(0,hidden,0)`, tip `translate3d(0,printed,0)`; метка печатается при `y+24 < printed`.
- `tick()` — rAF, сглаживание `printed += diff*0.14`, стоп при |diff|<0.5. `schedule()` на scroll (passive), resize, load, ResizeObserver(tape). Старт `setTimeout(schedule,250)`.
- reduced-motion: сразу все метки `is-printed`, return (transform’ы не ставятся); при смене media на reduce — `printed=target=height`, transform сброшены.
- Только transform/opacity (правило из шапки main.css).

Тесты, завязанные на ленту:
- `tests/e2e/layout.spec.mjs:84–99` (reduced-motion): ни у одного потомка `[data-tape]` нет `transform != none` (кроме `[data-tape-static]`) — новая лента при reduced-motion не должна ставить transform.
- `layout.spec.mjs:152–164` «лента непрерывна»: 1440×900, reduced-motion: `tape.top < hero.bottom` и `tape.bottom > form.top − 400`. Если лента будет заканчиваться раньше `#order` — не менее чем за 400px до формы.
- `tests/e2e/pages.spec.mjs:96–101`: `.tape-torn` видим на 404.
- `viewport.spec.mjs`: на 360…1920 нет горизонтальной прокрутки; картинки/консоль; «обход Tab» — лента с pointer-events none, не должна красть фокус. `layout.spec.mjs:8`: overflow на 360–1920 (широкая лента на 360 с `--rail-x:8px` — риск).
- `pages.spec.mjs:12`: числа в innerText только из белого списка (метки 01–10 разрешены).
- API-тестов на ленту нет.

### 2. «Производство» (`#production`) -> «Почему ВсеЧеки» (`#why`)

`#why`, index.html 175–231: `section.section.why#why[aria-labelledby=why-title]`; `.tape-mark` 01; `.frame` > `header.section-head[data-reveal]` (`.section-head__num` «01 / Почему ВсеЧеки», `h2.section-head__title#why-title` «Делаем одну вещь. <em>Кассовую ленту.</em>», `.section-head__lead`); `ol.why-main` с тремя `li.why-card[data-reveal]` (`.why-card__num` 01–03, `.why-card__title`, `p`, `.why-card__stamp` aria-hidden: Германия / Собственное / Напрямую): «Немецкие материалы», «Своё производство», «Напрямую от производителя»; `ol.why-list[start=4]` из четырёх `li.why-row[data-reveal]` (`.why-row__num` 04–07, `.why-row__title`, `p.why-row__text`): Выгодные цены, Оптовые поставки, Долгосрочное сотрудничество, Доставка по всей России. CSS: `.why-main/.why-card*` 672–722, `.why-row*` 723–753, адаптив 743–753; задержки reveal 1422–1423 (`.why-main [data-reveal]:nth-child(2/3)`). Фон светлый (не `section--dark`).

`#production`, index.html 295–320 (удаляемое): `section.section.production.section--dark#production`, `.tape-mark` «03 · производство», `p.production__word` («Своё», aria-hidden), `.production__grid` > `header.section-head` («03 / Производство», h2#production-title «Собственное производство <em>кассовой ленты</em>», lead «…единственное, что мы делаем… из качественных немецких материалов… напрямую — без цепочки посредников…») + `dl.spec-list[data-reveal]` (5 строк `div>dt+dd`: Продукт — только кассовая лента; Материалы — качественные, немецкие; Производство — собственное; Продажа — напрямую от производителя; Поставки — оптовые, по всей России); `.production__media[data-reveal]` > `picture` (webp source + img `assets/img/production-roll.png`, 1600×1200, lazy, alt «Рулоны кассовой ленты ВсеЧеки на тёмном фоне — 3D-визуализация»).
CSS на удаление: 869–916 (`.production`, `__word`, `__grid`, `.spec-list*`, `__media`, `__media img`, медиазапрос 899). `.spec-list` используется ТОЛЬКО в production (проверено grep). `.section--dark` останется у partners и contacts.

Все места со ссылкой на #production / нумерацию:
- Меню шапки index.html:72 `<a href="#production" data-nav-link>`; мобильное меню :100 `<span class="mono">03</span>Производство` (нумерация 01–08 в :97–104 — после удаления сдвинуть 04→03 … 08→07); подвал :626.
- Нумерация сдвига при удалении: `tape-mark` (index.html 325, 366, 387, 410) «04 · как работаем», «05 · доставка», «06 · сотрудничество», «07 · вопросы»; `.section-head__num` «04 / Как работаем» (:333 примерно), «05 / Доставка», «06 / Сотрудничество», «07 / Частые вопросы», и «08 / Контакты» (контакты, строка ~517). У `#order` num = «Заявка» (без цифры). Мобильное меню нумерует «01…08» вручную (не счётчик).
- `initActiveSection` (main.js 79–99): строит карту из `[data-nav-link]` по href -> `getElementById`; секции без ссылки игнорируются; самого `production` в JS нет — править только HTML.
- Тесты, где зашит production (сломаются): `tests/e2e/content.spec.mjs:11–35` (тест «Производство» по `#production`, `.production__word`, `.spec-list`; и тест production-roll `#production .production__media`; строка 20 проверяет `.why-card` nth(1) «Своё производство» — оставить), `tests/e2e/layout.spec.mjs:5` (`SECTIONS` содержит 'production' -> убрать, иначе `#production` toHaveCount(1) падает), `tests/e2e/viewport.spec.mjs:71` (`expect(hrefs.length).toBe(8)` — станет 7; тест также проверяет, что цель навигации не под шапкой через `.section-head__num` — у переработанного `#why` он должен остаться), `tests/api/images.test.mjs:27–28, 159–180`.
- `tests/api/images.test.mjs`: RASTERS (стр. 20–31) — `production-roll.webp` 1600×1200 ≤250 КБ и `.png` (непрозрачные); тест «production-roll.png: непрозрачная, края — #141517» (159–181), константа `DARK` (14); тест «каждый PNG ≤ 400 КБ» (150) читает ВСЕ png в папке, `pngs.length >= 6` (сейчас 6 PNG: apple-touch-icon, hero-roll, og-image, production-roll, roll-57x40, roll-80x80 — после удаления production-roll станет 5 и тест УПАДЁТ: снизить порог до 5!).
- tools/render: `render.mjs:94–98` блок `want('production-roll')`; `scene/production.js` целиком (`productionShot`), `scene/shots.js:5,27–28` импорт и ключ `production`. README.md:112 (строка таблицы про production-roll). `docs/` — упоминаний production-roll нет; `docs/adr/0009` про «место производства», не про секцию. AGENTS.md упоминаний секции нет (только про Лейпциг).
- `tests/api/no-leipzig.test.mjs` — сканирует public/, README.md, docs/, tools/render на «Лейпциг» (не Липецк); перенос текста не должен вернуть название места.
- Файлы картинки: `public/assets/img/production-roll.png` (373 КБ) и `.webp` (76 КБ) — удалить вместе с тестом.
- JSON-LD (index.html 24–50): секции не упоминает, только описание; sitemap.xml в репозитории НЕТ (создаётся `npm run set-site-url`, секций не содержит — только URL главной); robots.txt без секций.
- Прочие места с «Производств»: meta description, og:description, hero__lead, ticker (170–171 дважды), why-card — это формулировка «собственное производство» (по требованию владельца, оставить). В `pages.spec.mjs:31` og:description должен содержать «Собственное производство».
- Тест чисел `pages.spec.mjs:12`: цифры в тексте только из белого списка (есть 01–10).

### 3. «Сотрудничество» (`#partners`)

index.html 385–405: `section.section.partners.section--dark#partners[aria-labelledby=partners-title]`; `.tape-mark` «06 · сотрудничество»; `header.section-head[data-reveal]` (num «06 / Сотрудничество», h2 «Сотрудничество — <em>для всех</em>», lead «Покупаете ленту для своих касс… оптовые поставки напрямую от производителя.»); `ul.partner-types[data-reveal]` из 5 `li`: Магазины, Сети, Дилеры, Сервисные компании, Любые партнёры; `div.partners__cta[data-reveal]` > `a.btn.btn--accent.btn--large[href="#partner"]` «Предложить сотрудничество» + `p` «Или позвоните: <a class="link-light" href="tel:…">».
CSS 1008–1030: `.partner-types` (Unbounded 700, clamp(2rem,0.6rem+4.6vw,5.6rem), цвет `--on-dark`); `li{display:inline}`; `li:not(:last-child)::after{content:'/'; color:--accent}`; `li:last-child{color:#8E9096}` (захардкожен); `.partners__cta` (flex, border-top dashed `--dark-line`, mono 15px). Общие тёмные правила: `.section--dark` 479–480, `.section--dark .link` 158, `.link-light` 158.
Тесты на тексты/вёрстку блока:
- `tests/e2e/viewport.spec.mjs:157–170` (на каждой ширине): `.partner-types li:not(:last-child)` — «/» не дальше 1.5 кегля от конца текста (если уберёте `.partner-types` — удалить/переписать).
- `layout.spec.mjs:5,20–27`: `#partners` и ссылка `a[href="#partners"]` обязательны; `form.spec.mjs:175` кликает `main a[href="#partner"]` (первую) -> вкладка «Сотрудничество»: в `main` должна остаться хоть одна ссылка `#partner` (сейчас — кнопка CTA партнёров; герой тоже: «Стать партнёром» index.html ~157).
- `faq` index.html ~461: «Кто может стать партнёром? Все: магазины, сети, дилеры…». Прямых тестов на тексты блока нет; `pages.spec.mjs:12` — запрещённые слова (отзыв, фото, клиентов доверяют…) и числа.

### 4. Светлая/тёмная тема

Токены `:root` (main.css 75–90):
- Цвета: `--paper:#F7F6F2; --white:#FFFFFF; --ink:#141517; --muted:#5E6066; --line:#DCDAD3; --accent:#E5352B; --accent-ink:#D12E24; --accent-press:#B8261D; --dark:#141517; --dark-2:#1C1E21; --dark-line:#2E3035; --on-dark:#F7F6F2; --on-dark-muted:#A9AAB0`.
- Прочее: `--f-display/--f-text/--f-mono`, сетка, `--header-h`, `--radius:4px`, `--section-y`, `--ease-out`, `--shadow-paper:0 1px 0 rgba(20,21,23,.04),0 18px 40px -18px rgba(20,21,23,.28)`.
- Использование `var(--…)`: ink 51, accent 41, on-dark 25, muted 22, paper 18, line 12, white 10, dark 7. Нет ни `prefers-color-scheme`, ни `color-scheme`, ни `data-theme` (grep пуст). Палитра зафиксирована в тесте `images.test.mjs:34` (PALETTE для SVG-логотипов) и README.

`.section--dark` (479–480, 511, 125): только `background:var(--dark); color:var(--on-dark)`; приглушённый текст `p:not([class])`/`.section-head__lead` -> `--on-dark-muted`; `h2 em` -> `#8E9096` (хардкод); фокус в тёмных блоках `--on-dark`. Тёмные секции: `#partners`, `#contacts` (бывш. `#production`); подвал и мобильное меню тёмные независимо (`--dark`/`#0D0E10`). «Тёмная тема» там = инвертировать остальные токены, а `--dark`-секции в тёмной теме нужно отличать от фона (оба станут тёмными).

Захардкоженные цвета (не токены), main.css после стр. 110 — 33 места, главные:
- Шапка: фон `rgba(247,246,242,.92)` (217) и затемнение мобильного меню `rgba(20,21,23,.4)` (326).
- Лента: tape__paper градиент/тень rgba(20,21,23,…) 390/393, SVG-плитка `%23141517` 391, `.tape-torn` 1488.
- Кнопка `.btn--dark:hover #000` (191); `#8E9096` (511, 1020); `#FF8A80` hover/теги (829, 1372, 1410); `#4A4C52` (851); `#26282D` (production__word, 878 — удалится); `#EFEDE7` и `#FFFFFF` фон карточек форматов (778, radial-gradient); подвал `#0D0E10` (1398) и `#FFFFFF` (1406).
- Форма/чек: `#8A8C91` placeholder (1217), `#F4F3EE` focus (1218), `#F0EFEA` chip hover (1249), ошибки `#FFF3F2/#FFF6F5/#B3241B` (1221, 1227, 1307, 1323, 1517), тени `.receipt-wrap` rgba(20,21,23,…) (1144), зубцы чека conic-gradient (1150).
- Вне CSS: инлайн-SVG логотипа в шапке/подвале index.html (fill `#FFFFFF`, stroke `#141517`, `#E5352B`; те же в privacy/consent/404/LeadPage), `public/assets/brand/logo.svg`, `logo-light.svg`, `favicon.svg`, PNG-рендеры (прозрачный фон, 3D-освещение «студия» — на тёмном фоне могут смотреться иначе; `hero-roll` прозрачный), `og-image.png`.
- Печатные стили: `body{background:#fff}` (1446).

`<meta name="theme-color" content="#F7F6F2">` — один, без media: index.html:9, privacy.html:9, consent.html:9, 404.html:8, public/app/LeadPage.php:98. Для тем понадобятся `media="(prefers-color-scheme: …)"` или JS-обновление во всех пяти.

Inline-скрипты и CSP:
- CSP НЕТ: ни meta, ни в `public/.htaccess` (там только X-Content-Type-Options nosniff, Referrer-Policy, X-Frame-Options SAMEORIGIN). Inline-скрипт разрешён технически.
- Inline-скрипт в `<head>` уже есть: index.html:23 — IIFE ставит `js` в `className` и через 4 с снимает, если нет `data-ui-ready` (его ставит main.js). Рядом `<script type="application/ld+json">` (24–50). Это хорошее место для раннего применения темы (до отрисовки): `<script src=… type=module>` main.js/lead-form.js (51–52) грузятся модулями (deferred), т.е. после первого кадра — тема из main.js даст мигание. Тест `layout.spec.mjs:166` «внешних запросов нет» — не мешает. На privacy/consent/404 inline-скрипта и main.js НЕТ — для единой темы нужен общий мини-скрипт либо дубли inline.
- Тест `pages.spec.mjs:22` берёт `script[type="application/ld+json"]` по селектору — не конфликтует с новым inline-скриптом.

Шапка и место кнопки:
- `header.site-header[data-header]` (index.html 59–113; CSS 213–): sticky, z-index 50, height `--header-h`; `::before` — полупрозрачный фон `rgba(247,246,242,.92)` + blur + border-bottom, видим при `.is-scrolled` (JS `initHeader` main.js 11–17) или без JS. Внутри `.frame.site-header__inner`: `.logo`, `nav.site-nav` (≥1380px), `.site-header__actions` = `a.header-phone` + `a.btn.header-cta` + `button.menu-toggle` (≤1379px). На ≤699px `.header-cta` и номер скрыты, телефон — круглая иконка 48px; ширина мала (360px) — места мало.
- Разумно: десктоп — в `.site-header__actions` перед `.header-phone` (или после) квадрат 44px (тап ≥44 — тест `layout.spec.mjs:67–82` проверяет тап-цели на телефоне); мобильный — внутрь `.mobile-menu__panel` (рядом с `.mobile-menu__actions`/контактами, index.html 105–116), а на телефоне возможно и рядом с `.menu-toggle`. Фокус-ловушка меню берёт `a[href], button:not([disabled])` внутри панели (main.js 24) — кнопка в панели попадёт в цикл Tab автоматически. Тест `viewport.spec.mjs:97` (обход Tab, фокус не под шапкой) и 8 ссылок в nav — учесть.
- `.doc-page .site-header::before{opacity:1}` (1451) для legal/404.

Общий CSS: privacy.html, consent.html, 404.html и ответ `api/lead.php` (`LeadPage.php:100`, `../assets/css/main.css`) подключают тот же `main.css`; `main.js` и `lead-form.js` подключает ТОЛЬКО index.html. Значит тему на этих страницах без дублирования скрипта не включить (или оставить по `prefers-color-scheme` только через CSS).

### 5. Герой-картинка и рендер

index.html 148–153: `.hero__visual > .hero__roll[data-parallax] > picture > source[srcset="assets/img/hero-roll.webp"][type=image/webp] + img[src="assets/img/hero-roll.png"][width=1600][height=1600][alt="3D-визуализация рулона кассовой ленты ВсеЧеки с размотанным концом"][fetchpriority=high][decoding=async]` (без lazy — первый экран; тест `pages.spec.mjs:43` требует lazy только вне `.hero, .site-header`). CSS 578–614: `.hero__roll img{width:100%;height:auto;aspect-ratio:1}` (квадрат зашит!), десктоп ≥1100px — `.hero__visual` absolute, right `--gutter`, width 46%, max 660px; <1100 — под текстом, `.hero__roll{width:min(560px,100%)}`. Параллакс — `initParallax` main.js 198–209 (translate+rotate .006°/px).
Рендер, `tools/render/`:
- `npm run images` = `node tools/render/render.mjs` (≈70 с; нужны python3+Pillow+fontTools, Chromium Playwright, `three` из node_modules). Флаги: `--only hero-roll,roll-57x40,roll-80x80,production-roll,brand,apple-touch-icon,og-image`; `--raw <папка>` сохраняет сырые PNG-кадры.
- Конвейер: three.js в headless Chromium (страница `tools/render/scene/index.html`, подаётся через `page.route` по `http://render.local`; macOS `--use-angle=metal`, иначе swiftshader) -> PNG data URL -> `encode.py` (Pillow: webp под `webp_max_bytes`, png, фон `background` для непрозрачных) -> `quantize.mjs` (палитра ≤256 цветов, Флойд–Стейнберг; `png_max_bytes` 390 000 с запасом к тесту 400 КБ).
- Сцена героя: `scene/shots.js:30–41` `hero({size=1600,supersample=2})` — ОДИН рулон 80×80 лёжа + хвост-«чек» (`createTail`), `Studio` (`scene/studio.js`: `frame`, `light`, `contact`), рулон — `scene/roll.js` (`createRoll`, `createTail`). Карточки форматов: `shots.js` `roll()` (стоящий рулон). Квадратный кадр 1600×1600, прозрачный фон.
- Задание в `render.mjs:~85`: `size [1600,1600]`, webp ≤245 000 б, png ≤390 000 б.
- Важно: OG-картинка тоже использует кадр `hero` (`render.mjs` блок og-image: `shot('hero',{size:1400})` -> `/og/roll.png` в `tools/render/og/og.html`). Смена сцены героя поменяет и `og-image.png` при общем `npm run images` (или нужен `--only hero-roll` и отдельно `og-image`). og-image тянет текст/лого `brand.mjs`.
- Тесты: `tests/api/images.test.mjs:20–22` hero-roll.webp 1600×1600, alpha, ≤250 КБ; hero-roll.png 1600×1600, alpha, угол (0,0) прозрачный; `og-image.png` 1200×630 (:29, без alpha); PNG ≤400 КБ (150); `pages.spec.mjs:29` og:image-путь; `site-url.test.mjs:61,65,90,94` og:image/JSON-LD image абсолютные/корневые; `viewport.spec.mjs:39–66` пропорции `naturalWidth/Height ≈ width/height` у img и `currentSrc` оканчивается на `.webp`; `pages.spec.mjs:43` width/height заданы, alt без «фото». Если новый кадр не квадрат — менять width/height в HTML, `aspect-ratio:1` в CSS (583), RASTERS в тесте и `size` в render.mjs. alt придётся изменить (сейчас «с размотанным концом»).
- Подвал: «Изображения продукции на сайте — 3D-визуализации» (index.html ~644; проверяет `content.spec.mjs:34`). README.md:105–113 — таблица картинок, обновить.

### 6. Форма: вкладки «Рассчитать цену» / «Сотрудничество»

Разметка, index.html 486–…: `section#order` с якорями-пустышками `span.anchor#price` и `#partner` (489–490, внутри секции до `.order__cut`) — обе ссылки ведут на одну и ту же позицию; тип выбирает JS. `form#lead-form[data-lead-form][action="api/lead.php"][method=post][novalidate]`; `div.tabs[role=tablist]` с `button.tabs__tab[role=tab][data-lead-type=price|partner]` (id `lead-tab-price`, `lead-tab-partner`, partner `tabindex=-1`); `input[type=hidden][name=type][value=price]` и `name=page`; панель `#lead-panel[role=tabpanel]`. Блоки `[data-only="price"]` (формат, «Нужный размер», количество, и строки сводки) скрываются для partner.
JS `public/assets/js/lead-form.js`:
- `setType(type)` 172–183: пишет `typeInput.value`, `aria-selected`/tabIndex, `aria-labelledby` панели, `hidden` у `[data-only=price]`; для не-price очищает ошибки PRICE_ONLY.
- Клики по вкладкам и стрелки/Home/End 395–406; ссылки `a[href="#price"|"#partner"]` в любом месте (document click, 428–433) и `hashchange` (434–437); старт: хеш в URL, иначе тип из черновика localStorage, иначе price (462–464); `[data-lead-format]` форсирует price (440–456); вкладки блокируются на время отправки (274, тест form.spec.mjs:308).
- Тип в запросе: поле `type` (`price|partner`), сервер `public/app/LeadRequest.php:58–89` (`TYPES`, при ином значении ошибка `type`: «Выберите тип заявки.»; для `price` проверяются format/format_custom/quantity, для `partner` — нет, `lead.test.mjs:243`). `type_label` — LeadRequest.php:259.
- Почему без JS нельзя выбрать «Сотрудничество» (известный баг, PROGRESS.md:26): вкладки — `<button type="button">`, без JS ничего не делают; `type` — hidden со значением `price` по умолчанию, поэтому заявка всегда «Рассчитать цену». Поля `[data-only=price]` без JS видны (скрывает их только JS). Решение: радио/селект `name=type` для no-js (по аналогии с `.no-js-only`, CSS 1198: `.js .no-js-only{display:none}`) или два submit со значением; учесть, что JS-вкладки пишут в тот же `name=type`.
- Без JS (`Accept` без `application/json`) `public/api/lead.php:11–36`: `$wantsJson = stripos($accept,'application/json')!==false`; JSON или `LeadPage::render($status,$body)` (HTML-страница на `main.css`, ссылка «Вернуться к форме» -> `../#order`; ADR 0007). Заголовок `Vary: Accept`.
e2e: `form.spec.mjs:174–196` (вкладки/якоря/кнопка формата/`/#partner`), `:308` (вкладки disabled при отправке), `:353–394` (без JS: размер уходит на сервер; ответ — страница; ошибка при 57×40 + свой размер), `:218` (клиент и сервер валидируют одинаково), остальные form.spec — отправка/ошибки/черновик. API: `lead.test.mjs` `type вне price|partner` (154), `partner: format не проверяется` (243), блок «форма без JS» (49–125); `channels.test.mjs:78` «partner без формата».
Риск: тест `layout.spec.mjs:142` «без JS всё содержимое видно» + no-JS проверки используют `javaScriptEnabled:false`; `form.spec.mjs:175` кликает первую `main a[href="#partner"]`.

### 7. Все тесты и полный прогон

Команда: `npm test` = `node tests/helpers/php-lint.mjs && node tools/check-secrets.mjs && node --test "tests/api/*.test.mjs" && playwright test --pass-with-no-tests`. Только API — `npm run test:api`; только e2e — `npm run test:e2e` (`playwright.config.mjs`, порт `E2E_PORT` 8091, `php -S` без dev-router). Параллельный второй прогон — свой `E2E_PORT` и `--output`.
API (`tests/api/`):
- `lead.test.mjs` — контракт `api/lead.php`: методы, JSON/HTML-ответ, валидация полей, ловушка/время заполнения, 503 «не настроено», rate limit.
- `channels.test.mjs` — доставка: Telegram, e-mail (file/SMTP/mail()), частичный и полный сбой, mbstring (два SMTP-теста слушают ::1).
- `config.test.mjs` — приоритет env над config.php, шаблоны конфигов, .gitignore, закрытие app/ и storage/, public/.htaccess.
- `dev-server.test.mjs` — `tools/dev-router.php`: 403 на /app/ и /storage/, статика, lead.php.
- `images.test.mjs` — размеры, альфа, вес картинок, PNG ≤400 КБ, production-roll края, SVG только палитры, нет «стопки».
- `no-leipzig.test.mjs` — нет «Лейпциг» в public/README/docs/tools/render; Липецк на месте.
- `php-syntax.test.mjs` — PHP 7.4 (php -l + запрещённые конструкции).
- `site-url.test.mjs` — `npm run set-site-url`: canonical, og, JSON-LD, sitemap.xml, robots, ошибки, откат.
- `check-secrets.test.mjs` — `tools/check-secrets.mjs` ловит/пропускает формы утечек.
E2E (`tests/e2e/`, Playwright):
- `content.spec.mjs` — тексты «Производство» (сломается), форматы «под заказ», подпись «ширина × намотка, мм».
- `form.spec.mjs` — форма: ошибки, успех, дубли, сеть, вкладки, очистка, согласие, клиент=сервер, фокус, no-JS.
- `layout.spec.mjs` — нет горизонтальной прокрутки 360–1920, разделы/якоря, мобильное меню, тапы ≥44, reduced-motion, бегущая строка, no-JS, лента, нет внешних запросов.
- `pages.spec.mjs` — разрешённые числа/запрещённые слова, мета/OG/JSON-LD, img-атрибуты, privacy/consent, 404, robots/sitemap.
- `viewport.spec.mjs` — по ширинам 360…1920: картинки/консоль, навигация к разделам, Tab-обход, меню, «/» партнёров, подсказка «Количество»; 404 skip-link.
Сопутствующие: `tests/helpers/php-lint.mjs` (в `npm test`), `tools/check-secrets.mjs`.

### Риски и неожиданное

- Лента НЕ доходит до `#order`/`#contacts` (закрывается перед чеком); `tape-run` — только в index.html, на legal-страницах статичная копия без JS.
- `aim()` монотонна, `is-printed` не снимается: «смотка вверх» — правка этих двух мест плюс reduced-motion ветка (тест 84–99 запрещает transform).
- Лента влияет на всю сетку через `--tape-w`/`--rail-x` (контент, логотип `tape-w+8`, мобильное меню, `.doc`, `.order__cut`): расширение сдвинет контент; на 360px места почти нет.
- Удаление production: `images.test.mjs` порог «>= 6 PNG» упадёт (останется 5); `viewport.spec` `hrefs.length === 8` -> 7; `layout.spec` SECTIONS; весь `content.spec` блок про #production; нумерация вручную в 3 списках и 6 заголовках.
- OG-картинка собирается из кадра `hero`: новая сцена героя изменит og-image при полном `npm run images`.
- В `<head>` уже есть inline-скрипт и нет CSP — ранняя установка темы возможна; но main.js — module (поздно), а на privacy/consent/404/LeadPage скрипта нет.
- Тёмная тема: 33 хардкода + PNG-рендеры/логотипы с белым и #141517; `--dark` секции и `--paper` тела совпадут по тону; theme-color в 5 файлах.
- No-JS «Сотрудничество»: hidden `type=price` без альтернативы — известный баг (PROGRESS.md:26).
