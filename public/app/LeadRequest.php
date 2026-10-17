<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Разбор и проверка полей заявки из POST.
 * Ограничения — по контракту POST /api/lead.php (interfaces.md).
 */
final class LeadRequest
{
    const TYPES = ['price' => 'Рассчитать цену', 'partner' => 'Сотрудничество'];
    const FORMATS = ['57x40' => '57 × 40', '80x80' => '80 × 80', 'other' => 'Другой размер'];
    /** Минимальное время заполнения формы (form_elapsed_ms, измеряет браузер), мс. */
    const MIN_FILL_MS = 3000;
    /**
     * Правила полей — те же, что в public/assets/js/lead-form.js (PHONE_CHARS, EMAIL_PATTERN):
     * при правке менять в обоих местах, тест tests/e2e/form.spec.mjs сверяет клиент и сервер.
     * Телефон: только цифры, пробелы, + ( ) - . и типографские тире/пробелы.
     */
    const PHONE_CHARS = '/^[0-9+().\- \x{00A0}\x{2009}\x{202F}\x{2010}-\x{2015}]*$/u';
    /** E-mail: латинская локальная часть без «..» и точек по краям; домен с точкой, допустима кириллица. */
    const EMAIL_PATTERN = '/^(?!\.)(?!.*\.\.)[A-Za-z0-9!#$%&\'*+\/=?^_`{|}~.\-]{1,64}(?<!\.)@(?:[\p{L}\p{N}](?:[\p{L}\p{N}\-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,63}|xn--[a-z0-9\-]{1,59})$/iu';

    /** @var array<string,string> */
    private $fields = [];
    /** @var array<string,string> */
    private $errors = [];
    /** @var string */
    private $trap = '';
    /** @var bool поле form_elapsed_ms пришло непустым */
    private $hasElapsed = false;
    /** @var float|null время заполнения в мс; null — значение некорректное */
    private $elapsedMs = null;

    public static function fromPost(array $post): self
    {
        $request = new self();
        $request->parse($post);
        return $request;
    }

    private static function value(array $post, string $key): string
    {
        if (!isset($post[$key]) || !is_scalar($post[$key])) {
            return '';
        }
        return (string) $post[$key];
    }

    private function parse(array $post): void
    {
        $nb = "\u{00A0}";
        $type = Text::line(self::value($post, 'type'));
        $f = [
            'type' => $type,
            'name' => Text::line(self::value($post, 'name')),
            'phone' => Text::line(self::value($post, 'phone')),
            'email' => Text::line(self::value($post, 'email')),
            'company' => Text::line(self::value($post, 'company')),
            'region' => Text::line(self::value($post, 'region')),
            'format' => '',
            'format_custom' => '',
            'quantity' => '',
            'message' => Text::multiline(self::value($post, 'message')),
            'page' => Text::cut(Text::line(self::value($post, 'page')), 300),
        ];
        if ($type === 'price') {
            $f['format'] = Text::line(self::value($post, 'format'));
            $f['format_custom'] = Text::line(self::value($post, 'format_custom'));
            $f['quantity'] = Text::line(self::value($post, 'quantity'));
        }
        $this->trap = self::value($post, 'website');
        // Пустое значение — как отсутствие поля; число (целое или дробное) ≥ 0 — время заполнения.
        $elapsed = trim(self::value($post, 'form_elapsed_ms'));
        if (array_key_exists('form_elapsed_ms', $post) && $elapsed !== '') {
            $this->hasElapsed = true;
            if (preg_match('/^\d{1,15}(\.\d+)?$/', $elapsed) === 1) {
                $this->elapsedMs = (float) $elapsed;
            }
        }

        $e = [];
        if (!isset(self::TYPES[$type])) {
            $e['type'] = 'Выберите тип заявки.';
        }

        $nameLength = Text::length($f['name']);
        if ($nameLength === 0) {
            $e['name'] = 'Укажите имя.';
        } elseif ($nameLength < 2) {
            $e['name'] = "Имя слишком короткое{$nb}— нужно хотя бы 2{$nb}символа.";
        } elseif ($nameLength > 100) {
            $e['name'] = "Имя слишком длинное{$nb}— не{$nb}больше 100{$nb}символов.";
        }

        if ($f['phone'] === '') {
            $e['phone'] = 'Укажите телефон.';
        } else {
            $normalized = self::normalizePhone($f['phone']);
            if ($normalized === null) {
                $e['phone'] = "Укажите телефон: 10{$nb}цифр после +7 или{$nb}8.";
            } else {
                $f['phone'] = $normalized;
            }
        }

        if ($f['email'] !== '') {
            if (Text::length($f['email']) > 254) {
                $e['email'] = "Адрес e-mail слишком длинный{$nb}— не{$nb}больше 254{$nb}символов.";
            } elseif (preg_match(self::EMAIL_PATTERN, $f['email']) !== 1) {
                $e['email'] = "Проверьте адрес e-mail{$nb}— например, name@mail.ru.";
            }
        }

        if (Text::length($f['company']) > 150) {
            $e['company'] = "Название компании{$nb}— не{$nb}больше 150{$nb}символов.";
        }
        if (Text::length($f['region']) > 150) {
            $e['region'] = "Регион{$nb}— не{$nb}больше 150{$nb}символов.";
        }

        if ($type === 'price') {
            if ($f['format'] !== '' && !isset(self::FORMATS[$f['format']])) {
                $e['format'] = 'Выберите формат из списка.';
            }
            if ($f['format'] === 'other' && $f['format_custom'] === '') {
                $e['format_custom'] = 'Укажите нужный размер ленты.';
            } elseif (Text::length($f['format_custom']) > 100) {
                $e['format_custom'] = "Размер{$nb}— не{$nb}больше 100{$nb}символов.";
            }
            if ($f['format'] !== 'other') {
                $f['format_custom'] = '';
            }
            if (Text::length($f['quantity']) > 100) {
                $e['quantity'] = "Количество{$nb}— не{$nb}больше 100{$nb}символов.";
            }
        }

        if (Text::length($f['message']) > 2000) {
            $e['message'] = "Комментарий{$nb}— не{$nb}больше 2000{$nb}символов.";
        }

        if (self::value($post, 'consent') !== '1') {
            $e['consent'] = "Нужно согласие на{$nb}обработку персональных данных.";
        }

        $this->fields = $f;
        $this->errors = $e;
    }

