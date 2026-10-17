<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/** Строковые функции для UTF-8 с запасным путём, если нет mbstring. */
final class Text
{
    /** Приводит строку к корректному UTF-8 (некорректные байты выбрасываются). */
    public static function utf8(string $value): string
    {
        if ($value === '' || preg_match('//u', $value) === 1) {
            return $value;
        }
        if (function_exists('mb_convert_encoding')) {
            $prev = function_exists('mb_substitute_character') ? mb_substitute_character() : null;
            if ($prev !== null) {
                mb_substitute_character('none');
            }
            $clean = (string) mb_convert_encoding($value, 'UTF-8', 'UTF-8');
            if ($prev !== null) {
                mb_substitute_character($prev);
            }
            if (preg_match('//u', $clean) === 1) {
                return $clean;
            }
        }
        if (function_exists('iconv')) {
            $clean = @iconv('UTF-8', 'UTF-8//IGNORE', $value);
            if (is_string($clean) && preg_match('//u', $clean) === 1) {
                return $clean;
            }
        }
        // Последний путь: оставить только ASCII.
        return (string) preg_replace('/[\x80-\xFF]/', '', $value);
    }

    public static function length(string $value): int
    {
        if (function_exists('mb_strlen')) {
            return (int) mb_strlen($value, 'UTF-8');
        }
        $count = preg_match_all('/./su', $value);
        return $count === false ? strlen($value) : $count;
    }

    public static function cut(string $value, int $max): string
    {
        if (self::length($value) <= $max) {
            return $value;
        }
        if (function_exists('mb_substr')) {
            return (string) mb_substr($value, 0, $max, 'UTF-8');
        }
        $chars = self::chars($value);
        return implode('', array_slice($chars, 0, $max));
    }

    /** @return string[] символы строки */
    public static function chars(string $value): array
    {
        if ($value === '') {
            return [];
        }
        $chars = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
        return is_array($chars) ? $chars : str_split($value);
    }

    /**
     * Обрезка краёв как у String.prototype.trim() в браузере: ASCII-пробелы, неразрывный
     * и прочие Unicode-пробелы (\p{Z}), U+FEFF. Иначе имя из двух U+00A0 прошло бы проверку.
     */
    public static function trim(string $value): string
    {
        $trimmed = preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
        return $trimmed === null ? trim($value) : $trimmed;
    }

    /** Однострочное значение: управляющие символы и переводы строк → пробел, края обрезаны. */
    public static function line(string $value): string
    {
        $value = self::utf8($value);
        $value = (string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);
        return self::trim($value);
    }

    /** Многострочный текст: переводы строк сохраняются как \n, прочие управляющие символы удаляются. */
    public static function multiline(string $value): string
    {
        $value = self::utf8($value);
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $value = (string) preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $value);
        return self::trim($value);
    }
}
