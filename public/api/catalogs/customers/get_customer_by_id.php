<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    session_start();
    
    $tenantId  = $_SESSION['tenant_id'] ?? null;
    $customerId = $_GET['id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }    
    if (!$tenantId || !$customerId) {
        http_response_code(400);
        echo json_encode(['error' => 'Parámetros incompletos']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT id, name, address, phone, notes
        FROM customers
        WHERE tenant_id = ?
        AND id = ?
        LIMIT 1
    ");

    $stmt->execute([
        $tenantId,
        $customerId
    ]);

    $customer = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$customer) {
        http_response_code(404);
        echo json_encode(['error' => 'Cliente no encontrado']);
        exit;
    }

    echo json_encode($customer);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}
