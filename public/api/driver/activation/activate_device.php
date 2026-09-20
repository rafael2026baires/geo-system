<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    driver_error(405, 'INVALID_REQUEST', 'Método no permitido.');
}

$input = json_decode(file_get_contents('php://input'));
$fields = ['activation_code', 'brand', 'model', 'app_version'];

if (!is_object($input)
    || json_last_error() !== JSON_ERROR_NONE
    || count(get_object_vars($input)) !== count($fields)) {
    driver_error(400, 'INVALID_REQUEST', 'Se requieren los cuatro campos indicados.');
}

foreach ($fields as $field) {
    if (!property_exists($input, $field) || !is_string($input->$field)) {
        driver_error(400, 'INVALID_REQUEST', 'Los campos deben ser textos no vacíos.');
    }
    $input->$field = trim($input->$field);
    if ($input->$field === '') {
        driver_error(400, 'INVALID_REQUEST', 'Los campos deben ser textos no vacíos.');
    }
}

$activationCode = strtoupper($input->activation_code);

foreach (['brand' => 100, 'model' => 100, 'app_version' => 50] as $field => $limit) {
    if (preg_match_all('/./us', $input->$field) > $limit) {
        driver_error(400, 'INVALID_REQUEST', 'Un campo supera la longitud permitida.');
    }
}

try {
    $pdo->beginTransaction();

    $select = $pdo->prepare(
        'SELECT a.id, a.vehicle_id, a.status, (a.expires_at <= NOW()) AS expired,
                d.id AS device_id, d.device_uuid, d.active, d.tenant_id
         FROM device_activations a
         INNER JOIN devices d ON d.id = a.device_id
         WHERE a.activation_code = ?
         LIMIT 1 FOR UPDATE'
    );
    $select->execute([$activationCode]);
    $activation = $select->fetch(PDO::FETCH_ASSOC);

    if (!$activation) {
        $pdo->rollBack();
        driver_error(404, 'ACTIVATION_CODE_INVALID', 'Código de activación inválido.');
    }

    if ($activation['status'] === 'CANCELLED') {
        $pdo->rollBack();
        driver_error(410, 'ACTIVATION_CANCELLED', 'La activación fue cancelada.');
    }

    if ((int)$activation['active'] !== 1) {
        $pdo->rollBack();
        driver_error(403, 'DEVICE_DISABLED', 'El dispositivo está deshabilitado.');
    }

    if ($activation['status'] === 'EXPIRED') {
        $pdo->rollBack();
        driver_error(410, 'ACTIVATION_EXPIRED', 'La activación está vencida.');
    }

    if ($activation['status'] === 'USED') {
        $usedLinks = $pdo->prepare(
            'SELECT vehicle_id FROM vehicle_devices WHERE device_id = ? FOR UPDATE'
        );
        $usedLinks->execute([$activation['device_id']]);
        $linkedVehicleIds = $usedLinks->fetchAll(PDO::FETCH_COLUMN);
        if (count($linkedVehicleIds) !== 1
            || (int)$linkedVehicleIds[0] !== (int)$activation['vehicle_id']) {
            $pdo->rollBack();
            driver_error(409, 'ACTIVATION_CONFLICT', 'La activación no tiene el vínculo esperado.');
        }
        $pdo->commit();
        driver_response(200, [
            'success' => true,
            'data' => [
                'device_uuid' => $activation['device_uuid'],
                'result' => 'ALREADY_ACTIVATED'
            ]
        ]);
    }

    if ($activation['status'] !== 'PENDING') {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'La activación no está pendiente.');
    }

    if ((int)$activation['expired'] === 1) {
        $expire = $pdo->prepare("UPDATE device_activations SET status = 'EXPIRED' WHERE id = ?");
        $expire->execute([$activation['id']]);
        $pdo->commit();
        driver_error(410, 'ACTIVATION_EXPIRED', 'La activación está vencida.');
    }

    $vehicleId = (int)$activation['vehicle_id'];
    $deviceId = (int)$activation['device_id'];
    if ($vehicleId <= 0 || $deviceId > 2147483647
        || !driver_find_enabled_vehicle($pdo, $vehicleId, (int)$activation['tenant_id'])) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'El vehículo de la activación no está disponible.');
    }

    $links = $pdo->prepare(
        'SELECT vehicle_id, device_id FROM vehicle_devices
         WHERE vehicle_id = ? OR device_id = ? FOR UPDATE'
    );
    $links->execute([$vehicleId, $deviceId]);
    $exactLink = false;
    foreach ($links->fetchAll(PDO::FETCH_ASSOC) as $link) {
        if ((int)$link['vehicle_id'] !== $vehicleId || (int)$link['device_id'] !== $deviceId) {
            $pdo->rollBack();
            driver_error(409, 'ACTIVATION_CONFLICT', 'El vehículo o dispositivo ya tiene otra asociación.');
        }
        $exactLink = true;
    }

    $updateDevice = $pdo->prepare(
        'UPDATE devices SET brand = ?, model = ?, app_version = ? WHERE id = ?'
    );
    $updateDevice->execute([
        $input->brand, $input->model, $input->app_version, $activation['device_id']
    ]);

    if (!$exactLink) {
        $insertLink = $pdo->prepare(
            'INSERT INTO vehicle_devices (vehicle_id, device_id) VALUES (?, ?)'
        );
        $insertLink->execute([$vehicleId, $deviceId]);
    }

    $useActivation = $pdo->prepare(
        "UPDATE device_activations SET status = 'USED', used_at = NOW() WHERE id = ?"
    );
    $useActivation->execute([$activation['id']]);

    $pdo->commit();
    driver_response(200, [
        'success' => true,
        'data' => [
            'device_uuid' => $activation['device_uuid'],
            'result' => 'ACTIVATED'
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo activar el dispositivo.');
}
