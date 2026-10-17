<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Вся логика контракта POST /api/lead.php.
 * Порядок проверок: метод → ловушка/время → валидация → лимит → конфиг → доставка.
 * В лог ошибок пишутся только канал и текст ошибки, без персональных данных.
 */
final class LeadService
{
    /** @var LeadChannel[] */
    private $channels;
    /** @var RateLimiter */
    private $limiter;
    /** @var string */
    private $storageDir;

    /** @param LeadChannel[] $channels */
    public function __construct(array $channels, RateLimiter $limiter, string $storageDir)
    {
        $this->channels = $channels;
        $this->limiter = $limiter;
        $this->storageDir = rtrim($storageDir, '/\\');
    }

    /** @param array<string,string> $config результат Config::load() */
    public static function fromConfig(array $config): self
    {
        return new self(
            [
                new TelegramChannel($config['TELEGRAM_BOT_TOKEN'], $config['TELEGRAM_CHAT_ID'], $config['TELEGRAM_API_BASE']),
                new MailChannel($config),
            ],
            new RateLimiter($config['STORAGE_DIR']),
            $config['STORAGE_DIR']
        );
    }

    /**
     * @param array  $post        поля запроса ($_POST)
     * @param string $ip          адрес посетителя (REMOTE_ADDR)
     * @param string $method      HTTP-метод
     * @param string $contentType заголовок Content-Type
     * @return array{status:int, body:array}
     */
    public function handle(array $post, string $ip, string $method = 'POST', string $contentType = 'application/x-www-form-urlencoded'): array
    {
        if (strtoupper($method) !== 'POST') {
            return self::fail(405, 'method_not_allowed');
        }
        if (!self::isFormContentType($contentType)) {
            return self::fail(400, 'bad_request');
        }

        $request = LeadRequest::fromPost($post);
        if ($request->isTrapped() || $request->isTooFast()) {
            // Притворный успех: бот не узнаёт, что его отсеяли.
            return ['status' => 200, 'body' => ['ok' => true]];
        }

        $errors = $request->errors();
        if ($errors) {
            return ['status' => 422, 'body' => ['ok' => false, 'code' => 'validation', 'errors' => $errors]];
        }

        if (!$this->limiter->hit($ip, time())) {
            return self::fail(429, 'rate_limited');
        }

        $configured = [];
        foreach ($this->channels as $channel) {
            if ($channel->isConfigured()) {
                $configured[] = $channel;
            }
        }
        if (!$configured) {
            error_log('lead: не настроен ни один канал доставки (Telegram, e-mail) — заявка не принята');
            return self::fail(503, 'not_configured');
        }
        foreach ($this->channels as $channel) {
            if (!$channel->isConfigured()) {
                error_log('lead: канал ' . $channel->name() . ' не настроен — пропущен');
            }
        }

        $lead = $request->toLead($ip, new DateTimeImmutable('now'));
        $delivered = [];
        $failed = [];
        foreach ($configured as $channel) {
            try {
                $channel->send($lead);
                $delivered[] = $channel->name();
            } catch (RuntimeException $e) {
                $failed[] = $channel->name();
                error_log('lead: канал ' . $channel->name() . ' не доставил заявку: ' . $e->getMessage());
            } catch (Throwable $e) {
                $failed[] = $channel->name();
                error_log('lead: канал ' . $channel->name() . ' не доставил заявку: ' . get_class($e));
            }
        }

        if ($delivered) {
            return ['status' => 200, 'body' => ['ok' => true]];
        }

        $this->saveFailedLead($lead, $failed);
        return self::fail(502, 'delivery_failed');
    }

    /** Резервная копия заявки, которую не доставил ни один канал: одна JSON-строка на заявку. */
    private function saveFailedLead(array $lead, array $failedChannels): void
    {
        $line = json_encode([
            'saved_at' => $lead['received_at'],
            'failed_channels' => $failedChannels,
            'lead' => $lead,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        $dir = $this->storageDir;
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            error_log('lead: не удалось создать папку хранилища для резервной копии заявки');
            return;
        }
        if ($line === false || @file_put_contents($dir . '/failed-leads.jsonl', $line . "\n", FILE_APPEND | LOCK_EX) === false) {
            error_log('lead: не удалось записать резервную копию заявки');
        }
    }

    private static function isFormContentType(string $contentType): bool
    {
        $type = strtolower(trim(explode(';', $contentType)[0]));
        return $type === 'application/x-www-form-urlencoded' || $type === 'multipart/form-data';
    }

    private static function fail(int $status, string $code): array
    {
        return ['status' => $status, 'body' => ['ok' => false, 'code' => $code]];
    }
}
