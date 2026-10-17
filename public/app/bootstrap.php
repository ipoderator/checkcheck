<?php
// Подключение библиотеки приёма заявок. Вызывается только из api/lead.php,
// который определяет VSECHEKI_APP; прямой запрос к файлу ничего не исполняет.
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

ini_set('display_errors', '0');
error_reporting(E_ALL);

// Класс Config лежит в ConfigLoader.php: имя Config.php совпало бы с config.php
// владельца на нечувствительных к регистру файловых системах (macOS, Windows).
require_once __DIR__ . '/ConfigLoader.php';
require_once __DIR__ . '/Text.php';
require_once __DIR__ . '/LeadChannel.php';
require_once __DIR__ . '/LeadRequest.php';
require_once __DIR__ . '/RateLimiter.php';
require_once __DIR__ . '/TelegramChannel.php';
require_once __DIR__ . '/SmtpClient.php';
require_once __DIR__ . '/MailChannel.php';
require_once __DIR__ . '/LeadService.php';
require_once __DIR__ . '/LeadPage.php';
