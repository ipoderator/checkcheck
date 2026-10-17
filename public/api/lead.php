<?php
// Единственная точка входа бэкенда: приём заявок с формы сайта.
// Контракт ответов — в LeadService; здесь только вызов и вывод.
// Скрипт формы шлёт Accept: application/json и получает JSON. Форма без JS (обычный POST
// браузера) получает тот же итог HTML-страницей со ссылкой «Вернуться к форме».
define('VSECHEKI_APP', true);

require dirname(__DIR__) . '/app/bootstrap.php';

$accept = isset($_SERVER['HTTP_ACCEPT']) ? (string) $_SERVER['HTTP_ACCEPT'] : '';
$wantsJson = stripos($accept, 'application/json') !== false;

header($wantsJson ? 'Content-Type: application/json; charset=utf-8' : 'Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('Vary: Accept');
header('X-Content-Type-Options: nosniff');

$method = isset($_SERVER['REQUEST_METHOD']) ? (string) $_SERVER['REQUEST_METHOD'] : 'GET';
$contentType = isset($_SERVER['CONTENT_TYPE']) ? (string) $_SERVER['CONTENT_TYPE'] : '';
$ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';

try {
    $result = LeadService::fromConfig(Config::load())->handle($_POST, $ip, $method, $contentType);
} catch (Throwable $e) {
    error_log('lead: внутренняя ошибка: ' . get_class($e) . ': ' . $e->getMessage());
    $result = ['status' => 500, 'body' => ['ok' => false, 'code' => 'server_error']];
}

if ($result['status'] === 405) {
    header('Allow: POST');
}
http_response_code($result['status']);
if ($wantsJson) {
    echo json_encode($result['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
} else {
    echo LeadPage::render($result['status'], $result['body']);
}
