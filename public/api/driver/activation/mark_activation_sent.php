<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    driver_error(405, 'INVALID_REQUEST', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.enviar');
$input = json_decode(file_get_contents('php://input'));

if (!is_object($input)
    || json_last_error() !== JSON_ERROR_NONE
    || count(get_object_vars($input)) !== 1
    || !property_exists($input, 'activation_id')
    || !is_int($input->activation_id)
    || $input->activation_id <= 0) {
    driver_error(400, 'INVALID_REQUEST', 'Se requiere un activation_id entero positivo.');
}

$activationId = $input->activation_id;

try {
    $pdo->beginTransaction();

    $select = $pdo->prepare(
        'SELECT a.status, a.sent_at, (a.expires_at <= NOW()) AS expired
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

    $sentAt = $activation['sent_at'];
    if ($sentAt === null) {
        $update = $pdo->prepare(
            'UPDATE device_activations SET sent_at = NOW() WHERE id = ? AND sent_at IS NULL'
        );
        $update->execute([$activationId]);

        $readSentAt = $pdo->prepare('SELECT sent_at FROM device_activations WHERE id = ?');
        $readSentAt->execute([$activationId]);
        $sentAt = $readSentAt->fetchColumn();
    }

    $pdo->commit();

    driver_response(200, [
        'success' => true,
        'data' => [
            'activation_id' => $activationId,
            'administrative_status' => 'SENT_PENDING_ACTIVATION',
            'sent_at' => $sentAt
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo marcar la activación como enviada.');
}
