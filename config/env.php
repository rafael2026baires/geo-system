<?php

if (!function_exists('getenv_config')) {
    function getenv_config($key) {
        static $vars = null;

        if ($vars === null) {
            $vars = [];

            $path = __DIR__ . '/.env';
            if (file_exists($path)) {
                $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

                foreach ($lines as $line) {
                    if (strpos(trim($line), '#') === 0) continue;

                    list($k, $v) = explode('=', $line, 2);
                    $vars[trim($k)] = trim($v);
                }
            }
        }

        return $vars[$key] ?? null;
    }
}