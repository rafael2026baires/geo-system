<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $device_uuid     = $input['device_uuid'] ?? null;
    $model    = $input['model'] ?? null;
    $brand     = $input['brand'] ?? null;
    $app_version    = $input['app_version'] ?? null;    

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    if (!$device_uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos']);
        exit;
    }
    
    $stmt = $pdo->prepare("
        INSERT INTO devices
        (tenant_id, device_uuid, model, brand, app_version)
        VALUES (?, ?, ?, 1)
    ");

    $stmt->execute([
        $tenantId,
        $device_uuid,
        $model,
        $brand,
        $app_version
    ]);

    echo json_encode([
        'success' => true,
        'device_id' => $pdo->lastInsertId()
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}