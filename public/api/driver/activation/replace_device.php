<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.reemplazar');
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
    driver_expire_pending_activations($pdo, $tenantId);

    $oldDeviceQuery = $pdo->prepare(
        'SELECT id, device_uuid, active FROM devices
         WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
    );
    $oldDeviceQuery->execute([$input->device_id, $tenantId]);
    $oldDevice = $oldDeviceQuery->fetch(PDO::FETCH_ASSOC);
    if (!$oldDevice) {
        $pdo->rollBack();
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }
    if ((int)$oldDevice['active'] !== 1) {
        $pdo->rollBack();
        driver_error(403, 'DEVICE_DISABLED', 'El dispositivo está deshabilitado.');
    }

    $latestQuery = $pdo->prepare(
        'SELECT id, vehicle_id, driver_id, status FROM device_activations
         WHERE device_id = ? ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE'
    );
    $latestQuery->execute([$input->device_id]);
    $latest = $latestQuery->fetch(PDO::FETCH_ASSOC);
    if (!$latest || $latest['status'] !== 'USED') {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'El dispositivo no tiene una activación usada como última activación.');
    }

    $replacementQuery = $pdo->prepare(
        "SELECT id FROM device_activations
         WHERE replaces_device_id = ? AND status = 'PENDING' AND expires_at > NOW()
         LIMIT 1 FOR UPDATE"
    );
    $replacementQuery->execute([$input->device_id]);
    if ($replacementQuery->fetchColumn() !== false) {
        $pdo->rollBack();
        driver_error(409, 'REPLACEMENT_ALREADY_PENDING', 'El dispositivo ya tiene un reemplazo pendiente.');
    }

    $links = $pdo->prepare('SELECT vehicle_id FROM vehicle_devices WHERE device_id = ? FOR UPDATE');
    $links->execute([$input->device_id]);
    $vehicleIds = $links->fetchAll(PDO::FETCH_COLUMN);
    if (count($vehicleIds) !== 1 || (int)$vehicleIds[0] !== (int)$latest['vehicle_id']) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'La asociación efectiva no coincide con la última activación.');
    }

    $vehicleId = (int)$latest['vehicle_id'];
    $driverId = $latest['driver_id'] === null ? null : (int)$latest['driver_id'];
    if (!driver_find_enabled_vehicle($pdo, $vehicleId, $tenantId)) {
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

    $deviceUuid = driver_generate_device_uuid($pdo);
    $activationCode = driver_generate_activation_code($pdo);
    $expiresAt = (new DateTimeImmutable('now'))->modify('+7 days')->format('Y-m-d H:i:s');

    $insertDevice = $pdo->prepare(
        'INSERT INTO devices (tenant_id, device_uuid, model, brand, app_version, active)
         VALUES (?, ?, NULL, NULL, NULL, 1)'
    );
    $insertDevice->execute([$tenantId, $deviceUuid]);
    $newDeviceId = (int)$pdo->lastInsertId();
    if ($newDeviceId > 2147483647) {
        $pdo->rollBack();
        driver_error(409, 'DEVICE_ID_UNSUPPORTED', 'No se pudo crear un dispositivo compatible con las asociaciones actuales.');
    }

    $insertActivation = $pdo->prepare(
        'INSERT INTO device_activations
         (device_id, vehicle_id, driver_id, replaces_device_id, activation_code, status,
          expires_at, delivery_started_at, sent_at, used_at, cancelled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)'
    );
    $insertActivation->execute([
        $newDeviceId, $vehicleId, $driverId, $input->device_id,
        $activationCode, 'PENDING', $expiresAt
    ]);
    $activationId = (int)$pdo->lastInsertId();
    $pdo->commit();

    driver_response(201, ['success' => true, 'data' => [
        'device_id' => $newDeviceId,
        'device_uuid' => $deviceUuid,
        'replaces_device_id' => $input->device_id,
        'replaces_device_uuid' => $oldDevice['device_uuid'],
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
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo iniciar el reemplazo.');
}
