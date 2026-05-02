<?php

$BASE_URL = (strpos($_SERVER['HTTP_HOST'], 'geo.local') !== false)
  ? 'http://geo.local'
  : 'http://mi-dominio.com';

require_once $_SERVER['DOCUMENT_ROOT'] . '/apps/geo-system/web/api/bootstrap.php';

try {

    $input = json_decode(file_get_contents('php://input'), true);

    $tenantId  = isset($input['tenant_id']) ? (int)$input['tenant_id'] : 0;
    $vehicleId = isset($input['vehicle_id']) ? (int)$input['vehicle_id'] : 0;

    if ($tenantId === 0 || $vehicleId === 0) {
        json_error('Datos incompletos');
    }

    // 🔴 obtener pedidos asignados (status = 20)
    $stmt = $pdo->prepare("
        SELECT id
        FROM orders
        WHERE tenant_id = ?
        AND vehicle_id = ?
        AND status = 20
        ORDER BY id ASC
    ");

    $stmt->execute([$tenantId, $vehicleId]);
    $orders = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!$orders) {
        json_error('No hay pedidos para cargar');
    }

    // 🔴 ejecutar flujo en background
    ignore_user_abort(true);
    set_time_limit(0);

    echo json_encode(['ok' => true, 'orders' => $orders]);
    
    // 🔥 cortar conexión HTTP (CLAVE)
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    

    // 🔥 cerrar conexión HTTP rápido
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    // 🔴 loop de carga
    foreach ($orders as $i => $orderId) {

        if ($i > 0) {
            sleep(60); // ⏳ 1 minuto entre cargas
        }

        callLoad($orderId);
    }

} catch (Throwable $e) {
    json_error('Error interno');
}

// 🔴 función LOAD
function callLoad($orderId) {

    $url = $BASE_URL . '/apps/geo-system/web/api/operations/orders/order_mark_loaded_test.php';

    $data = json_encode([
        'order_id' => (int)$orderId
    ]);

    $opts = [
        'http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json",
            'content' => $data,
            'timeout' => 10
        ]
    ];

    $context = stream_context_create($opts);

    @file_get_contents($url, false, $context);
}