<?php

require_once __DIR__ . '/../../bootstrap.php';

require_once __DIR__ . '/../services/OperStateService.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $orderId = isset($input['order_id']) ? (int)$input['order_id'] : 0;
    
    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }    
    
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
        throw new Exception("Pedido no asignado a unidad/viaje");
    }

    $tripId = (int)$order['trip_id'];
    $vehicleId = (int)$order['vehicle_id'];

    $stmt = $pdo->prepare("
        UPDATE orders
        SET status = 50,
            cancelled_at = NOW()
        WHERE id = ? AND tenant_id = ?
    ");
    $stmt->execute([$orderId, $tenantId]);

    // =========================================================
    // 9 CALCULAR ESTADO OPERATIVO
    // =========================================================
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM orders o
        WHERE o.tenant_id = ?
        AND o.status = 30
        and o.trip_id = ?
        AND o.vehicle_id = ?
    ");
    $stmt->execute([$tenantId, $tripId, $vehicleId]);   
    $pendientes = (int)$stmt->fetchColumn();
    $estadoOperativo = ($pendientes === 0) ? 4 : 3;
    
    // =========================================================
    // 10 ACTUALIZAR ESTADO OPERATIVO
    // =========================================================
    $service = new OperStateService($pdo);
    $service->actualizar_estado($tenantId, $vehicleId, $tripId, $estadoOperativo);    
    
    // =========================================================
    // 11 MARCAR VIAJE COMO COMPLETADO
    // =========================================================
    if ($estadoOperativo === 4) {
        
        $stmt = $pdo->prepare("
            UPDATE trips t
            SET status = 40,
            ended_at = NOW()
            WHERE t.tenant_id = ?
            and t.id = ?
            AND t.vehicle_id = ?
        ");
        $stmt->execute([$tenantId, $tripId, $vehicleId]);
    }
    
    // =========================================================
    // 12 COMMIT
    // =========================================================
    $pdo->commit();



    echo json_encode(['success' => true]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}
