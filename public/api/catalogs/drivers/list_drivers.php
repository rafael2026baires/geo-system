<?php

require_once __DIR__ . '/../../bootstrap.php';
require_once __DIR__ . '/../../driver/bootstrap.php';

try {

    session_start();
    
    $tenantId = $_SESSION['tenant_id'] ?? null;
    
    if (!$tenantId) {
        json_error('No autorizado', 401);
    }

    $currentActivation = driver_current_activation_condition('current_a');
    $laterCurrentActivation = driver_current_activation_condition('later_a');
    $stmt = $pdo->prepare("
        SELECT dr.id, dr.name, dr.dni, dr.phone, dr.email, dr.notes,
               COALESCE(current_counts.current_activation_count, 0) AS current_activation_count
        FROM drivers dr
        LEFT JOIN (
            SELECT current_a.driver_id, current_d.tenant_id, COUNT(*) AS current_activation_count
            FROM device_activations current_a
            INNER JOIN devices current_d ON current_d.id = current_a.device_id
            WHERE current_a.driver_id IS NOT NULL
              AND $currentActivation
              AND NOT EXISTS (
                  SELECT 1 FROM device_activations later_a
                  WHERE later_a.device_id = current_a.device_id
                    AND $laterCurrentActivation
                    AND (later_a.created_at > current_a.created_at
                         OR (later_a.created_at = current_a.created_at AND later_a.id > current_a.id))
              )
            GROUP BY current_a.driver_id, current_d.tenant_id
        ) current_counts
          ON current_counts.driver_id = dr.id
         AND current_counts.tenant_id = dr.tenant_id
        WHERE dr.tenant_id = ?
          AND dr.active = 1
        ORDER BY dr.name
    ");

    $stmt->execute([$tenantId]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$row) {
        $row['current_activation_count'] = (int)$row['current_activation_count'];
    }
    unset($row);

    json_ok($rows);

} catch (Throwable $e) {

    json_error('Error interno');

}
