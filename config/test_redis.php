<?php

require_once __DIR__ . '/redis.php';

$r = getRedis();

if (!$r) {
    echo 'ERROR: no conecta a Redis';
    exit;
}

// test simple
$r->set('test_key', 'ok');
$value = $r->get('test_key');

echo 'Resultado: ' . $value;