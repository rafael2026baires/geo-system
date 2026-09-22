<?php

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../../../services/WsCoreIdentityService.php';

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
        'SELECT a.id, a.vehicle_id, a.replaces_device_id, a.status,
                (a.expires_at <= NOW()) AS expired,
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
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_ALREADY_USED', 'Este código de activación ya fue utilizado.');
    }

    if ($activation['status'] === 'PENDING') {
        $latestQuery = $pdo->prepare(
            'SELECT id FROM device_activations WHERE device_id = ?
             ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE'
        );
        $latestQuery->execute([$activation['device_id']]);
        if ((int)$latestQuery->fetchColumn() !== (int)$activation['id']) {
            $pdo->rollBack();
            driver_error(409, 'ACTIVATION_CONFLICT', 'El código pertenece a una activación anterior.');
        }
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

    if ($activation['replaces_device_id'] !== null) {
        $oldDeviceId = (int)$activation['replaces_device_id'];
        $oldDeviceQuery = $pdo->prepare(
            'SELECT id, device_uuid, active FROM devices
             WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
        );
        $oldDeviceQuery->execute([$oldDeviceId, $activation['tenant_id']]);
        $oldDevice = $oldDeviceQuery->fetch(PDO::FETCH_ASSOC);
        if (!$oldDevice || (int)$oldDevice['active'] !== 1 || $oldDeviceId === $deviceId) {
            $pdo->rollBack();
            driver_error(409, 'REPLACEMENT_CONFLICT', 'El dispositivo reemplazado ya no está disponible.');
        }

        $oldActivationQuery = $pdo->prepare(
            'SELECT status, vehicle_id FROM device_activations WHERE device_id = ?
             ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE'
        );
        $oldActivationQuery->execute([$oldDeviceId]);
        $oldActivation = $oldActivationQuery->fetch(PDO::FETCH_ASSOC);
        if (!$oldActivation || $oldActivation['status'] !== 'USED'
            || (int)$oldActivation['vehicle_id'] !== $vehicleId) {
            $pdo->rollBack();
            driver_error(409, 'REPLACEMENT_CONFLICT', 'El estado del dispositivo reemplazado cambió.');
        }

        $replacementLinks = $pdo->prepare(
            'SELECT vehicle_id, device_id FROM vehicle_devices
             WHERE vehicle_id = ? OR device_id IN (?, ?) FOR UPDATE'
        );
        $replacementLinks->execute([$vehicleId, $oldDeviceId, $deviceId]);
        $linkedRows = $replacementLinks->fetchAll(PDO::FETCH_ASSOC);
        if (count($linkedRows) !== 1
            || (int)$linkedRows[0]['vehicle_id'] !== $vehicleId
            || (int)$linkedRows[0]['device_id'] !== $oldDeviceId) {
            $pdo->rollBack();
            driver_error(409, 'REPLACEMENT_CONFLICT', 'La asociación efectiva cambió durante el reemplazo.');
        }

        $updateDevice = $pdo->prepare(
            'UPDATE devices SET brand = ?, model = ?, app_version = ? WHERE id = ?'
        );
        $updateDevice->execute([$input->brand, $input->model, $input->app_version, $deviceId]);

        $deleteOldLink = $pdo->prepare(
            'DELETE FROM vehicle_devices WHERE vehicle_id = ? AND device_id = ?'
        );
        $deleteOldLink->execute([$vehicleId, $oldDeviceId]);
        if ($deleteOldLink->rowCount() !== 1) {
            throw new RuntimeException('No se pudo retirar la asociación anterior.');
        }

        $insertNewLink = $pdo->prepare(
            'INSERT INTO vehicle_devices (vehicle_id, device_id) VALUES (?, ?)'
        );
        $insertNewLink->execute([$vehicleId, $deviceId]);

        $disableOld = $pdo->prepare(
            'UPDATE devices SET active = 0 WHERE id = ? AND tenant_id = ? AND active = 1'
        );
        $disableOld->execute([$oldDeviceId, $activation['tenant_id']]);
        if ($disableOld->rowCount() !== 1) {
            throw new RuntimeException('No se pudo deshabilitar el dispositivo anterior.');
        }

        $useReplacement = $pdo->prepare(
            "UPDATE device_activations SET status = 'USED', used_at = NOW()
             WHERE id = ? AND status = 'PENDING'"
        );
        $useReplacement->execute([$activation['id']]);
        if ($useReplacement->rowCount() !== 1) {
            throw new RuntimeException('No se pudo completar la activación de reemplazo.');
        }

        ws_core_queue_identity_revocation($pdo, $oldDevice['device_uuid']);
        $pdo->commit();
        ws_core_process_identity_revocation($pdo, $oldDevice['device_uuid']);
        driver_response(200, [
            'success' => true,
            'data' => ['device_uuid' => $activation['device_uuid'], 'result' => 'ACTIVATED']
        ]);
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
