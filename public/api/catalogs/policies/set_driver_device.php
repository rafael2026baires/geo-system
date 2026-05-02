<?php

require_once __DIR__ . '/../../bootstrap.php';

session_start();

$tenant_id = $_SESSION['tenant_id'] ?? null;

if (!$tenant_id) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$driver_id = intval($_POST['driver_id']);
$device_id = intval($_POST['device_id']);

try {

    $sql = "
    INSERT INTO policy_driver_device
    (tenant_id, driver_id, device_id)
    VALUES
    (:tenant_id, :driver_id, :device_id)
    ON DUPLICATE KEY UPDATE
    device_id = VALUES(device_id)
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindParam(':tenant_id', $tenant_id, PDO::PARAM_INT);
    $stmt->bindParam(':driver_id', $driver_id, PDO::PARAM_INT);
    $stmt->bindParam(':device_id', $device_id, PDO::PARAM_INT);

    $stmt->execute();

    echo json_encode([
        "success" => true,
        "message" => "Policy driver-device guardada"
    ]);

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

}