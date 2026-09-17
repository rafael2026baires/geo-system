<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    driver_error(405, 'INVALID_REQUEST', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
$input = json_decode(file_get_contents('php://input'));

if (!is_object($input)
    || json_last_error() !== JSON_ERROR_NONE
    || count(get_object_vars($input)) !== 3
    || !property_exists($input, 'device_id')
    || !property_exists($input, 'enabled')
    || !property_exists($input, 'confirm')
    || !is_int($input->device_id)
    || $input->device_id <= 0
    || !is_bool($input->enabled)
    || $input->confirm !== true) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren device_id, enabled y confirm igual a true.');
}

$deviceId = $input->device_id;
$enabled = $input->enabled;
driver_require_permission($enabled ? 'driver.device.habilitar' : 'driver.device.deshabilitar');

try {
    $pdo->beginTransaction();

    $selectDevice = $pdo->prepare(
        'SELECT active FROM devices WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
    );
    $selectDevice->execute([$deviceId, $tenantId]);
    $device = $selectDevice->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        $pdo->rollBack();
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }

    if ((int)$device['active'] !== (int)$enabled) {
        $updateDevice = $pdo->prepare(
            'UPDATE devices SET active = ? WHERE id = ? AND tenant_id = ?'
        );
        $updateDevice->execute([(int)$enabled, $deviceId, $tenantId]);
    }

    $pdo->commit();

    driver_response(200, [
        'success' => true,
        'data' => [
            'device_id' => $deviceId,
            'enabled' => $enabled
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo actualizar el dispositivo.');
}
