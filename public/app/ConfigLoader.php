<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Настройки приёма заявок.
 * Источник каждого ключа: переменная окружения (если непустая), иначе app/config.php, иначе значение по умолчанию.
 */
final class Config
{
    /** Ключи и значения по умолчанию. Секретов здесь нет и быть не должно. */
    const DEFAULTS = [
        'TELEGRAM_BOT_TOKEN' => '',
        'TELEGRAM_CHAT_ID' => '',
        'LEAD_EMAIL_TO' => '',
        'LEAD_EMAIL_FROM' => '',
        'SMTP_HOST' => '',
        'SMTP_PORT' => '',
        'SMTP_USER' => '',
        'SMTP_PASSWORD' => '',
        'SMTP_SECURE' => '',
        // Тестовые переключатели.
        'TELEGRAM_API_BASE' => 'https://api.telegram.org',
        'MAIL_TRANSPORT' => '',
        'STORAGE_DIR' => '',
    ];

    /** @return array<string,string> */
    public static function load(): array
    {
        $file = __DIR__ . '/config.php';
        $fromFile = [];
        if (is_file($file)) {
            $loaded = include $file;
            if (is_array($loaded)) {
                $fromFile = $loaded;
            } else {
                error_log('lead: app/config.php должен возвращать массив — файл пропущен');
            }
        }

        $config = [];
        foreach (self::DEFAULTS as $key => $default) {
            $env = getenv($key);
            if (is_string($env) && trim($env) !== '') {
                $config[$key] = trim($env);
            } elseif (isset($fromFile[$key]) && is_scalar($fromFile[$key]) && trim((string) $fromFile[$key]) !== '') {
                $config[$key] = trim((string) $fromFile[$key]);
            } else {
                $config[$key] = $default;
            }
        }

        if ($config['STORAGE_DIR'] === '') {
            $config['STORAGE_DIR'] = dirname(__DIR__) . '/storage';
        }
        $config['SMTP_SECURE'] = strtolower($config['SMTP_SECURE']);
        $config['MAIL_TRANSPORT'] = strtolower($config['MAIL_TRANSPORT']);
        $config['TELEGRAM_API_BASE'] = rtrim($config['TELEGRAM_API_BASE'], '/');

        return $config;
    }
}
