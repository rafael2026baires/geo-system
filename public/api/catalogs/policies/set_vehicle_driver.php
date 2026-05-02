<?php

require_once __DIR__ . '/../../bootstrap.php';

session_start();

$tenant_id = $_SESSION['tenant_id'] ?? null;

if (!$tenant_id) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$vehicle_id = intval($_POST['vehicle_id']);
$driver_id  = intval($_POST['driver_id']);

try {

    $sql = "
    INSERT INTO policy_vehicle_driver
    (tenant_id, vehicle_id, driver_id)
    VALUES
    (:tenant_id, :vehicle_id, :driver_id)
    ON DUPLICATE KEY UPDATE
    driver_id = VALUES(driver_id)
    ";

    $stmt = $pdo->prepare($sql);

    $stmt->bindParam(':tenant_id', $tenant_id, PDO::PARAM_INT);
    $stmt->bindParam(':vehicle_id', $vehicle_id, PDO::PARAM_INT);
    $stmt->bindParam(':driver_id', $driver_id, PDO::PARAM_INT);

    $stmt->execute();

    echo json_encode([
        "success" => true,
        "message" => "Policy vehicle-driver guardada"
    ]);

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

}