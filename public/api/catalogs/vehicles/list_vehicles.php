<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }    

    $stmt = $pdo->prepare("
        SELECT id, guy, brand, model, patent
        FROM vehicles
        WHERE tenant_id = ?
        AND id < 7
        ORDER BY id
    ");

    $stmt->execute([$tenantId]);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}