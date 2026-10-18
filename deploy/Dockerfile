# Сайт «ВсеЧеки» на своём сервере: Apache + PHP в одном контейнере.
# Apache выбран, чтобы работал тот же public/.htaccess, что и на обычном хостинге
# (закрытые app/ и storage/, страница 404, заголовки безопасности).
# Снаружи стоит обратный прокси (Caddy) — он держит 80/443 и выпускает HTTPS.
FROM php:8.3-apache

RUN a2enmod headers expires deflate remoteip \
 && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
 && { \
      echo 'ServerTokens Prod'; \
      echo 'ServerSignature Off'; \
      echo '# Настоящий IP посетителя — из X-Forwarded-For от прокси во внутренней сети Docker,'; \
      echo '# иначе лимит частоты заявок считал бы всех посетителей одним адресом.'; \
      echo 'RemoteIPHeader X-Forwarded-For'; \
      echo 'RemoteIPInternalProxy 10.0.0.0/8'; \
      echo 'RemoteIPInternalProxy 172.16.0.0/12'; \
      echo 'RemoteIPInternalProxy 192.168.0.0/16'; \
    } > /etc/apache2/conf-enabled/vsecheki.conf \
 && mkdir -p /var/www/storage && chown www-data:www-data /var/www/storage

COPY --chown=www-data:www-data public/ /var/www/html/

# Заявки, лимит частоты и несостоявшиеся доставки — вне папки сайта, в томе.
ENV STORAGE_DIR=/var/www/storage
