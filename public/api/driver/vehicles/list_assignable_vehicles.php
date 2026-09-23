<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.device.asignar_vehiculo');

if (count($_GET) !== 1 || !array_key_exists('device_id', $_GET)) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere únicamente device_id.');
}

$deviceId = filter_var($_GET['device_id'], FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);
if ($deviceId === false) {
    driver_error(400, 'INVALID_REQUEST', 'device_id debe ser un entero positivo.');
}

try {
    driver_expire_pending_activations($pdo, $tenantId);

    $deviceQuery = $pdo->prepare(
        'SELECT id, device_uuid, active FROM devices WHERE id = ? AND tenant_id = ? LIMIT 1'
    );
    $deviceQuery->execute([$deviceId, $tenantId]);
    $device = $deviceQuery->fetch(PDO::FETCH_ASSOC);
    if (!$device) {
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }
    if ((int)$device['active'] !== 1 || trim((string)$device['device_uuid']) === '') {
        driver_error(409, 'DEVICE_NOT_AVAILABLE', 'El dispositivo no está disponible para asignación.');
    }

    $usedQuery = $pdo->prepare(
        "SELECT id FROM device_activations WHERE device_id = ? AND status = 'USED' LIMIT 1"
    );
    $usedQuery->execute([$deviceId]);
    if ($usedQuery->fetchColumn() === false) {
        driver_error(409, 'DEVICE_NOT_ACTIVATED', 'El dispositivo no tiene una activación usada histórica.');
    }

    $pendingQuery = $pdo->prepare(
        "SELECT id FROM device_activations
         WHERE status = 'PENDING' AND expires_at > NOW()
           AND (device_id = ? OR replaces_device_id = ?)
         LIMIT 1"
    );
    $pendingQuery->execute([$deviceId, $deviceId]);
    if ($pendingQuery->fetchColumn() !== false) {
        driver_error(409, 'DEVICE_PENDING_OPERATION', 'El dispositivo tiene una activación o reemplazo pendiente.');
    }

    $linksQuery = $pdo->prepare(
        'SELECT vd.vehicle_id, v.tenant_id
         FROM vehicle_devices vd
         LEFT JOIN vehicles v ON v.id = vd.vehicle_id
         WHERE vd.device_id = ? ORDER BY vd.vehicle_id'
    );
    $linksQuery->execute([$deviceId]);
    $links = $linksQuery->fetchAll(PDO::FETCH_ASSOC);
    if (count($links) > 1
        || ($links && (int)$links[0]['tenant_id'] !== $tenantId)) {
        driver_error(409, 'DEVICE_ASSOCIATION_CONFLICT', 'Las asociaciones actuales del dispositivo son inconsistentes.');
    }
    $currentVehicleId = $links ? (int)$links[0]['vehicle_id'] : null;

    $vehiclesQuery = $pdo->prepare(
        "SELECT v.id, v.guy, v.brand, v.model, v.patent
         FROM vehicles v
         WHERE v.tenant_id = ? AND v.enabled = 1
           AND (? IS NULL OR v.id <> ?)
           AND NOT EXISTS (
               SELECT 1 FROM vehicle_devices occupied_vd WHERE occupied_vd.vehicle_id = v.id
           )
           AND NOT EXISTS (
               SELECT 1 FROM device_activations pending_a
               INNER JOIN devices pending_d ON pending_d.id = pending_a.device_id
               WHERE pending_a.vehicle_id = v.id
                 AND pending_a.status = 'PENDING' AND pending_a.expires_at > NOW()
                 AND pending_d.tenant_id = v.tenant_id
           )
         ORDER BY v.id"
    );
    $vehiclesQuery->execute([$tenantId, $currentVehicleId, $currentVehicleId]);
    $vehicles = $vehiclesQuery->fetchAll(PDO::FETCH_ASSOC);
    foreach ($vehicles as &$vehicle) {
        $vehicle['id'] = (int)$vehicle['id'];
    }
    unset($vehicle);

    driver_response(200, ['success' => true, 'data' => $vehicles]);
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo cargar el catálogo de vehículos asignables.');
}
