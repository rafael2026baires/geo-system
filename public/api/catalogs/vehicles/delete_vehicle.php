<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $id       = $input['id'] ?? null;

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos']);
        exit;
    }

    try {
        
        $pdo->beginTransaction();

            // elimino el vehículo
            $stmt = $pdo->prepare("
                DELETE FROM vehicles
                WHERE id = ?
                AND tenant_id = ?
            ");
            $stmt->execute([$id, $tenantId]);
            
            // elimino el estado 
            $stmt = $pdo->prepare("
                DELETE FROM vehicle_state
                WHERE vehicle_id = ?
                AND tenant_id = ?
            ");
            $stmt->execute([$id, $tenantId]); 
        
        $pdo->commit();

        echo json_encode([
            'success' => true,
            'mode' => 'deleted'
        ]);

    } catch (PDOException $e) {

        $stmt = $pdo->prepare("
            UPDATE vehicles
            SET active = 0
            WHERE id = ?
            AND tenant_id = ?
        ");

        $stmt->execute([$id, $tenantId]);

        echo json_encode([
            'success' => true,
            'mode' => 'inactivated'
        ]);

    }

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