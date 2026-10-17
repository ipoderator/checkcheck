<?php
// Единственная точка входа бэкенда: приём заявок с формы сайта.
// Контракт ответов — в LeadService; здесь только вызов и вывод JSON.
define('VSECHEKI_APP', true);

require dirname(__DIR__) . '/app/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
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
echo json_encode($result['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
