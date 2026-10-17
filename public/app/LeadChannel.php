<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Канал доставки заявки (Telegram, e-mail).
 * $lead — нормализованная заявка, см. LeadRequest::toLead().
 */
interface LeadChannel
{
    public function name(): string;

    public function isConfigured(): bool;

    /** @throws RuntimeException если доставить не удалось */
    public function send(array $lead): void;
}
