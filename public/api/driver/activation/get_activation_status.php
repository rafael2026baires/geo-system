<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'INVALID_REQUEST', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();

if (count($_GET) !== 1 || !array_key_exists('device_id', $_GET)) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere únicamente device_id.');
}

$deviceId = filter_var(
    $_GET['device_id'],
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if ($deviceId === false) {
    driver_error(400, 'INVALID_REQUEST', 'device_id debe ser un entero positivo.');
}

try {
    $deviceQuery = $pdo->prepare(
        'SELECT id, device_uuid, active, brand, model, app_version
         FROM devices WHERE id = ? AND tenant_id = ? LIMIT 1'
    );
    $deviceQuery->execute([$deviceId, $tenantId]);
    $device = $deviceQuery->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }

    $activationQuery = $pdo->prepare(
        'SELECT id, activation_code, status, expires_at, sent_at, used_at,
                (expires_at <= NOW()) AS expired
         FROM device_activations
         WHERE device_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1'
    );
    $activationQuery->execute([$deviceId]);
    $row = $activationQuery->fetch(PDO::FETCH_ASSOC);

    $activation = null;
    $administrativeStatus = 'NO_ACTIVATION';

    if ($row) {
        $status = $row['status'];
        if ($status === 'PENDING' && (int)$row['expired'] === 1) {
            $status = 'EXPIRED';
        }

        if ($status === 'EXPIRED') {
            $administrativeStatus = 'EXPIRED';
        } elseif ($status === 'USED') {
            $administrativeStatus = 'ACTIVATED';
        } elseif ($status === 'PENDING') {
            $administrativeStatus = $row['sent_at'] === null
                ? 'PENDING_SEND'
                : 'SENT_PENDING_ACTIVATION';
        } else {
            throw new RuntimeException('Estado de activación desconocido.');
        }

        $activation = [
            'activation_id' => (int)$row['id'],
            'activation_code' => $row['activation_code'],
            'status' => $status,
            'administrative_status' => $administrativeStatus,
            'expires_at' => $row['expires_at'],
            'sent_at' => $row['sent_at'],
            'used_at' => $row['used_at']
        ];
    }

    driver_response(200, [
        'success' => true,
        'data' => [
            'device_id' => (int)$device['id'],
            'device_uuid' => $device['device_uuid'],
            'enabled' => (int)$device['active'] === 1,
            'brand' => $device['brand'],
            'model' => $device['model'],
            'app_version' => $device['app_version'],
            'activation' => $activation,
            'administrative_status' => $administrativeStatus
        ]
    ]);
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo consultar la activación.');
}
