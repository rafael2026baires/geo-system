<?php

require_once __DIR__ . '/../bootstrap.php';

driver_require_post();
$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.cancelar');
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
        'SELECT a.status, a.used_at, a.cancelled_at, (a.expires_at <= NOW()) AS expired
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

    if ($activation['status'] === 'CANCELLED') {
        $pdo->commit();
        driver_response(200, [
            'success' => true,
            'data' => [
                'activation_id' => $activationId,
                'activation_status' => 'CANCELLED',
                'administrative_status' => 'CANCELLED',
                'cancelled_at' => $activation['cancelled_at']
            ]
        ]);
    }

    if ($activation['status'] !== 'PENDING' || $activation['used_at'] !== null) {
        $pdo->rollBack();
        driver_error(409, 'ACTIVATION_NOT_CANCELLABLE', 'La activación no puede cancelarse.');
    }

    if ((int)$activation['expired'] === 1) {
        $expire = $pdo->prepare(
            "UPDATE device_activations SET status = 'EXPIRED'
             WHERE id = ? AND status = 'PENDING' AND expires_at <= NOW()"
        );
        $expire->execute([$activationId]);
        $pdo->commit();
        driver_error(410, 'ACTIVATION_EXPIRED', 'La activación está vencida.');
    }

    $cancel = $pdo->prepare(
        "UPDATE device_activations
         SET status = 'CANCELLED', cancelled_at = NOW()
         WHERE id = ? AND status = 'PENDING' AND used_at IS NULL AND expires_at > NOW()"
    );
    $cancel->execute([$activationId]);

    if ($cancel->rowCount() !== 1) {
        $expire = $pdo->prepare(
            "UPDATE device_activations SET status = 'EXPIRED'
             WHERE id = ? AND status = 'PENDING' AND expires_at <= NOW()"
        );
        $expire->execute([$activationId]);
        $pdo->commit();
        driver_error(410, 'ACTIVATION_EXPIRED', 'La activación está vencida.');
    }

    $readCancelledAt = $pdo->prepare('SELECT cancelled_at FROM device_activations WHERE id = ?');
    $readCancelledAt->execute([$activationId]);
    $cancelledAt = $readCancelledAt->fetchColumn();

    $pdo->commit();

    driver_response(200, [
        'success' => true,
        'data' => [
            'activation_id' => $activationId,
            'activation_status' => 'CANCELLED',
            'administrative_status' => 'CANCELLED',
            'cancelled_at' => $cancelledAt
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo cancelar la activación.');
}
