<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    
    $vehicleId = $input['vehicle_id'] ?? null;
    $activo    = $input['active'] ?? null;

    if (!$vehicleId || !in_array($activo, [0,1,'0','1'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos o invalidos']);
        exit;
    }

    // 🔹 Si se intenta desactivar
    if ((int)$activo === 0) {

        // Regla 1: No tener pedidos ASSIGNED o LOADED
        $stmt = $pdo->prepare("
            SELECT id FROM orders
            WHERE tenant_id = ?
            AND vehicle_id = ?
            AND status IN (20,30)
            LIMIT 1
        ");
        $stmt->execute([$tenantId, $vehicleId]);

        if ($stmt->fetch()) {
            throw new Exception("No se puede desactivar: tiene pedidos activos");
        }

        // Regla 2: oper_state debe ser 0 o 4
        $stmt = $pdo->prepare("
                                SELECT oper_state FROM vehicle_state
                                WHERE tenant_id = ?
                                and vehicle_id = ?
                                and (oper_state = 0 or oper_state = 4)              
                                LIMIT 1
        ");
        $stmt->execute([$tenantId, $vehicleId]);

        if ($stmt->fetch()) {
            throw new Exception("No se puede desactivar: estado operativo invalido");
        }   
    }

    // 🔹 UPDATE
    $stmt = $pdo->prepare("
        UPDATE vehicles
        SET active = ?
        WHERE tenant_id = ?
        AND id = ?
        LIMIT 1
    ");

    $stmt->execute([
        (int)$activo,
        $tenantId,
        $vehicleId
    ]);

    echo json_encode([
        'success' => true,
        'vehicle_id' => $vehicleId,
        'active' => (int)$activo
    ]);

} catch (Throwable $e) {

    http_response_code(500);
    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}