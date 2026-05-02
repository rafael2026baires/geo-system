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
p.driver_id,
d.name AS driver_name,
p.device_id,
dv.device_uuid
FROM policy_driver_device p
JOIN drivers d ON d.id = p.driver_id
JOIN devices dv ON dv.id = p.device_id
WHERE p.tenant_id = :tenant_id
ORDER BY d.name
";

$stmt = $pdo->prepare($sql);
$stmt->bindParam(':tenant_id', $tenant_id, PDO::PARAM_INT);
$stmt->execute();

$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "success" => true,
    "data" => $data
]);