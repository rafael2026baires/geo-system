<?php

/*
REFERENCIAS SQL EN BASE DE DATOS order_assignments
ACTIVE = 1
LOADED = 30
SUPERSEDED = 50
*/

require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../../services/ResourceSuggestionService.php';
require_once __DIR__ . '/../../../../services/CacheInvalidationService.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('Metodo no permitido');
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $orderId   = isset($input['order_id']) ? (int)$input['order_id'] : 0;
    $vehicleId = isset($input['vehicle_id']) ? (int)$input['vehicle_id'] : 0;
    $driverId  = isset($input['driver_id']) ? (int)$input['driver_id'] : 0;
    $deviceId  = isset($input['device_id']) ? (int)$input['device_id'] : 0;
    
    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }    

    if ($orderId === 0) {
        json_error('Datos incompletos');
    }
    if ($vehicleId === 0 && $driverId === 0) {
        json_error('Debe asignar vehiculo, chofer o ambos');
    }
    

    $pdo->beginTransaction();

    // validar veh赤culo
    if ($vehicleId !== 0) {

        $stmt = $pdo->prepare("
            SELECT enabled
            FROM vehicles
            WHERE tenant_id = ?
            AND id = ?
            LIMIT 1
        ");
        $stmt->execute([$tenantId, $vehicleId]);
        $vehiculo = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vehiculo) {
            json_error('Vehiculo inexistente');
        }

        if ((int)$vehiculo['enabled'] !== 1) {
            json_error('Vehículo deshabilitado');
        }
    }

    // validar chofer
    if ($driverId !== 0) {

        $stmt = $pdo->prepare("
            SELECT active
            FROM drivers
            WHERE tenant_id = ?
            AND id = ?
            LIMIT 1
        ");
        $stmt->execute([$tenantId, $driverId]);
        $chofer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$chofer) {
            json_error('Chofer inexistente');
        }

        if ((int)$chofer['active'] !== 1) {
            json_error('Chofer inactivo');
        }
    }

    // cerrar asignaci車n previa
    $stmt = $pdo->prepare("
        UPDATE order_assignments
        SET status = 50,
            closed_at = NOW()
        WHERE order_id = ?
        AND tenant_id = ?
        AND status = 1
    ");
    $stmt->execute([$orderId, $tenantId]);

    // sugerencias
    if ($vehicleId !== 0 && ($driverId === 0 || $deviceId === 0)) {    

        $suggestion = ResourceSuggestionService::getSuggestion(
            $pdo,
            $tenantId,
            $vehicleId
        );

        if ($driverId === 0 && !empty($suggestion['driver_id'])) {   
            $driverId = (int)$suggestion['driver_id'];
        }

        if ($deviceId === 0 && !empty($suggestion['device_id'])) {    
            $deviceId = (int)$suggestion['device_id'];
        }
    }

    // insertar asignaci車n
    $stmt = $pdo->prepare("
        INSERT INTO order_assignments (
            tenant_id,
            order_id,
            vehicle_id,
            driver_id,
            device_id,
            assigned_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $tenantId,
        $orderId,
        $vehicleId,
        $driverId,
        $deviceId
    ]);

    // actualizar order
    $stmt = $pdo->prepare("
        UPDATE orders
        SET 
        vehicle_id  = ?,
        status = 20
        WHERE id = ?
        AND tenant_id = ?
    ");
    $stmt->execute([$vehicleId, $orderId, $tenantId]);    

    $pdo->commit();        
    CacheInvalidationService::gridContext($tenantId);

    json_ok([
        'vehicle_id' => $vehicleId,
        'driver_id'  => $driverId,
        'device_id'  => $deviceId
    ]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_error('Error interno');
}