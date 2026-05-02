<?php

require_once __DIR__ . '/../../../bootstrap.php';

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
        SELECT id, name
        FROM companies
        WHERE tenant_id = ?
        AND name LIKE ?
        ORDER BY name
        LIMIT 20
    ");

    $stmt->execute([
        $tenantId,
        "%$q%"
    ]);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}