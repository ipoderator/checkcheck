<?php
if (!defined('VSECHEKI_APP')) {
    http_response_code(404);
    exit;
}

/**
 * Страница-ответ для формы без JavaScript: браузер отправил форму обычным POST
 * и ждёт HTML, а не JSON. Итог тот же, что в JSON-ответе (interfaces.md, контракт lead.php),
 * плюс ссылка «Вернуться к форме». Все значения экранируются.
 */
final class LeadPage
{
    const PHONE_HTML = '<a class="link" href="tel:+79202431957">8&nbsp;920&nbsp;243-19-57</a>';
    const EMAIL_HTML = '<a class="link" href="mailto:ipoderator@yandex.ru">ipoderator@yandex.ru</a>';

    const LABELS = [
        'type' => 'Тип заявки',
        'name' => 'Имя',
        'phone' => 'Телефон',
        'email' => 'E-mail',
        'company' => 'Компания',
        'region' => 'Регион',
        'format' => 'Формат',
        'format_custom' => 'Нужный размер',
        'quantity' => 'Количество',
        'message' => 'Комментарий',
        'consent' => 'Согласие',
    ];

    /** @param array<string,mixed> $body тело JSON-ответа LeadService */
    public static function render(int $status, array $body): string
    {
        $code = isset($body['code']) && is_string($body['code']) ? $body['code'] : '';
        if (!empty($body['ok'])) {
            $code = 'ok';
        }
        $back = '<a class="btn btn--accent btn--large" href="../#order">Вернуться к&nbsp;форме</a>';
        $home = '<a class="btn btn--ghost btn--large" href="../">На&nbsp;главную</a>';
        $call = '<p class="lead-result__contacts">Позвоните ' . self::PHONE_HTML . ' или&nbsp;напишите на&nbsp;' . self::EMAIL_HTML . '.</p>';
        $keep = '<p class="lead-result__text">Чтобы не&nbsp;набирать заново, нажмите в&nbsp;браузере «Назад»: введённое обычно сохраняется.</p>';

        $details = '';
        switch ($code) {
            case 'ok':
                $kicker = 'Заявка принята';
                $title = 'Спасибо! Заявка у&nbsp;нас';
                $details = '<p class="lead-result__text">Мы&nbsp;свяжемся с&nbsp;вами по&nbsp;телефону, который вы&nbsp;указали. Если вопрос срочный&nbsp;— звоните: ' . self::PHONE_HTML . '.</p>';
                $actions = $back . $home;
                $call = '';
                break;
            case 'validation':
                $kicker = 'Заявка не&nbsp;отправлена';
                $title = 'Проверьте поля заявки';
                $items = '';
                $errors = isset($body['errors']) && is_array($body['errors']) ? $body['errors'] : [];
                foreach ($errors as $field => $message) {
                    $label = isset(self::LABELS[$field]) ? self::LABELS[$field] : (string) $field;
                    $items .= '<li><strong>' . self::e($label) . ':</strong> ' . self::e((string) $message) . '</li>';
                }
                $details = '<ul class="lead-result__errors">' . $items . '</ul>' . $keep;
                $actions = $back;
                $call = '';
                break;
            case 'not_configured':
                $kicker = 'Заявка не&nbsp;отправлена';
                $title = 'Форма пока не&nbsp;подключена';
                $details = '<p class="lead-result__text">Заявку сейчас нельзя отправить через сайт.</p>';
                $actions = $back . $home;
                break;
            case 'rate_limited':
                $kicker = 'Заявка не&nbsp;отправлена';
                $title = 'Слишком много заявок подряд';
                $details = '<p class="lead-result__text">Подождите 10&nbsp;минут и&nbsp;отправьте снова.</p>' . $keep;
                $actions = $back;
                break;
            case 'bad_request':
            case 'method_not_allowed':
                $kicker = 'Заявка не&nbsp;отправлена';
                $title = 'Заявку отправляют через форму на&nbsp;сайте';
                $actions = $back;
                break;
            default:
                $kicker = 'Заявка не&nbsp;отправлена';
                $title = 'Не&nbsp;удалось доставить заявку';
                $details = '<p class="lead-result__text">Попробуйте отправить ещё раз чуть позже.</p>' . $keep;
                $actions = $back;
                break;
        }

        return '<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>' . strip_tags(str_replace('&nbsp;', ' ', $title)) . ' — ВсеЧеки</title>
  <meta name="theme-color" content="#F7F6F2">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../assets/css/main.css">
</head>
<body class="doc-page">
  <a class="skip-link" href="#main">Перейти к&nbsp;содержимому</a>
  <header class="site-header">
    <div class="frame site-header__inner">
      <a class="logo" href="../" aria-label="ВсеЧеки — на главную"><span class="logo__word">ВсеЧеки</span></a>
    </div>
  </header>
  <main id="main" class="lead-result" data-status="' . (int) $status . '">
    <div class="frame lead-result__body">
      <p class="section-head__num">' . $kicker . '</p>
      <h1 class="lead-result__title">' . $title . '</h1>
      ' . $details . '
      ' . $call . '
      <div class="not-found__actions">' . $actions . '</div>
    </div>
  </main>
</body>
</html>
';
    }

    private static function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
