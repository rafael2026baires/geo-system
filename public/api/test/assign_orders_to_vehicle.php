<?php

$BASE_URL = (strpos($_SERVER['HTTP_HOST'], 'geo.local') !== false)
  ? 'http://geo.local'
  : 'http://mi-dominio.com';

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

try {

    $tenantId = 1;
    $vehicleId = 2;

    // 🔹 buscar últimos pedidos en status 10
    $stmt = $pdo->prepare("
        SELECT id
        FROM orders
        WHERE tenant_id = ?
        AND status = 10
        ORDER BY id DESC
        LIMIT 3
    ");
    $stmt->execute([$tenantId]);

    $orders = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (count($orders) === 0) {
        throw new Exception('No hay pedidos para asignar');
    }

    $assigned = [];

    foreach ($orders as $orderId) {

        $payload = json_encode([
            'order_id' => $orderId,
            'vehicle_id' => $vehicleId
        ]);
  
        $ch = curl_init($BASE_URL . '/apps/geo-system/web/api/operations/orders/order_assign_test.php');

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

        $response = curl_exec($ch);

        if ($response === false) {
            throw new Exception('Error CURL');
        }

        $respData = json_decode($response, true);

        if (!isset($respData['ok']) || $respData['ok'] !== true) {
            //throw new Exception('Error asignando pedido ' . $orderId);
            $result[] = [
            'order_id' => $orderId,
            'error' => $response
        ];
        continue;
        }
        $assigned[] = $orderId;
    }

    echo json_encode([
        'ok' => true,
        'orders_assigned' => $assigned
    ]);

} catch (Throwable $e) {

    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}