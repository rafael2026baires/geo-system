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
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos']);
        exit;
    }

    $stmt = $pdo->prepare("
        UPDATE vehicles
        SET
            brand  = ?,
            model = ?,
            patent = ?,
            guy = ?,
            notes = ?            
        WHERE id = ?
        AND tenant_id = ?
    ");

    $stmt->execute([
        $marca,
        $modelo,
        $patente,
        $tipo,
        $notes,        
        $id,
        $tenantId
    ]);

    echo json_encode([
        'success' => true
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}