<?php

require_once __DIR__ . '/../../../bootstrap.php';
require_once __DIR__ . '/../../../../../services/CacheInvalidationService.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('Método no permitido');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    
    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }    

    $companyId    = $input['company_id'] ?? null;
    $customerId   = $input['customer_id'] ?? null;
    $address      = $input['address'] ?? null;
    $street_address = $input['street_address'] ?? null;
    $lat          = $input['lat'] ?? null;
    $lng          = $input['lng'] ?? null;
    $place_id     = $input['place_id'] ?? null; 
    $city         = $input['city'] ?? null;    
    $state        = $input['state'] ?? null;
    $country      = $input['country'] ?? null;
    
    $companyId  = (int)$companyId;
    $customerId = (int)$customerId;    
    
    if ($companyId === 0 || $customerId === 0 || !$address) {
        json_error('Datos incompletos');
    }

    $now = date('Y-m-d H:i:s');
    
    $lat = $lat !== null ? (float)$lat : null;
    $lng = $lng !== null ? (float)$lng : null;    

    // validar company
    $stmt = $pdo->prepare("
        SELECT id
        FROM companies
        WHERE tenant_id = ?
          AND id = ?
        LIMIT 1
    ");
    $stmt->execute([$tenantId, $companyId]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        json_error('Company inexistente');
    }

    // validar customer
    $stmt = $pdo->prepare("
        SELECT id
        FROM customers
        WHERE tenant_id = ?
          AND id = ?
        LIMIT 1
    ");
    $stmt->execute([$tenantId, $customerId]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        json_error('Customer inexistente');
    }

    $pdo->beginTransaction();

    // insertar order
    $stmt = $pdo->prepare("
        INSERT INTO orders (
            tenant_id,
            company_id,
            customer_id,
            address,
            street_address,
            lat,
            lng,
            place_id,
            city,
            state,
            country,
            status,
            created_at        
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?) 
    ");

    $stmt->execute([
        $tenantId,
        $companyId,
        $customerId,
        $address,
        $street_address,
        $lat,
        $lng,
        $place_id,
        $city,
        $state,
        $country,
        $now
    ]);

    $orderId = $pdo->lastInsertId();

    $place_id = $place_id ?: null;

    // guardar dirección si no existe
    $stmt = $pdo->prepare("
        INSERT INTO customer_addresses (
            tenant_id,
            customer_id,
            address,
            street_address,
            lat,
            lng,
            place_id,
            city,
            state,
            country,
            created_at
        )
        SELECT             
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
            SELECT 1
            FROM customer_addresses
            WHERE tenant_id = ?
            AND customer_id = ?
            AND lat = ?
            and lng = ?
        )
    ");
    
    $stmt->execute([
        $tenantId,
        $customerId,
        $address,
        $street_address,
        $lat,
        $lng,
        $place_id,
        $city,
        $state,
        $country,
        $now,
         
        $tenantId,
        $customerId,
        $lat,
        $lng     
    ]);

    $pdo->commit();
    CacheInvalidationService::gridContext($tenantId);
    CacheInvalidationService::dashboardCharts($tenantId);

    json_ok([
        'order_id' => $orderId,
        'lat' => $lat,
        'lng' => $lng
    ]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_error('Error interno');

}