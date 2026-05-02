<?php

if (!function_exists('getEnv')) {
    function getEnv() {
        return (strpos($_SERVER['HTTP_HOST'] ?? '', 'geo.local') !== false)
            ? 'local'
            : 'prod';
    }
}