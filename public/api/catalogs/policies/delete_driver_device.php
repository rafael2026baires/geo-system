<?php

require_once __DIR__ . '/../../bootstrap.php';
$id = intval($_POST['id']);

session_start();

$tenant_id = $_SESSION['tenant_id'] ?? null;

if (!$tenant_id) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

try {

    $sql = "DELETE FROM policy_driver_device WHERE id = :id AND tenant_id = :tenant_id";

    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':tenant_id', $tenant_id, PDO::PARAM_INT);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    echo json_encode([
        "success" => true,
        "message" => "Relación driver-device eliminada"
    ]);

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

}