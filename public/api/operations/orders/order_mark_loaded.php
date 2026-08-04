<?php

require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../../../services/ResourceSuggestionService.php';
require_once __DIR__ . '/../../../../services/CacheInvalidationService.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_error('Metodo no permitido');
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $orderId  = isset($input['order_id']) ? (int)$input['order_id'] : 0;
    $vehicleIdInput = isset($input['vehicle_id']) ? (int)$input['vehicle_id'] : 0;
    $driverIdInput  = isset($input['driver_id']) ? (int)$input['driver_id'] : 0;
    $deviceIdInput  = isset($input['device_id']) ? (int)$input['device_id'] : 0;
    
    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }    

    if ($orderId === 0) {
        json_error('Datos incompletos');
    }

    $now = date('Y-m-d H:i:s');

    $pdo->beginTransaction();

    // asignación activa
    $stmt = $pdo->prepare("
        SELECT vehicle_id, driver_id, device_id
        FROM order_assignments
        WHERE tenant_id = ?
          AND order_id = ?
          AND status = 1
        LIMIT 1
    ");

    $stmt->execute([$tenantId, $orderId]);
    $assignment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$assignment) {
        json_error('Pedido sin asignacion activa');
    }

    $vehicleIdAsignado = isset($assignment['vehicle_id']) ? (int)$assignment['vehicle_id'] : null;
    $driverIdAsignado  = isset($assignment['driver_id']) ? (int)$assignment['driver_id'] : null;
    $deviceIdAsignado  = isset($assignment['device_id']) ? (int)$assignment['device_id'] : null;

    // resolver vehículo
    if ($vehicleIdInput) {
        $vehicleId = (int)$vehicleIdInput;
    } elseif ($vehicleIdAsignado) {
        $vehicleId = (int)$vehicleIdAsignado;
    } else {
        json_error('Debe indicar vehiculo para cargar pedido');
    }

    // validar disponibilidad
    $stmt = $pdo->prepare("
        SELECT 1
        FROM trips
        WHERE 
        active = 1 
        AND tenant_id = ? 
        AND (
            vehicle_id = ?
            OR driver_id = ?
            OR device_id = ?
        )
        AND vehicle_id <> ?
        LIMIT 1
    ");
    $stmt->execute([
        $tenantId,
        $vehicleId,
        $driverIdInput ?: 0,
        $deviceIdInput ?: 0,
        $vehicleId
    ]);

    if ($stmt->fetch()) {
        json_error('Alguno de los recursos ya esta ocupado');
    }

    // completar recursos
    $driverIdFinal = $driverIdInput ? (int)$driverIdInput : ($driverIdAsignado ?: null);
    $deviceIdFinal = $deviceIdInput ? (int)$deviceIdInput : ($deviceIdAsignado ?: null);    

    if (!$driverIdFinal || !$deviceIdFinal) {

        $suggestion = ResourceSuggestionService::getSuggestion(
            $pdo,
            $tenantId,
            $vehicleId
        );

        if (!$driverIdFinal && !empty($suggestion['driver_id'])) {
            $driverIdFinal = (int)$suggestion['driver_id'];
        }

        if (!$deviceIdFinal && !empty($suggestion['device_id'])) {
            $deviceIdFinal = (int)$suggestion['device_id'];
        }
    }

    // update assignment
    $stmt = $pdo->prepare("
        UPDATE order_assignments
        SET 
            status = 30,
            vehicle_id = ?,
            driver_id = ?,
            device_id = ?
        WHERE tenant_id = ?
          AND order_id = ?
          AND status = 1
    ");

    $stmt->execute([
        $vehicleId,
        $driverIdFinal,
        $deviceIdFinal,
        $tenantId,
        $orderId
    ]);

    // validar estado order
    $stmt = $pdo->prepare("
        SELECT status
        FROM orders
        WHERE id = ?
        AND tenant_id = ?
        FOR UPDATE
    ");

    $stmt->execute([$orderId, $tenantId]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$current || (int)$current['status'] !== 20) {            
        json_error('Solo se puede cargar un pedido en estado ASSIGNED');
    }

    if ((int)$vehicleId === 0 || (int)$driverIdFinal === 0 || (int)$deviceIdFinal === 0) {
        json_error('Debe definir vehiculo, chofer y dispositivo');
    }

    // trip
    $stmt = $pdo->prepare("
        INSERT INTO trips (
            tenant_id,
            vehicle_id,
            driver_id,
            device_id,
            trip_date,
            base_lat,
            base_lng,
            base_radius,
            status,
            active,
            started_at
        )        
        VALUES (?, ?, ?, ?, CURRENT_DATE, NULL, NULL, 300, 30, 1, ?)
        ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            driver_id = COALESCE(driver_id, VALUES(driver_id)),
            device_id = COALESCE(device_id, VALUES(device_id))
    ");

    try {
        $stmt->execute([$tenantId, $vehicleId, $driverIdFinal, $deviceIdFinal, $now]);
    } catch (PDOException $e) {
        if (isset($e->errorInfo[1]) && (int)$e->errorInfo[1] === 1062) {
            json_error('Recurso ocupado');
        }
        throw $e;
    }

    $tripWasCreated = $stmt->rowCount() === 1;
    $tripId = $pdo->lastInsertId();

    if ($tripWasCreated) {
        $tripCode = 'VIA-' . date('Ymd', strtotime($now)) . '-' . $tripId;

        $stmt = $pdo->prepare("
            UPDATE trips
            SET trip_code = ?
            WHERE id = ?
              AND tenant_id = ?
        ");

        $stmt->execute([$tripCode, $tripId, $tenantId]);
    }

    // update order
    $stmt = $pdo->prepare("
                    UPDATE orders
                    SET status = 30,
                        loaded_at = ?,
                        trip_id = ?,
                        vehicle_id = ?
                    WHERE id = ?
                    AND tenant_id = ?
                    AND status = 20
    ");

    $stmt->execute([$now, $tripId, $vehicleId, $orderId, $tenantId]);

    if ($stmt->rowCount() === 0) {
        json_error('Pedido ya no esta ASSIGNED');
    }

    // resource combinations
    if ($vehicleId && ($driverIdFinal || $deviceIdFinal)) {

        $stmt = $pdo->prepare("
            INSERT INTO resource_combinations (tenant_id, vehicle_id, driver_id, device_id, last_used_at)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                driver_id = VALUES(driver_id),
                device_id = VALUES(device_id),
                last_used_at = VALUES(last_used_at)
        ");

        $stmt->execute([
            $tenantId,
            $vehicleId,
            $driverIdFinal ?: null,
            $deviceIdFinal ?: null,
            $now
        ]);
    }

    // estado operativo
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM order_assignments a
        WHERE a.tenant_id = ?
        AND a.status = 1
        AND (
              (? IS NOT NULL AND a.vehicle_id = ?)
           OR (? IS NOT NULL AND a.driver_id = ?)
        )
    ");

    $stmt->execute([
        $tenantId,
        $vehicleId, $vehicleId,
        $driverIdFinal, $driverIdFinal
    ]);

    $pdo->commit();
    CacheInvalidationService::gridContext($tenantId);
    CacheInvalidationService::dashboardCharts($tenantId); 

    json_ok([]);

} catch (Throwable $e) {

    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_error('Error interno');
}
