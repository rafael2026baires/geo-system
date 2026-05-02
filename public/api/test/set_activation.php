<?php

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

$active = isset($_REQUEST['active']) ? (int)$_REQUEST['active'] : null;
$tenantId  = isset($_REQUEST['tenantId']) ? (int)$_REQUEST['tenantId'] : 0;
$vehicleId = isset($_REQUEST['vehicleId']) ? (int)$_REQUEST['vehicleId'] : 0;

if ($active === null || $tenantId === 0 || $vehicleId === 0) {
    echo json_encode([
        'ok' => false,
        'msg' => 'missing params'
    ]);
    exit;
}

$stmt = $pdo->prepare("
    UPDATE vehicles
    SET active = ?
    WHERE tenant_id = ?
    AND id = ?
");

$stmt->execute([$active, $tenantId, $vehicleId]);

echo json_encode([
    'ok' => true,
    'vehicle_id' => $vehicleId,
    'active' => $active
]);