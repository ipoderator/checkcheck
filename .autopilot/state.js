window.STATE =
{
  "version": 2,
  "slug": "thermo-tape-site",
  "dir": "2026-10-17-thermo-tape-site--wip",
  "title": "Сайт производителя кассовой термоленты",
  "mode": "semi",
  "depth": "deep",
  "tier": "T2",
  "briefFile": "2026-10-17-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "autopilot",
  "skillDir": "/Users/glebchurkin/.claude/skills/autopilot",
  "baseCommit": null,
  "startedAt": "2026-10-17T16:25:30+03:00",
  "updatedAt": "2026-10-17T18:09:31+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-17T16:25:30+03:00",
      "finishedAt": "2026-10-17T16:25:42+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-17T16:25:42+03:00",
      "finishedAt": "2026-10-17T16:26:03+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-10-17T16:26:03+03:00",
      "finishedAt": "2026-10-17T18:03:52+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-17T18:03:52+03:00",
      "finishedAt": "2026-10-17T18:08:23+03:00"
    },
    {
      "id": "plan",
      "status": "active",
      "startedAt": "2026-10-17T18:08:23+03:00"
    },
    {
      "id": "build",
      "status": "pending"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 52,
    "done": 2,
    "inTicket": 50,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 0,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Каркас проекта и приём заявок в Telegram и на почту",
      "requirements": [
        "R19.7",
        "R34i",
        "R34i.1",
        "A01",
        "G05",
        "G06",
        "G07",
        "G07.1",
        "G08",
        "G09",
        "G09.1",
        "G10",
        "G10.1",
        "G12",
        "R35i",
        "R32"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "package.json",
        "package-lock.json",
        ".gitignore",
        ".env.example",
        "public/api/",
        "public/app/",
        "public/storage/",
        "public/.htaccess",
        "tests/api/",
        "tests/helpers/",
        "tools/check-secrets.mjs",
        "playwright.config.mjs"
      ],
      "review": "да — секреты и сообщения третьим лицам",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "02",
      "title": "3D-изображения рулонов, логотип и иконки",
      "requirements": [
        "R16",
        "R16.1",
        "G03",
        "R36i",
        "R18"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "tools/render/",
        "public/assets/img/",
        "public/favicon.svg",
        "public/assets/brand/"
      ],
      "review": "нет",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "03",
      "title": "Сайт: лендинг, форма-«чек», юридические страницы",
      "requirements": [
        "R01",
        "R02",
        "R03",
        "R03.1",
        "R03.2",
        "R04",
        "R05",
        "R06",
        "R07",
        "R08",
        "R09",
        "R10",
        "R11",
        "R12",
        "R13",
        "R14",
        "R15",
        "R17",
        "R18",
        "R18.1",
        "R19",
        "R19.1",
        "R19.2",
        "R19.3",
        "R19.4",
        "R19.5",
        "R19.6",
        "R20",
        "R21",
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R27",
        "R30",
        "R31",
        "R33",
        "R35i.1",
        "R35i.2",
        "R37i",
        "R38i",
        "G01",
        "G02",
        "G04",
        "G11",
        "G13",
        "G14",
        "A02",
        "A03"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "public/index.html",
        "public/privacy.html",
        "public/consent.html",
        "public/404.html",
        "public/robots.txt",
        "public/sitemap.xml",
        "public/assets/css/",
        "public/assets/js/",
        "public/assets/fonts/",
        "tests/e2e/",
        "README.md"
      ],
      "review": "нет",
      "model": "сильная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    }
  ],
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 3,
    "fixed": 3,
    "deferred": 0,
    "items": []
  },
  "concerns": [],
  "blind": null,
  "beats": [
    "2026-10-17T16:25:30+03:00",
    "2026-10-17T16:25:42+03:00",
    "2026-10-17T16:26:03+03:00",
    "2026-10-17T16:26:29+03:00",
    "2026-10-17T18:03:52+03:00",
    "2026-10-17T18:08:23+03:00",
    "2026-10-17T18:09:30+03:00",
    "2026-10-17T18:09:31+03:00"
  ],
  "rev": 13,
  "waiting": null,
  "waits": [
    {
      "kind": "briefing",
      "from": "2026-10-17T16:26:29+03:00",
      "to": "2026-10-17T18:03:52+03:00"
    }
  ],
  "log": [
    {
      "t": "2026-10-17T16:25:30+03:00",
      "k": "init"
    },
    {
      "t": "2026-10-17T16:25:42+03:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-10-17T16:26:03+03:00",
      "k": "stage",
      "id": "briefing",
      "act": "start"
    },
    {
      "t": "2026-10-17T16:26:29+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "4 вопроса — контакты и бренд, ассортимент и фото, куда идут заявки и хостинг, страна и партнёры"
    },
    {
      "t": "2026-10-17T18:03:52+03:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-10-17T18:03:52+03:00",
      "k": "gate",
      "g": "G1",
      "ok": false,
      "open": 52,
      "total": 52
    },
    {
      "t": "2026-10-17T18:03:52+03:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-10-17T18:08:23+03:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 3,
      "fixed": 3,
      "deferred": 0
    },
    {
      "t": "2026-10-17T18:08:23+03:00",
      "k": "stage",
      "id": "plan",
      "act": "start"
    },
    {
      "t": "2026-10-17T18:09:30+03:00",
      "k": "tier",
      "v": "T2"
    },
    {
      "t": "2026-10-17T18:09:31+03:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-10-17T18:09:31+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«Создай под ключ … сайт»",
      "status": "in-ticket"
    },
    {
      "id": "R02",
      "text": "«современный»",
      "status": "in-ticket"
    },
    {
      "id": "R03",
      "text": "«адаптивный»",
      "status": "in-ticket"
    },
    {
      "id": "R04",
      "text": "«русскоязычный»",
      "status": "in-ticket"
    },
    {
      "id": "R05",
      "text": "«для производителя кассовой термоленты»",
      "status": "in-ticket"
    },
    {
      "id": "R06",
      "text": "«Мы продаём только кассовую ленту»",
      "status": "in-ticket"
    },
    {
      "id": "R07",
      "text": "«Используем качественные немецкие материалы»",
      "status": "in-ticket"
    },
    {
      "id": "R08",
      "text": "«собственное производство находится в Лейпциге»",
      "status": "in-ticket"
    },
    {
      "id": "R09",
      "text": "«Работаем напрямую от производителя»",
      "status": "in-ticket"
    },
    {
      "id": "R10",
      "text": "«предлагаем выгодные цены»",
      "status": "in-ticket"
    },
    {
      "id": "R11",
      "text": "«оптовые поставки»",
      "status": "in-ticket"
    },
    {
      "id": "R12",
      "text": "«долгосрочное сотрудничество»",
      "status": "in-ticket"
    },
    {
      "id": "R13",
      "text": "«отправку в любой регион страны»",
      "status": "in-ticket"
    },
    {
      "id": "R14",
      "text": "«сочетать корпоративный сайт и эффектный рекламный лендинг»",
      "status": "in-ticket"
    },
    {
      "id": "R15",
      "text": "«выразительная типографика»",
      "status": "in-ticket"
    },
    {
      "id": "R16",
      "text": "«качественные изображения продукта»",
      "status": "in-ticket"
    },
    {
      "id": "R17",
      "text": "«аккуратные анимации»",
      "status": "in-ticket"
    },
    {
      "id": "R18",
      "text": "«визуальный мотив непрерывной кассовой ленты»",
      "status": "in-ticket"
    },
    {
      "id": "R19",
      "text": "«Главная цель — получение заявок на расчёт цены»",
      "status": "in-ticket"
    },
    {
      "id": "R20",
      "text": "«и сотрудничество» (заявки на сотрудничество)",
      "status": "in-ticket"
    },
    {
      "id": "R21",
      "text": "«Не придумывай цены»",
      "status": "in-ticket"
    },
    {
      "id": "R22",
      "text": "«Не придумывай … характеристики»",
      "status": "in-ticket"
    },
    {
      "id": "R23",
      "text": "«Не придумывай … сертификаты»",
      "status": "in-ticket"
    },
    {
      "id": "R24",
      "text": "«Не придумывай … клиентов»",
      "status": "in-ticket"
    },
    {
      "id": "R25",
      "text": "«Не придумывай … отзывы»",
      "status": "in-ticket"
    },
    {
      "id": "R26",
      "text": "«Не придумывай … контакты»",
      "status": "in-ticket"
    },
    {
      "id": "R27",
      "text": "«и другие факты, которых я не сообщил»",
      "status": "in-ticket"
    },
    {
      "id": "R28",
      "text": "«Если данных не хватает, сначала задай только действительно важные вопросы»",
      "status": "done"
    },
    {
      "id": "R29",
      "text": "«для каждого предложи рекомендуемый ответ»",
      "status": "done"
    },
    {
      "id": "R30",
      "text": "«самостоятельно подготовь структуру и тексты»",
      "status": "in-ticket"
    },
    {
      "id": "R31",
      "text": "«реализуй сайт»",
      "status": "in-ticket"
    },
    {
      "id": "R32",
      "text": "«проверь его»",
      "status": "in-ticket"
    },
    {
      "id": "R33",
      "text": "«доведи проект до готового состояния»",
      "status": "in-ticket"
    },
    {
      "id": "R34i",
      "text": "(подразумевается) заявки с формы должны куда-то доходить",
      "status": "in-ticket"
    },
    {
      "id": "R35i",
      "text": "(подразумевается) форма собирает персональные данные — нужно согласие и политика (152-ФЗ)",
      "status": "in-ticket"
    },
    {
      "id": "R36i",
      "text": "(подразумевается) у компании есть название / бренд, его надо показать",
      "status": "in-ticket"
    },
    {
      "id": "R37i",
      "text": "(подразумевается) «страны» — какая страна доставки",
      "status": "in-ticket"
    },
    {
      "id": "R38i",
      "text": "(подразумевается) сайт где-то размещается и находится поиском (SEO, мета)",
      "status": "in-ticket"
    },
    {
      "id": "G01",
      "text": "«Размеры 57 на 40 и 80 на 80»",
      "status": "in-ticket"
    },
    {
      "id": "G02",
      "text": "«добавь что есть любые размеры для заказа, можешь указать из общедоступных размеров»",
      "status": "in-ticket"
    },
    {
      "id": "G03",
      "text": "«Фото нет - сделай их сам»",
      "status": "in-ticket"
    },
    {
      "id": "G04",
      "text": "«Сначала разработай и проверь сайт локально, без публикации»",
      "status": "in-ticket"
    },
    {
      "id": "G05",
      "text": "«Подготовь его для размещения на обычном хостинге с поддержкой PHP, например Timeweb или Beget»",
      "status": "in-ticket"
    },
    {
      "id": "G06",
      "text": "«Заявки должны отправляться в Telegram»",
      "status": "in-ticket"
    },
    {
      "id": "G07",
      "text": "«и дублироваться на e-mail»",
      "status": "in-ticket"
    },
    {
      "id": "G08",
      "text": "«Токен Telegram-бота, ID чата и адрес почты оставь пустыми в отдельном конфигурационном файле или переменных окружения»",
      "status": "in-ticket"
    },
    {
      "id": "G09",
      "text": "«Никаких секретных данных в коде быть не должно»",
      "status": "in-ticket"
    },
    {
      "id": "G10",
      "text": "«Если настройки не заполнены, форма должна показывать понятное сообщение»",
      "status": "in-ticket"
    },
    {
      "id": "G11",
      "text": "«и сохранять введённые пользователем данные на странице»",
      "status": "in-ticket"
    },
    {
      "id": "G12",
      "text": "«Публиковать сайт без моего отдельного разрешения не нужно»",
      "status": "in-ticket"
    },
    {
      "id": "G13",
      "text": "«ВсеЧеки название. телефон - 89202431957, почта - ipoderator@yandex.ru. Адрес - город Липецк»",
      "status": "in-ticket"
    },
    {
      "id": "G14",
      "text": "«Юр лицо - ИП Чуркин Глеб Олегович, инн - 270399373377»",
      "status": "in-ticket"
    }
  ],
  "gates": {
    "G1": {
      "ok": false,
      "at": "2026-10-17T18:03:52+03:00",
      "open": 52,
      "total": 52
    },
    "G2": {
      "ok": true,
      "at": "2026-10-17T18:08:23+03:00",
      "found": 3,
      "fixed": 3,
      "deferred": 0
    },
    "G3": {
      "ok": true,
      "at": "2026-10-17T18:09:31+03:00",
      "problems": 0
    }
  },
  "result": null
}
