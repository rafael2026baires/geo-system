<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    driver_error(405, 'INVALID_REQUEST', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.regenerar');
$input = json_decode(file_get_contents('php://input'));

if (!is_object($input)
    || json_last_error() !== JSON_ERROR_NONE
    || count(get_object_vars($input)) !== 2
    || !property_exists($input, 'device_id')
    || !property_exists($input, 'confirm')
    || !is_int($input->device_id)
    || $input->device_id <= 0
    || $input->confirm !== true) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren device_id y confirm igual a true.');
}

$deviceId = $input->device_id;

try {
    $pdo->beginTransaction();

    $selectDevice = $pdo->prepare(
        'SELECT id, device_uuid, active FROM devices
         WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
    );
    $selectDevice->execute([$deviceId, $tenantId]);
    $device = $selectDevice->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        $pdo->rollBack();
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }

    if ((int)$device['active'] !== 1) {
        $pdo->rollBack();
        driver_error(403, 'DEVICE_DISABLED', 'El dispositivo está deshabilitado.');
    }

    $targetQuery = $pdo->prepare(
        'SELECT id, vehicle_id, driver_id, status, (expires_at <= NOW()) AS expired
         FROM device_activations WHERE device_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE'
    );
    $targetQuery->execute([$deviceId]);
    $targetActivation = $targetQuery->fetch(PDO::FETCH_ASSOC);
    if (!$targetActivation
        || ($targetActivation['status'] !== 'EXPIRED'
            && !($targetActivation['status'] === 'PENDING' && (int)$targetActivation['expired'] === 1))) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_NOT_EXPIRED', 'La activación actual no está vencida.');
    }

    $vehicleId = (int)$targetActivation['vehicle_id'];
    $driverId = $targetActivation['driver_id'] === null ? null : (int)$targetActivation['driver_id'];
    if ($vehicleId <= 0 || !driver_find_enabled_vehicle($pdo, $vehicleId, $tenantId)) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'La activación no tiene un vehículo objetivo válido.');
    }

    $expirePrevious = $pdo->prepare(
        "UPDATE device_activations SET status = 'EXPIRED'
         WHERE id = ? AND status = 'PENDING'"
    );
    $expirePrevious->execute([$targetActivation['id']]);

    $activationCode = driver_generate_activation_code($pdo);
    $expiresAt = (new DateTimeImmutable('now'))->modify('+7 days')->format('Y-m-d H:i:s');

    $insertActivation = $pdo->prepare(
        'INSERT INTO device_activations
         (device_id, vehicle_id, driver_id, activation_code, status, expires_at,
          delivery_started_at, sent_at, used_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)'
    );
    $insertActivation->execute([$deviceId, $vehicleId, $driverId, $activationCode, 'PENDING', $expiresAt]);
    $activationId = (int)$pdo->lastInsertId();

    $pdo->commit();

    driver_response(200, [
        'success' => true,
        'data' => [
            'device_id' => $deviceId,
            'device_uuid' => $device['device_uuid'],
            'vehicle_id' => $vehicleId,
            'activation_id' => $activationId,
            'activation_code' => $activationCode,
            'activation_status' => 'PENDING',
            'administrative_status' => 'PENDING_SEND',
            'expires_at' => $expiresAt
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo regenerar la activación.');
}
