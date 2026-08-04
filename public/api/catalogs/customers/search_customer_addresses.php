<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    session_start();
    
    $tenantId   = $_SESSION['tenant_id'] ?? null;
    $customerId = $_GET['customer_id'] ?? null;
    $q          = $_GET['q'] ?? '';

    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    
    if (!$customerId) {
        http_response_code(400);
        echo json_encode(['error' => 'customer_id requerido']);
        exit;
    }

    if (strlen($q) < 3) {
        echo json_encode([]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT 
            address,
            lat,
            lng,
            place_id,
            city,
            state,
            country
        FROM customer_addresses
        WHERE tenant_id = ?
        AND customer_id = ?
        AND address LIKE ?
        ORDER BY address
        LIMIT 10
    ");

    $stmt->execute([
        $tenantId,
        $customerId,
        "$q%"
    ]);

    $addresses = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($addresses);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}
