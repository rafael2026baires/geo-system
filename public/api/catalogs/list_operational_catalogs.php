<?php

require_once __DIR__ . '/../../../config/conexion_base.php';
$pdo = new Conexion();

header('Content-Type: application/json');

try {

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    // companies
    $stmt = $pdo->prepare("
        SELECT id, name
        FROM companies
        WHERE tenant_id = ?
        AND active = 1
        ORDER BY name
    ");
    $stmt->execute([$tenantId]);
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // customers
    $stmt = $pdo->prepare("
        SELECT id, name
        FROM customers
        WHERE tenant_id = ?
        AND active = 1
        ORDER BY name
        LIMIT 200
    ");
    $stmt->execute([$tenantId]);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // vehicles
    $stmt = $pdo->prepare("
        SELECT id, CONCAT(guy, ' ', brand, ' ', model)
        FROM vehicles
        WHERE tenant_id = ?
        AND active = 1
        ORDER BY id
    ");
    $stmt->execute([$tenantId]);
    $vehiculos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // drivers
    $stmt = $pdo->prepare("
        SELECT id, name
        FROM drivers
        WHERE tenant_id = ?
        AND active = 1
        ORDER BY name
    ");
    $stmt->execute([$tenantId]);
    $drivers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // devices
    $stmt = $pdo->prepare("
        SELECT id, device_uuid
        FROM devices
        WHERE tenant_id = ?
        AND active = 1
        ORDER BY device_uuid
    ");
    $stmt->execute([$tenantId]);
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "companies" => $companies,
        "customers" => $customers,
        "vehicles" => $vehiculos,
        "drivers" => $drivers,
        "devices" => $devices
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "error" => "Error interno",
        "detalle" => $e->getMessage()
    ]);
}
