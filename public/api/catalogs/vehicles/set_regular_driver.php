<?php

declare(strict_types=1);

require_once __DIR__ . '/../../driver/bootstrap.php';
require_once __DIR__ . '/../../../../services/VehicleRegularDriverService.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('vehiculos.chofer_habitual.gestionar');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 2
    || !property_exists($input, 'vehicle_id')
    || !is_int($input->vehicle_id)
    || $input->vehicle_id <= 0
    || !property_exists($input, 'driver_id')
    || !is_int($input->driver_id)
    || $input->driver_id <= 0) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren vehicle_id y driver_id válidos.');
}

try {
    driver_response(200, [
        'success' => true,
        'data' => VehicleRegularDriverService::set(
            $pdo,
            $tenantId,
            $input->vehicle_id,
            $input->driver_id
        ),
    ]);
} catch (VehicleRegularDriverException $e) {
    driver_error($e->httpStatus, $e->errorCode, $e->getMessage());
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo guardar el chofer habitual.');
}
