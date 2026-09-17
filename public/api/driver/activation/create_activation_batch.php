<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.crear');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 1
    || !property_exists($input, 'items')
    || !is_array($input->items)
    || count($input->items) === 0) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere una lista no vacía de items.');
}

$vehicleIds = [];
foreach ($input->items as $item) {
    if (!is_object($item)
        || count(get_object_vars($item)) !== 1
        || !property_exists($item, 'vehicle_id')
        || !is_int($item->vehicle_id)
        || $item->vehicle_id <= 0
        || isset($vehicleIds[$item->vehicle_id])) {
        driver_error(400, 'INVALID_REQUEST', 'Cada item requiere un vehicle_id único y positivo.');
    }
    $vehicleIds[$item->vehicle_id] = true;
}

try {
    $pdo->beginTransaction();

    // Bloquear todos los vehículos antes del primer INSERT y en orden estable.
    $sortedIds = array_keys($vehicleIds);
    sort($sortedIds, SORT_NUMERIC);
    foreach ($sortedIds as $vehicleId) {
        if (!driver_find_enabled_vehicle($pdo, $vehicleId, $tenantId)) {
            $pdo->rollBack();
            driver_error(404, 'VEHICLE_NOT_FOUND', 'Un vehículo no existe o no está habilitado.');
        }
    }

    $results = [];
    foreach ($input->items as $item) {
        $results[] = driver_create_activation_for_vehicle($pdo, $tenantId, $item->vehicle_id);
    }

    $pdo->commit();
    driver_response(201, ['success' => true, 'data' => ['items' => $results]]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo crear el lote de activaciones.');
}
