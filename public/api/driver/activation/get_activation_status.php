<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'INVALID_REQUEST', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.ver');

if (count($_GET) !== 1 || !array_key_exists('device_id', $_GET)) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere únicamente device_id.');
}

$deviceId = filter_var(
    $_GET['device_id'],
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);

if ($deviceId === false) {
    driver_error(400, 'INVALID_REQUEST', 'device_id debe ser un entero positivo.');
}

try {
    $deviceQuery = $pdo->prepare(
        'SELECT id, device_uuid, active, brand, model, app_version
         FROM devices WHERE id = ? AND tenant_id = ? LIMIT 1'
    );
    $deviceQuery->execute([$deviceId, $tenantId]);
    $device = $deviceQuery->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        driver_error(404, 'DEVICE_NOT_FOUND', 'Dispositivo no encontrado.');
    }

    driver_expire_pending_activations($pdo, $tenantId);

    $activationQuery = $pdo->prepare(
        'SELECT a.id, a.vehicle_id, a.driver_id, a.replaces_device_id,
                replaced.device_uuid AS replaces_device_uuid,
                a.activation_code, a.status, a.created_at, a.expires_at,
                a.delivery_started_at, a.sent_at, a.used_at, a.cancelled_at,
                (a.expires_at <= NOW()) AS expired
         FROM device_activations a
         LEFT JOIN devices replaced ON replaced.id = a.replaces_device_id
         WHERE a.device_id = ?
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 1'
    );
    $activationQuery->execute([$deviceId]);
    $row = $activationQuery->fetch(PDO::FETCH_ASSOC);

    $activation = null;
    $administrativeStatus = 'NO_ACTIVATION';

    if ($row) {
        $recipient = null;
        if ($row['driver_id'] !== null) {
            $recipientQuery = $pdo->prepare(
                'SELECT id, name, phone, email FROM drivers WHERE id = ? AND tenant_id = ? LIMIT 1'
            );
            $recipientQuery->execute([$row['driver_id'], $tenantId]);
            $recipient = $recipientQuery->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($recipient) {
                $recipient['id'] = (int)$recipient['id'];
            }
        }
        $status = $row['status'];
        if ($status === 'PENDING' && (int)$row['expired'] === 1) {
            $status = 'EXPIRED';
        }

        if ($status === 'CANCELLED') {
            $administrativeStatus = 'CANCELLED';
        } elseif ($status === 'EXPIRED') {
            $administrativeStatus = 'EXPIRED';
        } elseif ($status === 'USED') {
            $administrativeStatus = 'ACTIVATED';
        } elseif ($status === 'PENDING') {
            $administrativeStatus = $row['sent_at'] !== null
                ? 'SENT_PENDING_ACTIVATION'
                : ($row['delivery_started_at'] !== null
                    ? 'DELIVERY_STARTED_PENDING_CONFIRMATION'
                    : 'PENDING_SEND');
        } else {
            throw new RuntimeException('Estado de activación desconocido.');
        }

        $activation = [
            'activation_id' => (int)$row['id'],
            'vehicle_id' => (int)$row['vehicle_id'],
            'driver_id' => $row['driver_id'] === null ? null : (int)$row['driver_id'],
            'replaces_device_id' => $row['replaces_device_id'] === null ? null : (int)$row['replaces_device_id'],
            'replaces_device_uuid' => $row['replaces_device_uuid'],
            'recipient' => $recipient,
            'activation_code' => $row['activation_code'],
            'status' => $status,
            'administrative_status' => $administrativeStatus,
            'created_at' => $row['created_at'],
            'expires_at' => $row['expires_at'],
            'delivery_started_at' => $row['delivery_started_at'],
            'sent_at' => $row['sent_at'],
            'used_at' => $row['used_at'],
            'cancelled_at' => $row['cancelled_at']
        ];
    }

    $targetVehicle = null;
    if ($row) {
        $targetQuery = $pdo->prepare(
            'SELECT id, patent, brand, model FROM vehicles WHERE id = ? AND tenant_id = ? LIMIT 1'
        );
        $targetQuery->execute([$row['vehicle_id'], $tenantId]);
        $targetVehicle = $targetQuery->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($targetVehicle) {
            $targetVehicle['id'] = (int)$targetVehicle['id'];
        }
    }

    $vehicleQuery = $pdo->prepare(
        'SELECT v.id, v.patent FROM vehicle_devices vd
         INNER JOIN vehicles v ON v.id = vd.vehicle_id
         WHERE vd.device_id = ? AND v.tenant_id = ? ORDER BY v.id'
    );
    $vehicleQuery->execute([$deviceId, $tenantId]);
    $vehicleRows = $vehicleQuery->fetchAll(PDO::FETCH_ASSOC);
    $vehicle = $vehicleRows[0] ?? null;

    $activationFlagsQuery = $pdo->prepare(
        "SELECT
             COALESCE(MAX(status = 'USED'), 0) AS has_used,
             COALESCE(MAX(status = 'PENDING' AND expires_at > NOW()), 0) AS has_pending
         FROM device_activations WHERE device_id = ?"
    );
    $activationFlagsQuery->execute([$deviceId]);
    $activationFlags = $activationFlagsQuery->fetch(PDO::FETCH_ASSOC);
    $hasUsedActivation = (int)$activationFlags['has_used'] === 1;
    $hasPendingActivation = (int)$activationFlags['has_pending'] === 1;

    $pendingReplacementQuery = $pdo->prepare(
        "SELECT id FROM device_activations
         WHERE replaces_device_id = ? AND status = 'PENDING' AND expires_at > NOW()
         LIMIT 1"
    );
    $pendingReplacementQuery->execute([$deviceId]);
    $hasPendingReplacement = $pendingReplacementQuery->fetchColumn() !== false;

    $replacementQuery = $pdo->prepare(
        'SELECT a.id AS activation_id, a.device_id, d.device_uuid, d.active,
                a.status, a.expires_at, a.delivery_started_at, a.sent_at, a.used_at,
                a.cancelled_at, (a.expires_at <= NOW()) AS expired
         FROM device_activations a
         INNER JOIN devices d ON d.id = a.device_id AND d.tenant_id = ?
         WHERE a.replaces_device_id = ?
         ORDER BY a.created_at DESC, a.id DESC LIMIT 1'
    );
    $replacementQuery->execute([$tenantId, $deviceId]);
    $replacement = $replacementQuery->fetch(PDO::FETCH_ASSOC) ?: null;
    if ($replacement) {
        $replacementStatus = $replacement['status'];
        $replacement['administrative_status'] = $replacementStatus === 'USED' ? 'ACTIVATED'
            : ($replacementStatus === 'CANCELLED' ? 'CANCELLED'
            : ($replacementStatus === 'EXPIRED' || (int)$replacement['expired'] === 1 ? 'EXPIRED'
            : ($replacement['sent_at'] !== null ? 'SENT_PENDING_ACTIVATION'
            : ($replacement['delivery_started_at'] !== null
                ? 'DELIVERY_STARTED_PENDING_CONFIRMATION' : 'PENDING_SEND'))));
        $replacement['activation_id'] = (int)$replacement['activation_id'];
        $replacement['device_id'] = (int)$replacement['device_id'];
        $replacement['enabled'] = (int)$replacement['active'] === 1;
        unset($replacement['active'], $replacement['expired']);
    }

    $driverQuery = $pdo->prepare(
        'SELECT dr.id, dr.name FROM policy_driver_device p
         INNER JOIN drivers dr ON dr.id = p.driver_id
         WHERE p.device_id = ? AND p.tenant_id = ? AND dr.tenant_id = ? LIMIT 1'
    );
    $driverQuery->execute([$deviceId, $tenantId, $tenantId]);
    $driver = $driverQuery->fetch(PDO::FETCH_ASSOC) ?: null;

    driver_response(200, [
        'success' => true,
        'data' => [
            'device_id' => (int)$device['id'],
            'device_uuid' => $device['device_uuid'],
            'enabled' => (int)$device['active'] === 1,
            'brand' => $device['brand'],
            'model' => $device['model'],
            'app_version' => $device['app_version'],
            'activation' => $activation,
            'target_vehicle' => $targetVehicle,
            'effective_vehicle' => $vehicle,
            'effective_vehicle_count' => count($vehicleRows),
            'has_used_activation' => $hasUsedActivation,
            'has_pending_activation' => $hasPendingActivation,
            'has_pending_replacement' => $hasPendingReplacement,
            'replacement' => $replacement,
            'associations' => ['vehicle' => $vehicle, 'driver' => $driver],
            'administrative_status' => $administrativeStatus
        ]
    ]);
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo consultar la activación.');
}
