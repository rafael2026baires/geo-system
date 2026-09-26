<?php

require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../../../services/VehicleRegularDriverService.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Metodo no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? null;

    session_start();
    $tenantId = $_SESSION['tenant_id'] ?? null;
    if (!$tenantId) {
        http_response_code(401);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos incompletos']);
        exit;
    }

    $pdo->beginTransaction();
    $lock = $pdo->prepare('SELECT id FROM vehicles WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE');
    $lock->execute([$id, $tenantId]);
    if ($lock->fetchColumn() === false) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Vehículo no encontrado']);
        exit;
    }

    $mode = 'deleted';
    try {
        $stmt = $pdo->prepare('DELETE FROM vehicles WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);

        $stmt = $pdo->prepare('DELETE FROM vehicle_state WHERE vehicle_id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
    } catch (PDOException $e) {
        $stmt = $pdo->prepare('UPDATE vehicles SET active = 0 WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        VehicleRegularDriverService::closeCurrentForVehicle($pdo, (int)$tenantId, (int)$id);
        $mode = 'inactivated';
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'mode' => $mode]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'Error interno', 'detalle' => $e->getMessage()]);
}
