<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Дубль заявки письмом (UTF-8, тема в =?UTF-8?B?…?=, Reply-To клиента).
 * Транспорт (MAIL_TRANSPORT): '' — SMTP, если задан SMTP_HOST, иначе mail();
 * 'smtp', 'mail' — явно; 'file' — письма пишутся в STORAGE_DIR/outbox/ (для тестов).
 */
final class MailChannel implements LeadChannel
{
    const SENDER_NAME = 'Сайт ВсеЧеки';

    /** @var array<string,string> */
    private $config;

    /** @param array<string,string> $config результат Config::load() */
    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function name(): string
    {
        return 'email';
    }

    public function isConfigured(): bool
    {
        return trim((string) $this->config['LEAD_EMAIL_TO']) !== '';
    }

    public function send(array $lead): void
    {
        $recipients = self::addresses((string) $this->config['LEAD_EMAIL_TO']);
        if (!$recipients) {
            throw new RuntimeException('E-mail: в LEAD_EMAIL_TO нет корректного адреса');
        }
        $from = $this->sender($recipients);
        $replyTo = '';
        if ($lead['email'] !== '' && filter_var($lead['email'], FILTER_VALIDATE_EMAIL) !== false) {
            $replyTo = $lead['email'];
        }

        $subject = self::encodeHeader('Заявка с сайта: ' . $lead['type_label'] . ' — ' . $lead['name']);
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . self::encodeHeader(self::SENDER_NAME) . ' <' . $from . '>',
        ];
        if ($replyTo !== '') {
            $headers[] = 'Reply-To: ' . $replyTo;
        }
        $headers[] = 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . self::domainOf($from) . '>';
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: base64';
        $body = rtrim(chunk_split(base64_encode(self::formatBody($lead)), 76, "\r\n"));
        $to = implode(', ', $recipients);

        $transport = $this->transport();
        if ($transport === 'file') {
            $this->writeToOutbox(array_merge(['To: ' . $to, 'Subject: ' . $subject], $headers), $body);
        } elseif ($transport === 'smtp') {
            $message = implode("\r\n", array_merge(['To: ' . $to, 'Subject: ' . $subject], $headers)) . "\r\n\r\n" . $body;
            $smtp = new SmtpClient(
                (string) $this->config['SMTP_HOST'],
                (int) $this->config['SMTP_PORT'],
                (string) $this->config['SMTP_SECURE'],
                (string) $this->config['SMTP_USER'],
                (string) $this->config['SMTP_PASSWORD']
            );
            $smtp->send($from, $recipients, $message);
        } else {
            if (!function_exists('mail')) {
                throw new RuntimeException('E-mail: функция mail() недоступна на хостинге');
            }
            if (!@mail($to, $subject, $body, implode("\r\n", $headers))) {
                throw new RuntimeException('E-mail: mail() вернула ошибку');
            }
        }
    }

    /** Текст письма: те же поля, что в Telegram, без разметки. */
    public static function formatBody(array $lead): string
    {
        $lines = ['Заявка с сайта: ' . $lead['type_label'], ''];
        foreach (LeadRequest::describe($lead) as $row) {
            $lines[] = strpos($row[1], "\n") === false ? $row[0] . ': ' . $row[1] : $row[0] . ":\n" . $row[1];
        }
        $lines[] = '';
        $lines[] = 'Время: ' . LeadRequest::displayTime($lead['received_at']);
        if ($lead['page'] !== '') {
            $lines[] = 'Страница: ' . $lead['page'];
        }
        if ($lead['email'] !== '') {
            $lines[] = '';
            $lines[] = 'Ответ на это письмо уйдёт клиенту на e-mail.';
        }
        return implode("\r\n", str_replace("\n", "\r\n", $lines));
    }

    private function transport(): string
    {
        $transport = (string) $this->config['MAIL_TRANSPORT'];
        if (in_array($transport, ['file', 'smtp', 'mail'], true)) {
            return $transport;
        }
        return trim((string) $this->config['SMTP_HOST']) !== '' ? 'smtp' : 'mail';
    }

    /** @param string[] $recipients */
    private function sender(array $recipients): string
    {
        foreach (['LEAD_EMAIL_FROM', 'SMTP_USER'] as $key) {
            $candidate = trim((string) $this->config[$key]);
            if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL) !== false) {
                return $candidate;
            }
        }
        return $recipients[0];
    }

    /** @return string[] корректные адреса из списка через запятую, точку с запятой или пробел */
    private static function addresses(string $list): array
    {
        $result = [];
        foreach (preg_split('/[\s,;]+/', $list, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $address) {
            if (filter_var($address, FILTER_VALIDATE_EMAIL) !== false) {
                $result[] = $address;
            }
        }
        return $result;
    }

    private static function domainOf(string $address): string
    {
        $at = strrpos($address, '@');
        $domain = $at === false ? '' : substr($address, $at + 1);
        $domain = (string) preg_replace('/[^A-Za-z0-9.-]/', '', $domain);
        return $domain !== '' ? $domain : 'localhost';
    }

    /**
     * Заголовок в кодировке RFC 2047: =?UTF-8?B?…?=, слова по 45 байт исходного текста,
     * чтобы каждое было не длиннее 75 символов и не резало символ UTF-8.
     */
    public static function encodeHeader(string $text): string
    {
        $text = Text::line($text);
        $words = [];
        $chunk = '';
        foreach (Text::chars($text) as $char) {
            if ($chunk !== '' && strlen($chunk) + strlen($char) > 45) {
                $words[] = '=?UTF-8?B?' . base64_encode($chunk) . '?=';
                $chunk = '';
            }
            $chunk .= $char;
        }
        if ($chunk !== '' || !$words) {
            $words[] = '=?UTF-8?B?' . base64_encode($chunk) . '?=';
        }
        return implode(' ', $words);
    }

    /** @param string[] $headers */
    private function writeToOutbox(array $headers, string $body): void
    {
        $dir = rtrim((string) $this->config['STORAGE_DIR'], '/\\') . '/outbox';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new RuntimeException('E-mail: не удалось создать папку outbox');
        }
        $micro = (int) (fmod(microtime(true), 1) * 1000000);
        $name = sprintf('%s-%06d-%s.eml', date('Ymd-His'), $micro, bin2hex(random_bytes(4)));
        $file = $dir . '/' . $name;
        if (@file_put_contents($file, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n", LOCK_EX) === false) {
            throw new RuntimeException('E-mail: не удалось записать письмо в outbox');
        }
    }
}
