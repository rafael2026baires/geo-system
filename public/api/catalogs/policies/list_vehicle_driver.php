<?php

require_once __DIR__ . '/../../bootstrap.php';

session_start();

$tenant_id = $_SESSION['tenant_id'] ?? null;

if (!$tenant_id) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$sql = "
SELECT
p.id,
p.vehicle_id,
dv.device_uuid AS vehicle_code,
p.driver_id,
d.name AS driver_name
FROM policy_vehicle_driver p
JOIN vehicles v ON v.id = p.vehicle_id
JOIN vehicle_devices vd ON vd.vehicle_id = v.id
JOIN devices dv ON dv.id = vd.device_id
JOIN drivers d ON d.id = p.driver_id
WHERE p.tenant_id = :tenant_id
ORDER BY dv.device_uuid
";

$stmt = $pdo->prepare($sql);
$stmt->bindParam(':tenant_id', $tenant_id, PDO::PARAM_INT);
$stmt->execute();

$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "success" => true,
    "data" => $data
]);