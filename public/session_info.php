<?php

require_once __DIR__ . '/api/bootstrap.php';

session_start();
header('Content-Type: application/json');

// tenant desde sesiÃ³n
$tenant_id = isset($_SESSION['tenant_id']) ? (int) $_SESSION['tenant_id'] : null;

if (!$tenant_id) {
    echo json_encode([
        'error' => 'No tenant in session'
    ]);
    exit;
}

// valores por defecto
$default_lat = null;
$default_lng = null;
$base_radius_m = null;

// buscar coords del tenant
if ($tenant_id) {
    $stmt = $pdo->prepare("SELECT default_lat, default_lng, base_radius_m FROM tenants WHERE id = ?");
    $stmt->execute([$tenant_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $default_lat = $row['default_lat'];
        $default_lng = $row['default_lng'];
        $base_radius_m = $row['base_radius_m'];
        
        // las coordenadas se guardan en sessi¨®n
        $_SESSION['default_lat'] = $row['default_lat'];
        $_SESSION['default_lng'] = $row['default_lng']; 
        $_SESSION['base_radius_m'] = $row['base_radius_m'];
    }
}

// respuesta final
echo json_encode([
    'tenant_id'   => $tenant_id,
    'user_name'   => $_SESSION['user_name'] ?? 'Usuario',
    'default_lat' => $default_lat,
    'default_lng' => $default_lng,
    'base_radius_m' => $base_radius_m
]);