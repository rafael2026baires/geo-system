<?php

function admin_asset(string $path): string
{
    $path = '/' . ltrim($path, '/');
    $file = dirname(__DIR__, 2) . $path;

    if (!is_file($file)) {
        return $path;
    }

    return $path . '?v=' . filemtime($file);
}