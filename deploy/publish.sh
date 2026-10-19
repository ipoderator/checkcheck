#!/usr/bin/env bash
# Публикация «ВсеЧеки» на свой сервер за Caddy проекта coffee-ride.
#   bash deploy/publish.sh [user@host]
# Что делает:
#   1. выкладывает закоммиченную версию проекта в /opt/deployments/vsecheki (git archive HEAD);
#   2. кладёт туда .env (настройки почты) с правами 600 — значения не печатаются;
#   3. собирает и запускает контейнер vsecheki-web в сети Caddy;
#   4. добавляет в Caddyfile coffee-ride недостающие блоки: всечеки.site (deploy/Caddyfile.vsecheki)
#      и 301 с vsecheki.site (deploy/Caddyfile.vsecheki-latin) — сначала проверяет новый конфиг
#      внутри контейнера Caddy, при ошибке ничего не меняет; старый файл — в .bak;
#   5. мягко перечитывает Caddy (без остановки coffee-ride) и проверяет оба сайта и редирект.
# Повторный запуск безопасен: обновляет сайт, блоки в Caddyfile второй раз не добавляются.
set -euo pipefail

HOST="${1:-gleb@72.56.110.108}"
DIR=/opt/deployments/vsecheki
CADDY_FILE=/opt/deployments/coffee-ride/deploy/Caddyfile
CADDY_CONTAINER=coffee-ride-caddy-1
DOMAIN=xn--b1agamj3b4b.site   # всечеки.site

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Нет .env в корне проекта — заполните его по образцу .env.example." >&2; exit 1; }
git diff --quiet HEAD -- public deploy || { echo "В public/ или deploy/ есть незакоммиченные изменения — сначала закоммитьте." >&2; exit 1; }

echo "1/5 Выкладываю версию $(git rev-parse --short HEAD) в $HOST:$DIR"
git archive --format=tar HEAD | ssh "$HOST" "sudo mkdir -p $DIR && sudo tar -x -C $DIR"

echo "2/5 Настройки (.env) → сервер, права 600"
ssh "$HOST" "sudo tee $DIR/.env >/dev/null && sudo chmod 600 $DIR/.env" < .env

echo "3/5 Сборка и запуск контейнера"
ssh "$HOST" "cd $DIR && sudo docker compose -f deploy/docker-compose.yml up -d --build"

echo "4/5 Caddy: блоки доменов"
ssh "$HOST" "DIR=$DIR CADDY_FILE=$CADDY_FILE CADDY_CONTAINER=$CADDY_CONTAINER bash -s" <<'REMOTE'
set -euo pipefail
# «Начало первой строки блока|файл блока»: блок добавляется, только если такой строки в Caddyfile нет.
NEW=$(mktemp)
sudo cat "$CADDY_FILE" > "$NEW"
added=""
for pair in "xn--b1agamj3b4b.site {|Caddyfile.vsecheki" "http://vsecheki.site,|Caddyfile.vsecheki-latin"; do
  mark=${pair%%|*}; file=${pair#*|}
  if awk -v m="$mark" 'index($0, m) == 1 { found = 1 } END { exit !found }' "$NEW"; then
    echo "   $file: блок уже есть"
  else
    { echo; sudo cat "$DIR/deploy/$file"; } >> "$NEW"
    added="$added $file"
  fi
done
if [ -n "$added" ]; then
  sudo docker cp "$NEW" "$CADDY_CONTAINER:/tmp/Caddyfile.new"
  if ! sudo docker exec "$CADDY_CONTAINER" caddy validate --config /tmp/Caddyfile.new --adapter caddyfile >/dev/null 2>&1; then
    echo "   новый конфиг Caddy не прошёл проверку — ничего не меняю:" >&2
    sudo docker exec "$CADDY_CONTAINER" caddy validate --config /tmp/Caddyfile.new --adapter caddyfile >&2 || true
    exit 1
  fi
  BAK="$CADDY_FILE.bak-vsecheki-$(date +%Y%m%d%H%M%S)"
  sudo cp "$CADDY_FILE" "$BAK"
  # Запись на место (тот же inode): файл смонтирован в контейнер отдельным файлом.
  sudo sh -c "cat '$NEW' > '$CADDY_FILE'"
  echo "   добавлено:$added; копия прежнего файла: $BAK"
fi
rm -f "$NEW"
sudo docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
echo "   Caddy перечитан"
REMOTE

echo "5/5 Проверка (сертификат выпускается до минуты)"
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
  [ "$code" = 200 ] && break
  sleep 5
done
echo "   https://$DOMAIN/ → $code"
echo "   https://www.$DOMAIN/ → $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.$DOMAIN/" || true)"
# vsecheki.site — с самого сервера через --resolve: не зависит ни от DNS, ни от прокси между нами и сервером.
echo "   vsecheki.site: $(ssh "$HOST" "curl -s -o /dev/null -w 'http %{http_code} %{redirect_url}' --resolve vsecheki.site:80:127.0.0.1 'http://vsecheki.site/a?b=1'; curl -s -o /dev/null -w ' · https www %{http_code} %{redirect_url}' --resolve www.vsecheki.site:443:127.0.0.1 https://www.vsecheki.site/ || echo ' · https: нет сертификата — DNS ещё не на этом сервере?'" || true)"
echo "   /app/ → $(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/app/" || true) (ожидается 403)"
echo "   coffee-ride → $(ssh "$HOST" "sudo docker exec $CADDY_CONTAINER sh -c 'wget -qS -O /dev/null https://\$DOMAIN/ 2>&1 | head -1'" || echo 'не проверен')"
