<?php

$BASE_URL = (strpos($_SERVER['HTTP_HOST'], 'geo.local') !== false)
  ? 'http://geo.local'
  : 'http://mi-dominio.com';

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

try {

    $tenantId = 1;

    // 🔹 JSON (ajustar ruta si hace falta)
    $jsonPath = __DIR__ . '/simu_viaje_120.json';

    if (!file_exists($jsonPath)) {
        throw new Exception('JSON no encontrado');
    }

    $data = json_decode(file_get_contents($jsonPath), true);

    if (!$data || !is_array($data)) {
        throw new Exception('JSON inválido');
    }

    // 🔹 obtener puntos delivery
    $deliveries = [];

    foreach ($data as $p) {
        if (isset($p['type']) && $p['type'] === 'delivery') {
            $deliveries[] = $p;
        }
    }

    if (count($deliveries) === 0) {
        throw new Exception('No hay puntos delivery');
    }

    // 🔹 limitar a 3
    $deliveries = array_slice($deliveries, 0, 3);

    // 🔹 customers aleatorios
    $stmt = $pdo->prepare("
        SELECT id 
        FROM customers 
        WHERE tenant_id = ? AND active = 1
        ORDER BY RAND()
        LIMIT " . count($deliveries)
    );
    $stmt->execute([$tenantId]);

    $customers = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (count($customers) < count($deliveries)) {
        throw new Exception('No hay suficientes customers');
    }

    $created = [];

    foreach ($deliveries as $i => $d) {

        $customerId = $customers[$i];

        // 🔹 company aleatoria
        $stmt = $pdo->prepare("
            SELECT id 
            FROM companies 
            WHERE tenant_id = ? AND active = 1
            ORDER BY RAND()
            LIMIT 1
        ");
        $stmt->execute([$tenantId]);

        $companyId = $stmt->fetchColumn();

        if (!$companyId) {
            throw new Exception('No hay companies');
        }

        $lat = $d['lat'];
        $lng = $d['lng'];

        $address = "Simulación " . ($i + 1);

        // 🔹 llamar endpoint create
        $payload = json_encode([
            'company_id' => $companyId,
            'customer_id' => $customerId,
            'address' => $address,
            'lat' => $lat,
            'lng' => $lng
        ]);

        $ch = curl_init($BASE_URL . '/apps/geo-system/web/api/operations/orders/entry/order_create_test.php');

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

        $response = curl_exec($ch);

        if ($response === false) {
            throw new Exception('Error CURL');
        }

        $respData = json_decode($response, true);

        if (!isset($respData['data']['order_id'])) {
            throw new Exception('Error creando pedido');
        }

        $created[] = $respData['data']['order_id'];
    }

    echo json_encode([
        'ok' => true,
        'orders_created' => $created
    ]);

} catch (Throwable $e) {

    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage()
    ]);
}