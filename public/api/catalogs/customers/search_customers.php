<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    $q        = $_GET['q'] ?? '';
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT 
            c.id,
            c.name,
            ca.address
        FROM customers c
        LEFT JOIN customer_addresses ca
            ON ca.customer_id = c.id
           AND ca.tenant_id = c.tenant_id
        WHERE c.tenant_id = ?
          AND (c.name LIKE ? OR ca.address LIKE ?)
        ORDER BY c.name
        LIMIT 20
    ");
    
    $stmt->execute([
        $tenantId,
        "%$q%",
        "%$q%"
    ]);

    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}
