<?php

require_once __DIR__ . '/../../../config/technical_access.php';
require_local_technical_access();

require_once __DIR__ . '/../bootstrap.php';

// ACTIVACION DEL VEHICULO
$active = isset($_REQUEST['active']) ? (int)$_REQUEST['active'] : null;

$tenantId  = isset($_REQUEST['tenantId']) ? (int)$_REQUEST['tenantId'] : 0;
$vehicleId = isset($_REQUEST['vehicleId']) ? (int)$_REQUEST['vehicleId'] : 0;
$operState = isset($_REQUEST['oper_state']) ? (int)$_REQUEST['oper_state'] : null;
$tripId    = isset($_REQUEST['trip_id']) ? (int)$_REQUEST['trip_id'] : null;

if ($active !== null) {
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
    exit;
}

if (!$tenantId || !$vehicleId || $operState === null) {
    echo json_encode([
        'ok' => false,
        'msg' => 'missing params'
    ]);
    exit;
}

// 
$stmt = $pdo->prepare("
    UPDATE vehicle_state
    SET oper_state = ?,
        trip_id = ?,
        updated_at = NOW()
    WHERE tenant_id = ?
    AND vehicle_id = ?
");

$stmt->execute([
    $operState,
    $tripId ?: null,
    $tenantId,
    $vehicleId
]);

echo json_encode([
    'ok' => true,
    'vehicle_id' => $vehicleId,
    'oper_state' => $operState,
    'trip_id' => $tripId
]);
