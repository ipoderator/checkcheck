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

    /** Предел Bot API для sendMessage — в единицах UTF-16. */
    const MAX_TEXT_UNITS = 4096;

    /**
     * Текст сообщения в разметке HTML Bot API; данные посетителя экранированы.
     * Длинная заявка не должна давать 400: самые длинные значения укорачиваются
     * (со знаком «…»), разметка, телефон и время остаются целыми.
     */
    public static function formatMessage(array $lead): string
    {
        $rows = [];
        foreach (LeadRequest::describe($lead) as $row) {
            $rows[] = [$row[0], self::escape($row[1]), strpos($row[1], "\n") !== false];
        }
        $time = self::escape(LeadRequest::displayTime($lead['received_at']));
        $page = $lead['page'] !== '' ? self::escape($lead['page']) : null;

        $text = self::assemble((string) $lead['type_label'], $rows, $time, $page);
        $overflow = self::utf16Length($text) - self::MAX_TEXT_UNITS;
        while ($overflow > 0) {
            // Укорачиваем самое длинное значение; телефон не трогаем — по нему перезванивают.
            $longest = -1;
            $longestUnits = 0;
            foreach ($rows as $i => $row) {
                $units = self::utf16Length($row[1]);
                if ($row[0] !== 'Телефон' && $units > $longestUnits) {
                    $longest = $i;
                    $longestUnits = $units;
                }
            }
            $pageUnits = $page === null ? 0 : self::utf16Length($page);
            if ($pageUnits > $longestUnits) {
                $page = self::cut($page, $pageUnits - $overflow - 1) . '…';
            } elseif ($longest >= 0 && $longestUnits > 1) {
                $rows[$longest][1] = self::cut($rows[$longest][1], $longestUnits - $overflow - 1) . '…';
            } else {
                break;
            }
            $text = self::assemble((string) $lead['type_label'], $rows, $time, $page);
            $overflow = self::utf16Length($text) - self::MAX_TEXT_UNITS;
        }
        return $text;
    }

    /** @param array<int,array{0:string,1:string,2:bool}> $rows значения уже экранированы */
    private static function assemble(string $typeLabel, array $rows, string $time, $page): string
    {
        $lines = ['<b>Заявка с сайта: ' . self::escape($typeLabel) . '</b>', ''];
        foreach ($rows as $row) {
            $lines[] = $row[2]
                ? '<b>' . $row[0] . ":</b>\n" . $row[1]
                : '<b>' . $row[0] . ':</b> ' . $row[1];
        }
        $lines[] = '';
        $lines[] = '<b>Время:</b> ' . $time;
        if ($page !== null) {
            $lines[] = '<b>Страница:</b> ' . $page;
        }
        return implode("\n", $lines);
    }

    /** Длина в единицах UTF-16, как считает Telegram: символ вне BMP (эмодзи) — две единицы. */
    private static function utf16Length(string $value): int
    {
        $chars = preg_match_all('/./su', $value);
        $astral = preg_match_all('/[\x{10000}-\x{10FFFF}]/u', $value);
        if ($chars === false || $astral === false) {
            return strlen($value); // невалидный UTF-8 — верхняя оценка
        }
        return $chars + $astral;
    }

    /**
     * Начало экранированной строки не длиннее $units единиц UTF-16.
     * Режет только между символами (UTF-8 — пара суррогатов не рвётся) и не внутри &amp;-сущности.
     */
    private static function cut(string $escaped, int $units): string
    {
        if ($units <= 0 || preg_match_all('/&(?:[a-zA-Z]+|#\d+);|./su', $escaped, $m) === false) {
            return '';
        }
        $out = '';
        $used = 0;
        foreach ($m[0] as $token) {
            $size = $token[0] === '&' && strlen($token) > 1 ? strlen($token) : (strlen($token) === 4 ? 2 : 1);
            if ($used + $size > $units) {
                break;
            }
            $out .= $token;
            $used += $size;
        }
        return $out;
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
