<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.crear');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 2
    || !property_exists($input, 'vehicle_id')
    || !is_int($input->vehicle_id)
    || $input->vehicle_id <= 0
    || !property_exists($input, 'driver_id')
    || !is_int($input->driver_id)
    || $input->driver_id <= 0) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren vehicle_id y driver_id enteros positivos.');
}

try {
    $pdo->beginTransaction();

    if (!driver_find_enabled_vehicle($pdo, $input->vehicle_id, $tenantId)) {
        $pdo->rollBack();
        driver_error(404, 'VEHICLE_NOT_FOUND', 'Vehículo no encontrado o no habilitado.');
    }
    if (driver_vehicle_has_current_activation($pdo, $input->vehicle_id, $tenantId)) {
        $pdo->rollBack();
        driver_error(409, 'VEHICLE_UNAVAILABLE', 'El vehículo ya participa en una activación actual.');
    }

    $driverQuery = $pdo->prepare('SELECT id FROM drivers WHERE id = ? AND tenant_id = ? AND active = 1 LIMIT 1');
    $driverQuery->execute([$input->driver_id, $tenantId]);
    if (!$driverQuery->fetchColumn()) {
        $pdo->rollBack();
        driver_error(404, 'DRIVER_NOT_FOUND', 'Destinatario no encontrado o no activo.');
    }

    $result = driver_create_activation_for_vehicle($pdo, $tenantId, $input->vehicle_id, $input->driver_id);

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
