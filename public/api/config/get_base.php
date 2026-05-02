<?php

require_once __DIR__ . '/../bootstrap.php';

// 👉 leer tenant_id
$tenantId = isset($_GET['tenant_id']) ? (int)$_GET['tenant_id'] : 0;

if ($tenantId <= 0) {
    echo json_encode([]);
    exit;
}

// 👉 traer base desde tenants
$stmt = $pdo->prepare("
    SELECT default_lat, default_lng, base_radius_m
    FROM tenants
    WHERE id = ?
    LIMIT 1
");

$stmt->execute([(int)$tenantId]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    echo json_encode([]);
    exit;
}

// 👉 respuesta
echo json_encode([
    'base_lat' => (float)$row['default_lat'],
    'base_lng' => (float)$row['default_lng'],
    'base_radius' => (float)$row['base_radius_m']
]);