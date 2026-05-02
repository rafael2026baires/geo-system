<?php

class ResourceSuggestionService {

    public static function getSuggestion($pdo, $tenantId, $vehicleId = null, $driverId = null) {
    
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(pvd.driver_id, rc.driver_id) AS driver_id,
                COALESCE(pdd.device_id, rc.device_id) AS device_id
            FROM
                (SELECT ? AS vehicle_id) v
            LEFT JOIN policy_vehicle_driver pvd
                ON pvd.tenant_id = ?
               AND pvd.vehicle_id = v.vehicle_id
            LEFT JOIN resource_combinations rc
                ON rc.tenant_id = ?
               AND rc.vehicle_id = v.vehicle_id
            LEFT JOIN policy_driver_device pdd
                ON pdd.tenant_id = ?
               AND pdd.driver_id = COALESCE(pvd.driver_id, rc.driver_id)
            LIMIT 1
        ");
    
        $stmt->execute([
            $vehicleId,
            $tenantId,
            $tenantId,
            $tenantId
        ]);
    
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
        return [
            "vehicle_id" => $vehicleId,
            "driver_id"  => !empty($row['driver_id']) ? (int)$row['driver_id'] : null,
            "device_id"  => !empty($row['device_id']) ? (int)$row['device_id'] : null
        ];
    }
}