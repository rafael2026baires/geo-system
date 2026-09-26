<?php

declare(strict_types=1);

require_once __DIR__ . '/../../driver/bootstrap.php';
require_once __DIR__ . '/../../../../services/VehicleRegularDriverService.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('vehiculos.ver');

$vehicleIdRaw = $_GET['vehicle_id'] ?? null;
if (count($_GET) !== 1
    || filter_var($vehicleIdRaw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere vehicle_id válido.');
}

try {
    driver_response(200, [
        'success' => true,
        'data' => VehicleRegularDriverService::getDetail($pdo, $tenantId, (int)$vehicleIdRaw),
    ]);
} catch (VehicleRegularDriverException $e) {
    driver_error($e->httpStatus, $e->errorCode, $e->getMessage());
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo consultar el chofer habitual.');
}
