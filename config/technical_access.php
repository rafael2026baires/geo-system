<?php

function require_local_technical_access(bool $allowCli = true): void
{
    if ($allowCli && PHP_SAPI === 'cli') {
        return;
    }

    $remoteAddress = $_SERVER['REMOTE_ADDR'] ?? '';
    if (in_array($remoteAddress, ['127.0.0.1', '::1'], true)) {
        return;
    }

    $hostHeader = strtolower(trim($_SERVER['HTTP_HOST'] ?? ''));
    if (str_starts_with($hostHeader, '[')) {
        $closingBracket = strpos($hostHeader, ']');
        $host = $closingBracket === false ? $hostHeader : substr($hostHeader, 1, $closingBracket - 1);
    } else {
        $host = explode(':', $hostHeader, 2)[0];
    }
    $host = rtrim($host, '.');

    $localHost = in_array($host, ['localhost', '127.0.0.1', '::1', 'geo.local'], true)
        || str_ends_with($host, '.localhost');
    $localNetwork = filter_var(
        $remoteAddress,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) === false;

    if ($localHost && $remoteAddress !== '' && $localNetwork) {
        return;
    }

    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => 'TECHNICAL_ENDPOINT_LOCAL_ONLY'
    ]);
    exit;
}
