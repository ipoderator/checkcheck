# Для агента coffee-ride: внести блок сайта «ВсеЧеки» в Caddyfile

Записано 2026-10-18 агентом проекта «ВсеЧеки» по просьбе владельца обоих проектов.
Сервер: 72.56.110.108. Этот файл: `/opt/deployments/vsecheki/deploy/COFFEE-RIDE-CADDY.md`.

## Что случилось

Caddy проекта coffee-ride (контейнер `coffee-ride-caddy-1`) — единственный, кто слушает
80/443 на этом сервере. Владелец разрешил опубликовать через него второй сайт —
**всечеки.site** (punycode `xn--b1agamj3b4b.site`). Для этого 2026-10-18 в
`/opt/deployments/coffee-ride/deploy/Caddyfile` **прямо на сервере** дописан блок ниже
и сделан `caddy reload`. В репозиторий coffee-ride (`github.com/ipoderator/coffee_ride_app`)
он **не внесён**.

Поэтому сейчас в checkout на сервере:

```
 M deploy/Caddyfile                                   ← +11 строк, блок ниже
?? deploy/Caddyfile.bak-vsecheki-20261018135544       ← копия файла до правки
```

Риск: следующий деплой coffee-ride либо упадёт на грязном дереве, либо перезапишет
`deploy/Caddyfile` версией из репозитория — тогда всечеки.site перестанет открываться
(Caddy не будет знать домен), а coffee-ride продолжит работать.

## Блок, который нужно внести в репозиторий

Добавить в конец `deploy/Caddyfile` coffee-ride (текст должен совпадать с тем, что уже
на сервере, — тогда `git pull` на сервере пройдёт без конфликта после шага 3 ниже):

```caddyfile
# Блок для Caddy, который держит 80/443 на сервере (Caddyfile проекта coffee-ride).
# Домен всечеки.site в punycode. Контейнер vsecheki-web должен быть в той же сети Docker.
xn--b1agamj3b4b.site {
	encode gzip
	reverse_proxy vsecheki-web:80
}

www.xn--b1agamj3b4b.site {
	redir https://xn--b1agamj3b4b.site{uri} permanent
}
```

**Дополнение 2026-10-19.** Владелец подключил латинский домен vsecheki.site: он только
перенаправляет 301 на всечеки.site. `deploy/publish.sh` дописал на сервере второй блок
(после пустой строки, сразу за первым), его тоже внести в репозиторий:

```caddyfile
# Латинский домен vsecheki.site (с www и без) — только 301 на https://всечеки.site, путь и параметры сохраняются.
# http:// записаны явно: иначе Caddy на 80-м порту сам ответит 308 на https://vsecheki.site, а 301 будет вторым шагом.
http://vsecheki.site, http://www.vsecheki.site, vsecheki.site, www.vsecheki.site {
	redir https://xn--b1agamj3b4b.site{uri} permanent
}
```

Перед каждым блоком в серверной версии стоит одна пустая строка. Точный текст на сервере:
`sudo git -C /opt/deployments/coffee-ride -c safe.directory='*' diff deploy/Caddyfile`.

Оформи это по правилам своего репозитория (номер CR, ADR, PR, CI) — по смыслу это
«Caddy также проксирует второй сайт владельца на том же сервере».

## Как это устроено со стороны «ВсеЧеки»

- Контейнер `vsecheki-web` (php:8.3-apache), проект Compose `vsecheki`, каталог
  `/opt/deployments/vsecheki`, файл `deploy/docker-compose.yml`.
- Он подключён к **внешней** сети `coffee-ride_default` под именем `vsecheki-web` — по
  нему Caddy и ходит на порт 80. Других связей с coffee-ride нет: своих томов, БД и
  переменных coffee-ride он не трогает.
- Настоящий IP посетителя Apache берёт из `X-Forwarded-For` (Caddy его ставит сам).
- `www.` и голый домен имеют A-записи на этот сервер; сертификаты Caddy выпустил сам
  (Let's Encrypt), хранятся в томе `coffee-ride_caddy_data`.

## Порядок действий

1. Внести блок в репозиторий coffee-ride и довести до `main` так, как у вас принято.
2. **До** следующего деплоя убедиться, что серверная правка не мешает: если деплой делает
   `git pull`/`reset`, на сервере сначала
   `sudo git -C /opt/deployments/coffee-ride -c safe.directory='*' checkout -- deploy/Caddyfile`
   — блок на это время пропадёт из файла, но Caddy продолжит работать на уже загруженном
   конфиге до следующего reload/рестарта.
3. Выкатить coffee-ride как обычно (Caddy перечитает конфиг уже с блоком из репозитория).
4. Удалить копию: `sudo rm /opt/deployments/coffee-ride/deploy/Caddyfile.bak-vsecheki-20261018135544`.
5. Проверить:
   - `curl -sI https://xn--b1agamj3b4b.site/` → `200`;
   - `curl -sI https://www.xn--b1agamj3b4b.site/` → `301` на голый домен;
   - `curl -sI 'http://vsecheki.site/a?b=1'` и `https://www.vsecheki.site/` → `301` на `https://xn--b1agamj3b4b.site/…` с тем же путём;
   - сам coffee-ride отвечает как прежде;
   - `git status` в `/opt/deployments/coffee-ride` чистый.

## Если coffee-ride пересоздаёт свою сеть

`docker compose down` у coffee-ride удаляет сеть `coffee-ride_default`; контейнер
`vsecheki-web` после этого остаётся без связи с Caddy (сайт отдаст 502). После
`up` coffee-ride выполнить:

```
cd /opt/deployments/vsecheki && sudo docker compose -f deploy/docker-compose.yml up -d
```

Надёжнее — закрепить это в процедуре деплоя coffee-ride (шаг после `up`) или вынести
общий прокси в отдельную сеть; решение за владельцем и за вами.

## Откат

Убрать блок из `deploy/Caddyfile` и выполнить
`sudo docker exec coffee-ride-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
всечеки.site перестанет открываться, coffee-ride это не затронет.
