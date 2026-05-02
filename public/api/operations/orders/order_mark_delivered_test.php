<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('Metodo no permitido');
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $orderId = isset($input['order_id']) ? (int)$input['order_id'] : 0;

    $tenantId = 1;

    if ($orderId === 0) {
        json_error('Datos incompletos');
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT trip_id, vehicle_id FROM orders
        WHERE id = ? AND tenant_id = ?
    ");
    $stmt->execute([$orderId, $tenantId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$order || !$order['trip_id'] || !$order['vehicle_id']) {
        json_error('Pedido no asignado a unidad/viaje');
    }
    
    $tripId = (int)$order['trip_id'];
    $vehicleId = (int)$order['vehicle_id'];

    $stmt = $pdo->prepare("
        UPDATE orders
        SET status = 40,
            delivered_at = NOW()
        WHERE id = ? AND tenant_id = ?
    ");
    $stmt->execute([$orderId, $tenantId]);

    // pendientes en el viaje
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM orders o
        WHERE o.tenant_id = ?
        AND o.status = 30 
        AND o.trip_id = ?
        AND o.vehicle_id = ?
    ");
    $stmt->execute([$tenantId, $tripId, $vehicleId]);

    // ----------------  cerrar viaje -------------------------------------
    /*
    $stmt = $pdo->prepare("
        UPDATE trips t
        SET status = 40,
            ended_at = NOW()
        WHERE t.tenant_id = ?
        AND t.id = ?
        AND t.vehicle_id = ?
    ");
    $stmt->execute([$tenantId, $tripId, $vehicleId]);
    */
    // -------------------------------------------------------------------

    $pdo->commit();

    json_ok([]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_error('Error interno');
}