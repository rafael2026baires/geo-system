<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.crear');

try {
    $query = $pdo->prepare(
        'SELECT id, guy, brand, model, patent
         FROM vehicles
         WHERE tenant_id = ? AND enabled = 1
         ORDER BY id'
    );
    $query->execute([$tenantId]);
    $vehicles = $query->fetchAll(PDO::FETCH_ASSOC);
    foreach ($vehicles as &$vehicle) {
        $vehicle['id'] = (int)$vehicle['id'];
    }
    unset($vehicle);

    driver_response(200, ['success' => true, 'data' => $vehicles]);
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo cargar el catálogo de vehículos.');
}
