<?php

$BASE_URL = (strpos($_SERVER['HTTP_HOST'], 'geo.local') !== false)
  ? 'http://geo.local'
  : 'http://mi-dominio.com';

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

try {

    $tenantId = 1;

    // 🔹 traer UN pedido ASSIGNED
    $stmt = $pdo->prepare("
        SELECT id
        FROM orders
        WHERE tenant_id = ?
        AND status = 20
        ORDER BY id ASC
        LIMIT 1
    ");
    $stmt->execute([$tenantId]);

    $orderId = $stmt->fetchColumn();

    if (!$orderId) {
        throw new Exception('No hay pedidos en estado ASSIGNED');
    }

    $payload = json_encode([
        'order_id' => $orderId
    ]);

    $ch = curl_init($BASE_URL . '/apps/geo-system/web/api/operations/orders/order_mark_loaded_test.php');

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

    $response = curl_exec($ch);

    echo json_encode([
        'order_id' => $orderId,
        'response' => json_decode($response, true)
    ], JSON_PRETTY_PRINT);

} catch (Throwable $e) {

    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}