    /** +7XXXXXXXXXX или null, если номер не похож на российский или в нём есть буквы. */
    public static function normalizePhone(string $phone): ?string
    {
        if (Text::length($phone) > 40 || preg_match(self::PHONE_CHARS, $phone) !== 1) {
            return null;
        }
        $digits = (string) preg_replace('/\D+/', '', $phone);
        $length = strlen($digits);
        if ($length === 11 && ($digits[0] === '7' || $digits[0] === '8')) {
            return '+7' . substr($digits, 1);
        }
        if ($length === 10 && $digits[0] === '9') {
            return '+7' . $digits;
        }
        return null;
    }

    /** Заполнено поле-ловушка. */
    public function isTrapped(): bool
    {
        return trim($this->trap) !== '';
    }

    /**
     * Похоже на бота по времени заполнения: form_elapsed_ms меньше MIN_FILL_MS,
     * нечисловое или отрицательное. Поля нет или оно пустое (форма без JS) — проверка пропускается.
     * Часы сервера не участвуют: время целиком измерено браузером.
     */
    public function isTooFast(): bool
    {
        if (!$this->hasElapsed) {
            return false;
        }
        return $this->elapsedMs === null || $this->elapsedMs < self::MIN_FILL_MS;
    }

    /** @return array<string,string> */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Заполненные поля заявки для сообщения и письма, по порядку.
     * @return array<int,array{0:string,1:string}> [подпись, значение]
     */
    public static function describe(array $lead): array
    {
        $format = '';
        if (isset($lead['format']) && $lead['format'] !== '') {
            $format = isset(self::FORMATS[$lead['format']]) ? self::FORMATS[$lead['format']] : $lead['format'];
            if ($lead['format'] === 'other' && $lead['format_custom'] !== '') {
                $format .= ': ' . $lead['format_custom'];
            }
        }
        $rows = [
            ['Имя', $lead['name']],
            ['Телефон', $lead['phone']],
            ['E-mail', $lead['email']],
            ['Компания', $lead['company']],
            ['Регион', $lead['region']],
            ['Формат', $format],
            ['Количество', $lead['quantity']],
            ['Комментарий', $lead['message']],
        ];
        $filled = [];
        foreach ($rows as $row) {
            if ((string) $row[1] !== '') {
                $filled[] = [$row[0], (string) $row[1]];
            }
        }
        return $filled;
    }

    /** «17.10.2026 18:30 (МСК)» из received_at. */
    public static function displayTime(string $receivedAt): string
    {
        try {
            $time = new DateTimeImmutable($receivedAt);
        } catch (Exception $e) {
            return $receivedAt;
        }
        return $time->setTimezone(new DateTimeZone('Europe/Moscow'))->format('d.m.Y H:i') . ' (МСК)';
    }

    /**
     * Нормализованная заявка для каналов.
     * @return array<string,string>
     */
    public function toLead(string $ip, DateTimeInterface $receivedAt): array
    {
        $lead = $this->fields;
        $lead['type_label'] = isset(self::TYPES[$lead['type']]) ? self::TYPES[$lead['type']] : $lead['type'];
        $moscow = new DateTimeImmutable('@' . $receivedAt->getTimestamp());
        $lead['received_at'] = $moscow->setTimezone(new DateTimeZone('Europe/Moscow'))->format(DATE_ATOM);
        $lead['ip'] = $ip;
        return $lead;
    }
}
