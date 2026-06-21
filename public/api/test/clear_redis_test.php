<?php
header('Content-Type: application/json; charset=utf-8');

try {
    $tenantId = isset($_GET['tenantId']) ? (int)$_GET['tenantId'] : 1;

    $redis = new Redis();
    $redis->connect('127.0.0.1', 6379);
    $redis->select(0);

    $deleted = [];

    function deleteByPattern($redis, $pattern) {
        $count = 0;
        $keys = $redis->keys($pattern);

        foreach ($keys as $key) {
            $redis->del($key);
            $count++;
        }

        return $count;
    }

    // contexto pesado del tablero
    $deleted['grid_context'] = $redis->del("grid_context:$tenantId");

    // cache gráficos dashboard
    $deleted['dashboard_operational_charts_live'] = $redis->del("dashboard_operational_charts_live:$tenantId");
    // realtime GPS
    $deleted['unit'] = deleteByPattern($redis, "unit:$tenantId:*");

    // realtime OBD
    $deleted['obd'] = deleteByPattern($redis, "obd:$tenantId:*");

    // cache de resolución device_uuid -> tenant_id / vehicle_id
    $deleted['device_map'] = deleteByPattern($redis, "device:*:map");

    // cache de resolución obd_uuid -> tenant_id / vehicle_id
    $deleted['obd_device_map'] = deleteByPattern($redis, "obd_device:*:map");

    // estados auxiliares
    $deleted['stopped_since'] = deleteByPattern($redis, "stopped_since:*");

    echo json_encode([
        'ok' => true,
        'tenantId' => $tenantId,
        'deleted' => $deleted,
        'message' => 'Redis local limpiado para prueba de simulador'
    ], JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}