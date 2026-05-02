<?php

require_once __DIR__ . '/../../bootstrap.php';

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        json_error('Metodo no permitido');
    }
    
    session_start();
    
    $tenant_id = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenant_id) {
        json_error('No autorizado', 401);
    }   
    
    $vehicle_id = $_GET['vehicle_id'] ?? null;
    $driver_id  = $_GET['driver_id'] ?? null;

    $result = [
        'vehicle_id' => null,
        'driver_id'  => null,
        'device_id'  => null,
        'source'     => 'none'
    ];

    // VEHICULO
    if ($vehicle_id) {

        $result['vehicle_id'] = $vehicle_id;

        $stmt = $pdo->prepare("
            SELECT driver_id
            FROM policy_vehicle_driver
            WHERE tenant_id = ?
              AND vehicle_id = ?
            LIMIT 1
        ");
        $stmt->execute([$tenant_id, $vehicle_id]);
        $policy = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($policy) {
            $result['driver_id'] = $policy['driver_id'];

            $stmt = $pdo->prepare("
                SELECT device_id
                FROM policy_driver_device
                WHERE tenant_id = ?
                  AND driver_id = ?
                LIMIT 1
            ");
            $stmt->execute([$tenant_id, $policy['driver_id']]);
            $dev = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($dev) {
                $result['device_id'] = $dev['device_id'];
                $result['source'] = 'policy';
            }

            if (!$result['device_id']) {
                $stmt = $pdo->prepare("
                    SELECT device_id
                    FROM resource_combinations
                    WHERE tenant_id = ?
                      AND driver_id = ?
                    LIMIT 1
                ");
                $stmt->execute([$tenant_id, $policy['driver_id']]);
                $comb = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($comb && $comb['device_id']) {
                    $result['device_id'] = $comb['device_id'];
                    $result['source'] = 'combination';
                }
            }

            json_ok($result);
        }

        $stmt = $pdo->prepare("
            SELECT driver_id, device_id
            FROM resource_combinations
            WHERE tenant_id = ?
              AND vehicle_id = ?
            LIMIT 1
        ");
        $stmt->execute([$tenant_id, $vehicle_id]);
        $comb = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($comb) {
            $result['driver_id'] = $comb['driver_id'];
            $result['device_id'] = $comb['device_id'];
            $result['source'] = 'combination';
        }

        json_ok($result);
    }

    // CHOFER
    if ($driver_id) {

        $result['driver_id'] = $driver_id;

        $stmt = $pdo->prepare("
            SELECT device_id
            FROM policy_driver_device
            WHERE tenant_id = ?
              AND driver_id = ?
            LIMIT 1
        ");
        $stmt->execute([$tenant_id, $driver_id]);
        $policy = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($policy) {
            $result['device_id'] = $policy['device_id'];
            $result['source'] = 'policy';
        }

        if (!$result['device_id']) {
            $stmt = $pdo->prepare("
                SELECT vehicle_id, device_id
                FROM resource_combinations
                WHERE tenant_id = ?
                  AND driver_id = ?
                LIMIT 1
            ");
            $stmt->execute([$tenant_id, $driver_id]);
            $comb = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($comb) {
                if (!$result['vehicle_id'] && $comb['vehicle_id']) {
                    $result['vehicle_id'] = $comb['vehicle_id'];
                }
                if ($comb['device_id']) {
                    $result['device_id'] = $comb['device_id'];
                }
                $result['source'] = 'combination';
            }
        }

        json_ok($result);
    }

    json_error('vehicle_id o driver_id requerido');

} catch (Throwable $e) {

    json_error('Error interno');
}