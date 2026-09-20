<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.activacion.crear');

try {
    $currentActivation = driver_current_activation_condition('current_a');
    $query = $pdo->prepare(
        "SELECT v.id, v.guy, v.brand, v.model, v.patent
         FROM vehicles v
         WHERE v.tenant_id = ? AND v.enabled = 1
           AND NOT EXISTS (
               SELECT 1
               FROM device_activations current_a
               INNER JOIN devices current_d ON current_d.id = current_a.device_id
               WHERE current_a.vehicle_id = v.id
                 AND current_d.tenant_id = v.tenant_id
                 AND $currentActivation
           )
         ORDER BY v.id"
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
