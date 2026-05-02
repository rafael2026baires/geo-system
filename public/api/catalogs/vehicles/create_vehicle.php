<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $marca  = $input['brand'] ?? null;
    $modelo    = $input['model'] ?? null;    
    $patente  = $input['patent'] ?? null;
    $tipo    = $input['guy'] ?? null;
    $notes   = $input['notes'] ?? null;

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    if (!$tipo) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos']);
        exit;
    }

    $pdo->beginTransaction();
    
        $stmt = $pdo->prepare("
            INSERT INTO vehicles
            (tenant_id, brand, model, patent, guy, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
    
        $stmt->execute([
            $tenantId,
            $marca,
            $modelo,
            $patente,
            $tipo,
            $notes
        ]);
        
        // -------- crear tabla de estados del vehículo ------
        $vehicleId = (int)$pdo->lastInsertId();
        
        $stmt = $pdo->prepare("
            INSERT INTO vehicle_state
            (tenant_id, vehicle_id)
            VALUES (?, ?)
        ");
    
        $stmt->execute([
            $tenantId,
            $vehicleId
        ]);    
        // ---------------------------------------------------
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'vehicle_id' => $pdo->lastInsertId()
    ]);

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