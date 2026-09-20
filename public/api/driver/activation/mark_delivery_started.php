<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.enviar');
$input = driver_read_json();

if (count(get_object_vars($input)) !== 1
    || !property_exists($input, 'activation_id')
    || !is_int($input->activation_id)
    || $input->activation_id <= 0) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere un activation_id entero positivo.');
}

$activationId = $input->activation_id;

try {
    $pdo->beginTransaction();

    $select = $pdo->prepare(
        'SELECT a.status, a.delivery_started_at, (a.expires_at <= NOW()) AS expired
         FROM device_activations a
         INNER JOIN devices d ON d.id = a.device_id
         WHERE a.id = ? AND d.tenant_id = ?
         FOR UPDATE'
    );
    $select->execute([$activationId, $tenantId]);
    $activation = $select->fetch(PDO::FETCH_ASSOC);

    if (!$activation) {
        $pdo->rollBack();
        driver_error(404, 'ACTIVATION_NOT_FOUND', 'Activación no encontrada.');
    }

    if ($activation['status'] !== 'PENDING') {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_CONFLICT', 'La activación no está pendiente.');
    }

    if ((int)$activation['expired'] === 1) {
        $pdo->rollBack();
        driver_error(410, 'ACTIVATION_EXPIRED', 'La activación está vencida.');
    }

    $update = $pdo->prepare(
        'UPDATE device_activations
         SET delivery_started_at = COALESCE(delivery_started_at, NOW())
         WHERE id = ?'
    );
    $update->execute([$activationId]);

    $read = $pdo->prepare('SELECT delivery_started_at FROM device_activations WHERE id = ?');
    $read->execute([$activationId]);
    $deliveryStartedAt = $read->fetchColumn();

    $pdo->commit();

    driver_response(200, [
        'success' => true,
        'data' => [
            'activation_id' => $activationId,
            'delivery_started_at' => $deliveryStartedAt,
            'administrative_status' => 'DELIVERY_STARTED_PENDING_CONFIRMATION'
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo registrar el inicio del envío.');
}
