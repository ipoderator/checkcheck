<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Минимальный SMTP-клиент на сокетах: EHLO, STARTTLS или SSL, AUTH LOGIN, MAIL/RCPT/DATA.
 * Логин и пароль уходят только по TLS (ssl, tls или объявленный сервером STARTTLS);
 * открытым текстом — лишь на 127.0.0.1 и localhost.
 * Ошибки — RuntimeException с этапом и кодом ответа, без логина, пароля и адресов.
 */
final class SmtpClient
{
    /** @var string */
    private $host;
    /** @var int */
    private $port;
    /** @var string ssl | tls | '' */
    private $secure;
    /** @var string */
    private $user;
    /** @var string */
    private $password;
    /** @var int */
    private $timeout;
    /** @var resource|null */
    private $socket = null;

    public function __construct(string $host, int $port, string $secure, string $user, string $password, int $timeout = 15)
    {
        $this->host = $host;
        $this->secure = $secure;
        if ($port <= 0) {
            $port = $secure === 'ssl' ? 465 : ($secure === 'tls' ? 587 : 25);
        }
        $this->port = $port;
        $this->user = $user;
        $this->password = $password;
        $this->timeout = $timeout;
    }

    /**
     * @param string   $from       адрес отправителя (envelope)
     * @param string[] $recipients адреса получателей
     * @param string   $message    письмо целиком: заголовки, пустая строка, тело
     */
    public function send(string $from, array $recipients, string $message): void
    {
        $this->connect();
        try {
            $this->expect('приветствие', [220]);
            $helo = self::heloName();
            $capabilities = $this->command('EHLO ' . $helo, 'EHLO', [250]);
            $useStartTls = $this->secure === 'tls';
            if ($this->secure !== 'ssl' && $this->secure !== 'tls' && $this->user !== '' && !$this->isLocalHost()) {
                // Логин и пароль открытым текстом не отправляем: только по TLS.
                if (!self::advertises($capabilities, 'STARTTLS')) {
                    throw new RuntimeException(
                        'SMTP: сервер не предлагает STARTTLS, а SMTP_SECURE не задан — '
                        . 'логин и пароль без шифрования не отправлены; задайте в SMTP_SECURE значение ssl или tls'
                    );
                }
                $useStartTls = true;
            }
            if ($useStartTls) {
                $this->command('STARTTLS', 'STARTTLS', [220]);
                $method = STREAM_CRYPTO_METHOD_TLS_CLIENT;
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                    $method |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
                }
                if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                    $method |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
                }
                if (@stream_socket_enable_crypto($this->socket, true, $method) !== true) {
                    throw new RuntimeException('SMTP: не удалось включить STARTTLS');
                }
                $this->command('EHLO ' . $helo, 'EHLO после STARTTLS', [250]);
            }
            if ($this->user !== '') {
                $this->command('AUTH LOGIN', 'AUTH', [334]);
                $this->command(base64_encode($this->user), 'AUTH (логин)', [334]);
                $this->command(base64_encode($this->password), 'AUTH (пароль)', [235]);
            }
            $this->command('MAIL FROM:<' . $from . '>', 'MAIL FROM', [250]);
            foreach ($recipients as $recipient) {
                $this->command('RCPT TO:<' . $recipient . '>', 'RCPT TO', [250, 251]);
            }
            $this->command('DATA', 'DATA', [354]);
            $this->write(self::dotStuff($message) . "\r\n.\r\n");
            $this->expect('конец DATA', [250]);
            try {
                $this->command('QUIT', 'QUIT', [221]);
            } catch (RuntimeException $e) {
                // Письмо уже принято; ответ на QUIT не важен.
            }
        } finally {
            $this->close();
        }
    }

    private function connect(): void
    {
        // IPv6-адрес в URL сокета пишется в квадратных скобках.
        $host = strpos($this->host, ':') !== false && $this->host[0] !== '[' ? '[' . $this->host . ']' : $this->host;
        $remote = ($this->secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $this->port;
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
                'peer_name' => $this->host,
                'SNI_enabled' => true,
            ],
        ]);
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client($remote, $errno, $errstr, $this->timeout, STREAM_CLIENT_CONNECT, $context);
        if ($socket === false) {
            throw new RuntimeException('SMTP: нет соединения с сервером (' . $errno . ')');
        }
        stream_set_timeout($socket, $this->timeout);
        $this->socket = $socket;
    }

    private function close(): void
    {
        if (is_resource($this->socket)) {
            fclose($this->socket);
        }
        $this->socket = null;
    }

    /**
     * @param int[] $codes
     * @return string[] строки ответа сервера
     */
    private function command(string $line, string $stage, array $codes): array
    {
        $this->write($line . "\r\n");
        return $this->expect($stage, $codes);
    }

    private function write(string $data): void
    {
        $length = strlen($data);
        $written = 0;
        while ($written < $length) {
            $chunk = @fwrite($this->socket, substr($data, $written));
            if ($chunk === false || $chunk === 0) {
                throw new RuntimeException('SMTP: соединение прервано при отправке');
            }
            $written += $chunk;
        }
    }

    /**
     * @param int[] $codes
     * @return string[] строки ответа сервера
     */
    private function expect(string $stage, array $codes): array
    {
        $code = 0;
        $lines = [];
        while (true) {
            $line = @fgets($this->socket, 1024);
            if ($line === false) {
                throw new RuntimeException('SMTP: сервер не ответил на этапе ' . $stage);
            }
            $lines[] = rtrim($line, "\r\n");
            $code = (int) substr($line, 0, 3);
            // Многострочный ответ: «250-…», последняя строка — «250 …».
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        if (!in_array($code, $codes, true)) {
            throw new RuntimeException('SMTP: код ' . $code . ' на этапе ' . $stage);
        }
        return $lines;
    }

    /** Локальный сервер (127.0.0.1, localhost): там вход без TLS допустим. */
    private function isLocalHost(): bool
    {
        $host = strtolower(trim($this->host, '[]'));
        return $host === '127.0.0.1' || $host === 'localhost';
    }

    /** @param string[] $ehloLines ответ на EHLO */
    private static function advertises(array $ehloLines, string $extension): bool
    {
        foreach ($ehloLines as $i => $line) {
            if ($i === 0) {
                continue; // первая строка — имя сервера
            }
            $words = preg_split('/\s+/', strtoupper(trim(substr($line, 4))));
            if (is_array($words) && $words[0] === $extension) {
                return true;
            }
        }
        return false;
    }

    private static function heloName(): string
    {
        $name = function_exists('gethostname') ? (string) gethostname() : '';
        $name = (string) preg_replace('/[^A-Za-z0-9.-]/', '', $name);
        return $name !== '' ? $name : 'localhost';
    }

    /** Строки письма с CRLF; строка, начинающаяся с точки, получает вторую точку. */
    private static function dotStuff(string $message): string
    {
        $message = str_replace(["\r\n", "\r"], "\n", $message);
        $lines = explode("\n", $message);
        foreach ($lines as $i => $line) {
            if ($line !== '' && $line[0] === '.') {
                $lines[$i] = '.' . $line;
            }
        }
        return implode("\r\n", $lines);
    }
}
