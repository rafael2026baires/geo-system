<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.reactivar');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 2
    || !property_exists($input, 'device_id')
    || !is_int($input->device_id)
    || $input->device_id <= 0
    || !property_exists($input, 'confirm')
    || $input->confirm !== true) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren device_id y confirm igual a true.');
}

try {
    $pdo->beginTransaction();

    $selectDevice = $pdo->prepare(
        'SELECT id, device_uuid, active FROM devices
         WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
    );
    $selectDevice->execute([$input->device_id, $tenantId]);
    $device = $selectDevice->fetch(PDO::FETCH_ASSOC);
    if (!$device) {
        $pdo->rollBack();
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }
    if ((int)$device['active'] !== 1) {
        $pdo->rollBack();
        driver_error(403, 'DEVICE_DISABLED', 'El dispositivo está deshabilitado.');
    }

    $latestUsedQuery = $pdo->prepare(
        'SELECT id, vehicle_id, driver_id, status FROM device_activations
         WHERE device_id = ? AND status = \'USED\'
         ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE'
    );
    $latestUsedQuery->execute([$input->device_id]);
    $latestUsed = $latestUsedQuery->fetch(PDO::FETCH_ASSOC);
    if (!$latestUsed) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'El dispositivo no tiene una activación usada válida.');
    }

    $pendingQuery = $pdo->prepare(
        "SELECT id FROM device_activations
         WHERE device_id = ? AND status = 'PENDING' AND expires_at > NOW()
         LIMIT 1 FOR UPDATE"
    );
    $pendingQuery->execute([$input->device_id]);
    if ($pendingQuery->fetchColumn() !== false) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'El dispositivo ya tiene una activación pendiente vigente.');
    }

    $links = $pdo->prepare('SELECT vehicle_id FROM vehicle_devices WHERE device_id = ? FOR UPDATE');
    $links->execute([$input->device_id]);
    $vehicleIds = $links->fetchAll(PDO::FETCH_COLUMN);
    if (count($vehicleIds) !== 1 || (int)$vehicleIds[0] !== (int)$latestUsed['vehicle_id']) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'La asociación efectiva del dispositivo no coincide con la última activación.');
    }

    $vehicleId = (int)$latestUsed['vehicle_id'];
    $driverId = $latestUsed['driver_id'] === null ? null : (int)$latestUsed['driver_id'];
    if (!$vehicleId || !driver_find_enabled_vehicle($pdo, $vehicleId, $tenantId)) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'El vehículo asociado no está disponible.');
    }
    if (!$driverId) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'La última activación no tiene un destinatario válido.');
    }
    $driverQuery = $pdo->prepare(
        'SELECT id FROM drivers WHERE id = ? AND tenant_id = ? AND active = 1 LIMIT 1'
    );
    $driverQuery->execute([$driverId, $tenantId]);
    if (!$driverQuery->fetchColumn()) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'El destinatario de la última activación no está disponible.');
    }

    $activationCode = driver_generate_activation_code($pdo);
    $expiresAt = (new DateTimeImmutable('now'))->modify('+7 days')->format('Y-m-d H:i:s');
    $insert = $pdo->prepare(
        'INSERT INTO device_activations
         (device_id, vehicle_id, driver_id, activation_code, status, expires_at,
          delivery_started_at, sent_at, used_at, cancelled_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)'
    );
    $insert->execute([$input->device_id, $vehicleId, $driverId, $activationCode, 'PENDING', $expiresAt]);
    $activationId = (int)$pdo->lastInsertId();
    $pdo->commit();

    driver_response(201, ['success' => true, 'data' => [
        'device_id' => $input->device_id,
        'device_uuid' => $device['device_uuid'],
        'vehicle_id' => $vehicleId,
        'driver_id' => $driverId,
        'activation_id' => $activationId,
        'activation_code' => $activationCode,
        'activation_status' => 'PENDING',
        'administrative_status' => 'PENDING_SEND',
        'expires_at' => $expiresAt
    ]]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo reactivar el dispositivo.');
}
