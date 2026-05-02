<?php

require_once __DIR__ . '/../bootstrap.php';

session_start();

$tenantId = $_SESSION['tenant_id'] ?? null;

if (!$tenantId) {
    json_error('No autorizado', 401);
}

$sql = "
    SELECT tenant_id, unit_id, active, cargo, phase, updated_at
    FROM units_state
    WHERE tenant_id = ?
";

$stmt = $pdo->prepare($sql);
$stmt->execute([$tenantId]);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));