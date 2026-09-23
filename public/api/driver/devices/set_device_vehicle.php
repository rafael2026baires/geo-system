<?php

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../../../services/WsCoreIdentityService.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.device.asignar_vehiculo');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 4
    || !property_exists($input, 'device_id')
    || !is_int($input->device_id)
    || $input->device_id <= 0
    || !property_exists($input, 'vehicle_id')
    || !is_int($input->vehicle_id)
    || $input->vehicle_id <= 0
    || !property_exists($input, 'current_vehicle_id')
    || ($input->current_vehicle_id !== null
        && (!is_int($input->current_vehicle_id) || $input->current_vehicle_id <= 0))
    || !property_exists($input, 'confirm')
    || $input->confirm !== true) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren device_id, vehicle_id, current_vehicle_id y confirm igual a true.');
}

$deviceId = $input->device_id;
$vehicleId = $input->vehicle_id;
$currentVehicleId = $input->current_vehicle_id;

if ($currentVehicleId !== null && $currentVehicleId === $vehicleId) {
    driver_error(409, 'ASSIGNMENT_UNCHANGED', 'El vehículo seleccionado ya está asociado al dispositivo.');
}

try {
    $pdo->beginTransaction();
    driver_expire_pending_activations($pdo, $tenantId);

    $deviceQuery = $pdo->prepare(
        'SELECT id, device_uuid, active FROM devices
         WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
    );
    $deviceQuery->execute([$deviceId, $tenantId]);
    $device = $deviceQuery->fetch(PDO::FETCH_ASSOC);
    if (!$device) {
        $pdo->rollBack();
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }
    $deviceUuid = trim((string)$device['device_uuid']);
    if ((int)$device['active'] !== 1 || $deviceUuid === '') {
        $pdo->rollBack();
        driver_error(409, 'DEVICE_NOT_AVAILABLE', 'El dispositivo no está disponible para asignación.');
    }

    $usedQuery = $pdo->prepare(
        "SELECT id FROM device_activations
         WHERE device_id = ? AND status = 'USED' LIMIT 1 FOR UPDATE"
    );
    $usedQuery->execute([$deviceId]);
    if ($usedQuery->fetchColumn() === false) {
        $pdo->rollBack();
        driver_error(409, 'DEVICE_NOT_ACTIVATED', 'El dispositivo no tiene una activación usada histórica.');
    }

    $pendingQuery = $pdo->prepare(
        "SELECT id FROM device_activations
         WHERE status = 'PENDING' AND expires_at > NOW()
           AND (device_id = ? OR replaces_device_id = ?)
         LIMIT 1 FOR UPDATE"
    );
    $pendingQuery->execute([$deviceId, $deviceId]);
    if ($pendingQuery->fetchColumn() !== false) {
        $pdo->rollBack();
        driver_error(409, 'DEVICE_PENDING_OPERATION', 'El dispositivo tiene una activación o reemplazo pendiente.');
    }

    $deviceLinksQuery = $pdo->prepare(
        'SELECT vehicle_id FROM vehicle_devices
         WHERE device_id = ? ORDER BY vehicle_id FOR UPDATE'
    );
    $deviceLinksQuery->execute([$deviceId]);
    $deviceLinks = $deviceLinksQuery->fetchAll(PDO::FETCH_ASSOC);
    if (count($deviceLinks) > 1) {
        $pdo->rollBack();
        driver_error(409, 'DEVICE_ASSOCIATION_CONFLICT', 'Las asociaciones actuales del dispositivo son inconsistentes.');
    }
    $actualVehicleId = $deviceLinks ? (int)$deviceLinks[0]['vehicle_id'] : null;
    if ($actualVehicleId !== $currentVehicleId) {
        $pdo->rollBack();
        driver_error(409, 'ASSIGNMENT_CHANGED', 'La asociación actual del dispositivo cambió.');
    }

    if ($actualVehicleId !== null) {
        $currentVehicleQuery = $pdo->prepare(
            'SELECT tenant_id FROM vehicles WHERE id = ? LIMIT 1 FOR UPDATE'
        );
        $currentVehicleQuery->execute([$actualVehicleId]);
        if ((int)$currentVehicleQuery->fetchColumn() !== $tenantId) {
            $pdo->rollBack();
            driver_error(409, 'DEVICE_ASSOCIATION_CONFLICT', 'La asociación actual no pertenece al tenant.');
        }
    }

    $vehicle = driver_find_enabled_vehicle($pdo, $vehicleId, $tenantId);
    if (!$vehicle) {
        $pdo->rollBack();
        driver_error(409, 'VEHICLE_NOT_AVAILABLE', 'El vehículo seleccionado no está disponible.');
    }

    $targetLinksQuery = $pdo->prepare(
        'SELECT device_id FROM vehicle_devices
         WHERE vehicle_id = ? ORDER BY device_id FOR UPDATE'
    );
    $targetLinksQuery->execute([$vehicleId]);
    $targetLinks = $targetLinksQuery->fetchAll(PDO::FETCH_ASSOC);
    if ($targetLinks) {
        $pdo->rollBack();
        driver_error(409, 'VEHICLE_ALREADY_ASSIGNED', 'El vehículo ya tiene un dispositivo asociado.');
    }

    $vehiclePendingQuery = $pdo->prepare(
        "SELECT a.id FROM device_activations a
         INNER JOIN devices d ON d.id = a.device_id
         WHERE a.vehicle_id = ? AND d.tenant_id = ?
           AND a.status = 'PENDING' AND a.expires_at > NOW()
         LIMIT 1 FOR UPDATE"
    );
    $vehiclePendingQuery->execute([$vehicleId, $tenantId]);
    if ($vehiclePendingQuery->fetchColumn() !== false) {
        $pdo->rollBack();
        driver_error(409, 'VEHICLE_PENDING_ACTIVATION', 'El vehículo tiene una activación pendiente.');
    }

    if ($currentVehicleId !== null) {
        $delete = $pdo->prepare(
            'DELETE FROM vehicle_devices WHERE vehicle_id = ? AND device_id = ?'
        );
        $delete->execute([$currentVehicleId, $deviceId]);
        if ($delete->rowCount() !== 1) {
            throw new RuntimeException('No se pudo retirar la asociación anterior.');
        }
    }

    $insert = $pdo->prepare(
        'INSERT INTO vehicle_devices (vehicle_id, device_id) VALUES (?, ?)'
    );
    $insert->execute([$vehicleId, $deviceId]);
    ws_core_queue_identity_sync($pdo, $deviceUuid);

    $pdo->commit();
    ws_core_process_identity_sync($pdo, $deviceUuid);

    driver_response(200, ['success' => true, 'data' => [
        'device_id' => $deviceId,
        'device_uuid' => $deviceUuid,
        'previous_vehicle_id' => $currentVehicleId,
        'vehicle_id' => $vehicleId
    ]]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo actualizar la asociación del dispositivo.');
}
