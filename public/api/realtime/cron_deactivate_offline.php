<?php

require_once __DIR__ . '/../../../config/technical_access.php';
require_local_technical_access();

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../config/redis.php';

$redis = getRedis();
if (!$redis) {
    die("Redis no disponible\n");
}

// LOG mínimo (opcional)
$logFile = __DIR__ . '/cron_log.txt';
file_put_contents($logFile, "RUN " . date('H:i:s') . "\n", FILE_APPEND);

// 1. traer tenants
$tenants = $pdo->query("SELECT id FROM tenants")->fetchAll(PDO::FETCH_COLUMN);

foreach ($tenants as $tenantId) {

    // 2. traer vehículos activos de ese tenant
    $stmt = $pdo->prepare("
        SELECT v.id AS vehicle_id, d.device_uuid AS unit_id
        FROM vehicles v
        LEFT JOIN vehicle_devices vd ON vd.vehicle_id = v.id
        LEFT JOIN devices d ON d.id = vd.device_id
        WHERE v.tenant_id = ? AND v.active = 1
    ");

    $stmt->execute([$tenantId]);

    $toDeactivate = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

        $unitId = $row['unit_id'];
        $vehicleId = (int)$row['vehicle_id'];

        if (!$unitId) continue;

        $key = "unit:$tenantId:$unitId";

        // verificar Redis
        $exists = $redis->exists($key);

        if (!$exists) {
            $toDeactivate[] = $vehicleId;
        }
    }

    // 3. desactivar SOLO en ese tenant
    if (!empty($toDeactivate)) {

        $ids = implode(',', array_map('intval', $toDeactivate));

        $sql = "UPDATE vehicles 
                SET active = 0 
                WHERE tenant_id = $tenantId 
                AND id IN ($ids)";

        $pdo->exec($sql);

        file_put_contents(
            $logFile,
            "Tenant $tenantId → desactivados: $ids\n",
            FILE_APPEND
        );
    }
}
