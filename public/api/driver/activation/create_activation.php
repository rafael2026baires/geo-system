<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.crear');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 1
    || !property_exists($input, 'vehicle_id')
    || !is_int($input->vehicle_id)
    || $input->vehicle_id <= 0) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere un vehicle_id entero positivo.');
}

try {
    $pdo->beginTransaction();

    if (!driver_find_enabled_vehicle($pdo, $input->vehicle_id, $tenantId)) {
        $pdo->rollBack();
        driver_error(404, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado o no habilitado.');
    }

    $result = driver_create_activation_for_vehicle($pdo, $tenantId, $input->vehicle_id);

    $pdo->commit();

    driver_response(201, [
        'success' => true,
        'data' => $result
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo crear la activación.');
}
