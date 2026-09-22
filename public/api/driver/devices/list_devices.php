<?php

require_once __DIR__ . '/../bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
}

$tenantId = driver_session_tenant_id();
driver_require_permission('driver.devices.ver');

try {
    driver_expire_pending_activations($pdo, $tenantId);

    $query = $pdo->prepare(
        'SELECT d.id AS device_id, d.device_uuid, d.active, d.brand, d.model,
                d.app_version, a.id AS activation_id, a.vehicle_id AS target_vehicle_id,
                tv.patent AS target_vehicle_patent, dr.name AS recipient_name,
                a.replaces_device_id, replaced.device_uuid AS replaces_device_uuid,
                a.status AS activation_status,
                a.created_at AS activation_created_at, a.expires_at, a.delivery_started_at,
                a.sent_at, a.used_at,
                (a.expires_at <= NOW()) AS expired,
                (SELECT vd.vehicle_id FROM vehicle_devices vd
                 INNER JOIN vehicles v ON v.id = vd.vehicle_id AND v.tenant_id = d.tenant_id
                 WHERE vd.device_id = d.id ORDER BY vd.vehicle_id LIMIT 1) AS effective_vehicle_id,
                (SELECT v.patent FROM vehicle_devices vd
                 INNER JOIN vehicles v ON v.id = vd.vehicle_id AND v.tenant_id = d.tenant_id
                 WHERE vd.device_id = d.id ORDER BY vd.vehicle_id LIMIT 1) AS effective_vehicle_patent
                ,(SELECT COUNT(*) FROM vehicle_devices vd
                  INNER JOIN vehicles v ON v.id = vd.vehicle_id AND v.tenant_id = d.tenant_id
                  WHERE vd.device_id = d.id) AS effective_vehicle_count
                ,ra.device_id AS replacement_device_id,
                rd.device_uuid AS replacement_device_uuid,
                ra.status AS replacement_status,
                ra.expires_at AS replacement_expires_at,
                ra.delivery_started_at AS replacement_delivery_started_at,
                ra.sent_at AS replacement_sent_at
         FROM devices d
         INNER JOIN device_activations a ON a.id = (
             SELECT a2.id FROM device_activations a2
             WHERE a2.device_id = d.id
             ORDER BY a2.created_at DESC, a2.id DESC LIMIT 1
         )
         LEFT JOIN vehicles tv ON tv.id = a.vehicle_id AND tv.tenant_id = d.tenant_id
         LEFT JOIN drivers dr ON dr.id = a.driver_id AND dr.tenant_id = d.tenant_id
         LEFT JOIN devices replaced ON replaced.id = a.replaces_device_id
         LEFT JOIN device_activations ra ON ra.id = (
             SELECT ra2.id FROM device_activations ra2
             WHERE ra2.replaces_device_id = d.id
             ORDER BY ra2.created_at DESC, ra2.id DESC LIMIT 1
         )
         LEFT JOIN devices rd ON rd.id = ra.device_id AND rd.tenant_id = d.tenant_id
         WHERE d.tenant_id = ? ORDER BY d.id DESC'
    );
    $query->execute([$tenantId]);
    $rows = $query->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        $row['device_id'] = (int)$row['device_id'];
        $row['enabled'] = (int)$row['active'] === 1;
        if ($row['activation_id'] !== null) {
            $row['activation_id'] = (int)$row['activation_id'];
        }
        foreach (['target_vehicle_id', 'effective_vehicle_id', 'replaces_device_id', 'replacement_device_id'] as $field) {
            if ($row[$field] !== null) {
                $row[$field] = (int)$row[$field];
            }
        }
        $row['effective_vehicle_count'] = (int)$row['effective_vehicle_count'];
        $status = $row['activation_status'];
        $row['administrative_status'] = $status === null ? 'NO_ACTIVATION'
            : ($status === 'USED' ? 'ACTIVATED'
            : ($status === 'CANCELLED' ? 'CANCELLED'
            : ($status === 'EXPIRED' || (int)$row['expired'] === 1 ? 'EXPIRED'
            : ($row['sent_at'] !== null ? 'SENT_PENDING_ACTIVATION'
            : ($row['delivery_started_at'] !== null ? 'DELIVERY_STARTED_PENDING_CONFIRMATION' : 'PENDING_SEND')))));
        $replacementStatus = $row['replacement_status'];
        $row['replacement_administrative_status'] = $replacementStatus === null ? null
            : ($replacementStatus === 'USED' ? 'ACTIVATED'
            : ($replacementStatus === 'CANCELLED' ? 'CANCELLED'
            : ($replacementStatus === 'EXPIRED'
                || strtotime((string)$row['replacement_expires_at']) <= time() ? 'EXPIRED'
            : ($row['replacement_sent_at'] !== null ? 'SENT_PENDING_ACTIVATION'
            : ($row['replacement_delivery_started_at'] !== null
                ? 'DELIVERY_STARTED_PENDING_CONFIRMATION' : 'PENDING_SEND')))));
        unset($row['active'], $row['expired'], $row['activation_status']);
        unset($row['replacement_status'], $row['replacement_expires_at']);
    }
    unset($row);

    driver_response(200, ['success' => true, 'data' => $rows]);
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo listar los dispositivos.');
}
