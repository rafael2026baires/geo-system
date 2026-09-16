<?php

require_once __DIR__ . '/../bootstrap.php';

function driver_response(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function driver_error(int $status, string $code, string $message): void
{
    driver_response($status, [
        'success' => false,
        'error' => ['code' => $code, 'message' => $message]
    ]);
}

function driver_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
    }
}

function driver_read_json(): object
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, false);

    if (!is_object($data) || json_last_error() !== JSON_ERROR_NONE) {
        driver_error(400, 'INVALID_JSON', 'Se requiere un objeto JSON válido.');
    }

    return $data;
}

function driver_session_tenant_id(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $tenantId = $_SESSION['tenant_id'] ?? null;
    $userId = $_SESSION['user_id'] ?? null;
    $role = $_SESSION['role'] ?? null;

    if (filter_var($tenantId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false
        || filter_var($userId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false
        || $role !== 'admin') {
        driver_error(401, 'UNAUTHORIZED', 'Sesión administrativa no válida.');
    }

    return (int)$tenantId;
}
