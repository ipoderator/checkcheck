<?php
// Шаблон настроек приёма заявок.
// Скопируйте этот файл в app/config.php (он в .gitignore) и заполните значения на хостинге.
// Переменные окружения с теми же именами важнее этого файла.
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

return [
    // Telegram: токен бота от @BotFather и ID чата, куда бот пишет заявки.
    'TELEGRAM_BOT_TOKEN' => '',
    'TELEGRAM_CHAT_ID' => '',

    // E-mail: куда дублировать заявки (можно несколько адресов через запятую) и от чьего имени.
    'LEAD_EMAIL_TO' => '',
    'LEAD_EMAIL_FROM' => '',

    // SMTP (необязательно). Если SMTP_HOST пуст, письмо уходит через mail() хостинга.
    // Значение SMTP_SECURE — ssl (обычно порт 465), tls (STARTTLS, обычно порт 587) или пусто.
    'SMTP_HOST' => '',
    'SMTP_PORT' => '',
    'SMTP_USER' => '',
    'SMTP_PASSWORD' => '',
    'SMTP_SECURE' => '',
];
