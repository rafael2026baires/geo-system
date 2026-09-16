<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
$input = driver_read_json();

if (count(get_object_vars($input)) !== 0) {
    driver_error(400, 'UNEXPECTED_FIELDS', 'El cuerpo JSON debe estar vacío.');
}

try {
    $pdo->beginTransaction();

    $checkDevice = $pdo->prepare('SELECT id FROM devices WHERE device_uuid = ? LIMIT 1');
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $deviceUuid = 'U-' . strtoupper(bin2hex(random_bytes(4)));
        $checkDevice->execute([$deviceUuid]);
        if (!$checkDevice->fetchColumn()) {
            break;
        }
    }
    if ($attempt === 10) {
        throw new RuntimeException('No se pudo generar un identificador único.');
    }

    $activationCode = driver_generate_activation_code($pdo);

    $expiresAt = (new DateTimeImmutable('now'))->modify('+7 days')->format('Y-m-d H:i:s');

    $insertDevice = $pdo->prepare(
        'INSERT INTO devices (tenant_id, device_uuid, model, brand, app_version, active)
         VALUES (?, ?, NULL, NULL, NULL, 1)'
    );
    $insertDevice->execute([$tenantId, $deviceUuid]);
    $deviceId = (int)$pdo->lastInsertId();

    $insertActivation = $pdo->prepare(
        'INSERT INTO device_activations
         (device_id, activation_code, status, expires_at, sent_at, used_at)
         VALUES (?, ?, ?, ?, NULL, NULL)'
    );
    $insertActivation->execute([$deviceId, $activationCode, 'PENDING', $expiresAt]);
    $activationId = (int)$pdo->lastInsertId();

    $pdo->commit();

    driver_response(201, [
        'success' => true,
        'data' => [
            'device_id' => $deviceId,
            'device_uuid' => $deviceUuid,
            'activation_id' => $activationId,
            'activation_code' => $activationCode,
            'activation_status' => 'PENDING',
            'administrative_status' => 'PENDING_SEND',
            'expires_at' => $expiresAt
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo crear la activación.');
}
