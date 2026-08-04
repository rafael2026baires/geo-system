<?php

require_once __DIR__ . '/../../../config/technical_access.php';
require_local_technical_access();

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../../config/redis.php';

header('Content-Type: application/json');

$active = isset($_REQUEST['active']) ? (int)$_REQUEST['active'] : null;
$deviceUuid = $_REQUEST['deviceUuid'] ?? $_REQUEST['device_uuid'] ?? null;

if ($active === null || !$deviceUuid) {
    echo json_encode([
        'ok' => false,
        'msg' => 'missing params'
    ]);
    exit;
}

$redis = getRedis();

$tenantId = null;
$vehicleId = null;
$source = 'db';

$mapKey = "device:$deviceUuid:map";

/*
|--------------------------------------------------------------------------
| 1) Primero intento resolver desde Redis
|--------------------------------------------------------------------------
*/
if ($redis !== null) {
    $cached = $redis->get($mapKey);

    if ($cached) {
        $map = json_decode($cached, true);

        if (is_array($map) && isset($map['tenant_id'], $map['vehicle_id'])) {
            $tenantId = (int)$map['tenant_id'];
            $vehicleId = (int)$map['vehicle_id'];
            $source = 'redis';
        }
    }
}

/*
|--------------------------------------------------------------------------
| 2) Si Redis no tiene el mapping, voy a MySQL
|--------------------------------------------------------------------------
*/
if ($tenantId === null || $vehicleId === null) {

    $stmt = $pdo->prepare("
        SELECT
            d.tenant_id,
            v.id AS vehicle_id
        FROM devices d
        JOIN vehicle_devices vd
            ON vd.device_id = d.id
        JOIN vehicles v
            ON v.id = vd.vehicle_id
        WHERE d.device_uuid = ?
        LIMIT 1
    ");

    $stmt->execute([$deviceUuid]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode([
            'ok' => false,
            'msg' => 'device not found',
            'deviceUuid' => $deviceUuid
        ]);
        exit;
    }

    $tenantId = (int)$row['tenant_id'];
    $vehicleId = (int)$row['vehicle_id'];
    $source = 'db';

    /*
    |--------------------------------------------------------------------------
    | 3) Guardo mapping en Redis para próximas activaciones
    |--------------------------------------------------------------------------
    */
    if ($redis !== null) {
        $redis->setex($mapKey, 86400, json_encode([
            'tenant_id' => $tenantId,
            'vehicle_id' => $vehicleId
        ]));
    }
}

/*
|--------------------------------------------------------------------------
| 4) UPDATE real en MySQL
|--------------------------------------------------------------------------
*/
$stmt = $pdo->prepare("
    UPDATE vehicles
    SET active = ?
    WHERE tenant_id = ?
    AND id = ?
");

$stmt->execute([$active, $tenantId, $vehicleId]);

/*
|--------------------------------------------------------------------------
| 5) Invalidar contexto del tablero
|--------------------------------------------------------------------------
*/
if ($redis !== null) {
    $redis->del("grid_context:" . $tenantId);
}

echo json_encode([
    'ok' => true,
    'deviceUuid' => $deviceUuid,
    'tenant_id' => $tenantId,
    'vehicle_id' => $vehicleId,
    'active' => $active,
    'mapping_source' => $source,
    'grid_context_invalidated' => true
]);
