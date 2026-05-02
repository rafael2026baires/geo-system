<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $name     = trim($input['name'] ?? '');
    $address  = $input['address'] ?? null;
    $city     = trim($input['city'] ?? '');
    $state_id     = $input['state_id'] ?? null;
    $country_id  = $input['country_id'] ?? null;     
    $phone    = $input['phone'] ?? null;
    $notes    = $input['notes'] ?? null;

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    if (!$name) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos']);
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO customers
        (
         tenant_id, 
         name, 
         address, 
         city,
         state_id,
         country_id,         
         phone, 
         notes, 
         created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?,NOW())
    ");

    $stmt->execute([
        $tenantId,
        $name,
        $address,
        $city,
        $state_id,
        $country_id,        
        $phone,
        $notes
    ]);

    echo json_encode([
        'success' => true,
        'customer_id' => $pdo->lastInsertId()
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}