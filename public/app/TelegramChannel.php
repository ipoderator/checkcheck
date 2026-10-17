<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/** Отправка заявки одним сообщением через Bot API (sendMessage, parse_mode HTML). */
final class TelegramChannel implements LeadChannel
{
    /** @var string */
    private $token;
    /** @var string */
    private $chatId;
    /** @var string */
    private $apiBase;
    /** @var int */
    private $timeout;

    public function __construct(string $token, string $chatId, string $apiBase = 'https://api.telegram.org', int $timeout = 10)
    {
        $this->token = $token;
        $this->chatId = $chatId;
        $this->apiBase = rtrim($apiBase, '/');
        $this->timeout = $timeout;
    }

    public function name(): string
    {
        return 'telegram';
    }

    public function isConfigured(): bool
    {
        return $this->token !== '' && $this->chatId !== '';
    }

    public function send(array $lead): void
    {
        $payload = json_encode([
            'chat_id' => $this->chatId,
            'text' => self::formatMessage($lead),
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($payload === false) {
            throw new RuntimeException('Telegram: не удалось собрать сообщение');
        }
        // URL содержит токен — в сообщения об ошибках он не попадает.
        $url = $this->apiBase . '/bot' . $this->token . '/sendMessage';
        $response = function_exists('curl_init') ? $this->postCurl($url, $payload) : $this->postStream($url, $payload);
        $status = $response[0];
        $decoded = json_decode($response[1], true);
        if ($status !== 200 || !is_array($decoded) || empty($decoded['ok'])) {
            throw new RuntimeException('Telegram: сообщение не принято, HTTP ' . $status);
        }
    }

    /** Текст сообщения в разметке HTML Bot API; данные посетителя экранированы. */
    public static function formatMessage(array $lead): string
    {
        $lines = ['<b>Заявка с сайта: ' . self::escape($lead['type_label']) . '</b>', ''];
        foreach (LeadRequest::describe($lead) as $row) {
            $value = self::escape($row[1]);
            $lines[] = strpos($row[1], "\n") === false
                ? '<b>' . $row[0] . ':</b> ' . $value
                : '<b>' . $row[0] . ":</b>\n" . $value;
        }
        $lines[] = '';
        $lines[] = '<b>Время:</b> ' . self::escape(LeadRequest::displayTime($lead['received_at']));
        if ($lead['page'] !== '') {
            $lines[] = '<b>Страница:</b> ' . self::escape($lead['page']);
        }
        return implode("\n", $lines);
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /** @return array{0:int,1:string} */
    private function postCurl(string $url, string $payload): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Telegram: curl недоступен');
        }
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => $this->timeout,
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno = curl_errno($ch);
        if (PHP_VERSION_ID < 80000) {
            curl_close($ch);
        }
        if (!is_string($body)) {
            throw new RuntimeException('Telegram: нет ответа от сервера (curl ' . $errno . ')');
        }
        return [$status, $body];
    }

    /** Запасной путь без curl. @return array{0:int,1:string} */
    private function postStream(string $url, string $payload): array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\nContent-Length: " . strlen($payload) . "\r\n",
                'content' => $payload,
                'timeout' => $this->timeout,
                'ignore_errors' => true,
            ],
        ]);
        $stream = @fopen($url, 'rb', false, $context);
        if ($stream === false) {
            throw new RuntimeException('Telegram: нет ответа от сервера');
        }
        $meta = stream_get_meta_data($stream);
        $body = stream_get_contents($stream);
        fclose($stream);
        $headers = isset($meta['wrapper_data']) && is_array($meta['wrapper_data']) ? $meta['wrapper_data'] : [];
        // Статус — последняя строка «HTTP/…» (после возможных переадресаций).
        $statusLine = '';
        foreach ($headers as $header) {
            if (is_string($header) && strpos($header, 'HTTP/') === 0) {
                $statusLine = $header;
            }
        }
        if (!is_string($body) || $statusLine === '') {
            throw new RuntimeException('Telegram: нет ответа от сервера');
        }
        $status = 0;
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $statusLine, $m) === 1) {
            $status = (int) $m[1];
        }
        return [$status, $body];
    }
}
