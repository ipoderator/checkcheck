<?php
// Роутер встроенного сервера для `npm run dev` (php -S … -t public tools/dev-router.php).
// На хостинге app/ и storage/ закрывает .htaccess, но php -S его не читает —
// здесь те же запреты: 403 на библиотеку, хранилище и скрытые файлы. Остальное отдаёт сам php -S.

// Не parse_url: в «//app/…» он принял бы «app» за имя хоста.
$uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/';
$path = rawurldecode(explode('?', $uri, 2)[0]);
$segments = [];
foreach (explode('/', str_replace('\\', '/', $path)) as $segment) {
    if ($segment === '' || $segment === '.') {
        continue;
    }
    if ($segment === '..') {
        array_pop($segments);
        continue;
    }
    $segments[] = $segment;
}

// На macOS файловая система не различает регистр: /App/ — та же папка.
$first = isset($segments[0]) ? strtolower($segments[0]) : '';
$hidden = false;
foreach ($segments as $segment) {
    if ($segment[0] === '.') {
        $hidden = true;
    }
}

if ($first === 'app' || $first === 'storage' || $hidden) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "403 Доступ запрещён\n";
    return true;
}

return false;
