<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Лимит заявок с одного IP: не больше $max за $window секунд.
 * Хранение — по файлу на IP (имя — хеш адреса) в STORAGE_DIR/ratelimit/;
 * файлы, не менявшиеся дольше часа, удаляются при каждом обращении.
 */
final class RateLimiter
{
    const CLEANUP_AFTER = 3600;

    /** @var string */
    private $dir;
    /** @var int */
    private $max;
    /** @var int */
    private $window;

    public function __construct(string $storageDir, int $max = 5, int $window = 600)
    {
        $this->dir = rtrim($storageDir, '/\\') . '/ratelimit';
        $this->max = $max;
        $this->window = $window;
    }

    /**
     * Засчитывает попытку. false — лимит исчерпан (попытка не засчитана).
     * Если хранилище недоступно, заявку не блокируем: потерять клиента хуже, чем пропустить спам.
     */
    public function hit(string $ip, int $now): bool
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0755, true) && !is_dir($this->dir)) {
            error_log('lead: лимит частоты недоступен — не удалось создать папку хранилища');
            return true;
        }
        $this->cleanup($now);

        $file = $this->dir . '/' . hash('sha256', $ip) . '.json';
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            error_log('lead: лимит частоты недоступен — не удалось открыть файл');
            return true;
        }
        try {
            flock($handle, LOCK_EX);
            $raw = stream_get_contents($handle);
            $times = json_decode(is_string($raw) ? $raw : '', true);
            if (!is_array($times)) {
                $times = [];
            }
            $since = $now - $this->window;
            $recent = [];
            foreach ($times as $time) {
                if (is_int($time) && $time > $since && $time <= $now) {
                    $recent[] = $time;
                }
            }
            if (count($recent) >= $this->max) {
                return false;
            }
            $recent[] = $now;
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($recent));
            fflush($handle);
            return true;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    private function cleanup(int $now): void
    {
        $files = glob($this->dir . '/*.json');
        if (!is_array($files)) {
            return;
        }
        foreach ($files as $file) {
            $mtime = @filemtime($file);
            if ($mtime !== false && $mtime < $now - self::CLEANUP_AFTER) {
                @unlink($file);
            }
        }
    }
}
