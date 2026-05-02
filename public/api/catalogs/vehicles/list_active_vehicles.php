<?php

require_once __DIR__ . '/../../bootstrap.php';

session_start();
$tenantId = $_SESSION['tenant_id'] ?? null;

if (!$tenantId) {
    json_error('No autorizado', 401);
}

$sql = "
    SELECT dv.device_uuid
    FROM vehicles v
    JOIN vehicle_devices vd ON vd.vehicle_id = v.id
    JOIN devices dv ON dv.id = vd.device_id
    WHERE v.tenant_id = ?
    AND v.active = 1
    ORDER BY v.id ASC  
";

$stmt = $pdo->prepare($sql);
$stmt->execute([$tenantId]);

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

json_ok($rows);