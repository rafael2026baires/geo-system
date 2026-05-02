<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }

    $stmt = $pdo->prepare("
        SELECT id, name
        FROM companies
        WHERE tenant_id = ?
        AND active = 1
        ORDER BY name
    ");

    $stmt->execute([$tenantId]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    json_ok($rows);

} catch (Throwable $e) {

    json_error('Error interno');

}