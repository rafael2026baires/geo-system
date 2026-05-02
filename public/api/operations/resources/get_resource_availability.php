<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        json_error('Metodo no permitido');
    }

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }

    $vehicleId = $_GET['vehicle_id'] ?? null;
    $driverId  = $_GET['driver_id'] ?? null;
    $deviceId  = $_GET['device_id'] ?? null;

    $stmt = $pdo->prepare("
        SELECT
            EXISTS(
                SELECT 1
                FROM vehicle_state
                WHERE tenant_id = ?
                AND vehicle_id = ?
            ) AS vehicle_busy,

            EXISTS(
                SELECT 1
                FROM vehicle_state s
                JOIN trips t ON t.id = s.trip_id
                WHERE s.tenant_id = ?
                AND t.driver_id = ?
            ) AS driver_busy,

            EXISTS(
                SELECT 1
                FROM vehicle_state s
                JOIN trips t ON t.id = s.trip_id
                WHERE s.tenant_id = ?
                AND t.device_id = ?
            ) AS device_busy
    ");

    $stmt->execute([
        $tenantId, $vehicleId,
        $tenantId, $driverId,
        $tenantId, $deviceId
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    json_ok([
        'vehicle_busy' => (bool)$row['vehicle_busy'],
        'driver_busy'  => (bool)$row['driver_busy'],
        'device_busy'  => (bool)$row['device_busy']
    ]);

} catch (Throwable $e) {

    json_error('Error interno');
}