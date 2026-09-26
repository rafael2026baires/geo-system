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
                ,(SELECT regular_driver.name
                  FROM vehicle_devices current_vd
                  INNER JOIN vehicle_regular_driver_assignments regular_assignment
                    ON regular_assignment.tenant_id = d.tenant_id
                   AND regular_assignment.vehicle_id = current_vd.vehicle_id
                   AND regular_assignment.ended_at IS NULL
                  INNER JOIN drivers regular_driver
                    ON regular_driver.id = regular_assignment.driver_id
                   AND regular_driver.tenant_id = regular_assignment.tenant_id
                  WHERE current_vd.device_id = d.id
                  ORDER BY regular_assignment.assigned_at DESC, regular_assignment.id DESC
                  LIMIT 1) AS regular_driver_name
                ,EXISTS(
                    SELECT 1 FROM device_activations used_activation
                    WHERE used_activation.device_id = d.id
                      AND used_activation.status = \'USED\'
                ) AS has_used_activation
                ,EXISTS(
                    SELECT 1 FROM device_activations pending_activation
                    WHERE pending_activation.device_id = d.id
                      AND pending_activation.status = \'PENDING\'
                      AND pending_activation.expires_at > NOW()
                ) AS has_pending_activation
                ,EXISTS(
                    SELECT 1 FROM device_activations completed_replacement
                    WHERE completed_replacement.replaces_device_id = d.id
                      AND completed_replacement.status = \'USED\'
                ) AS has_completed_replacement
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
         WHERE d.tenant_id = ?
         ORDER BY d.id DESC'
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
        $row['has_used_activation'] = (int)$row['has_used_activation'] === 1;
        $row['has_pending_activation'] = (int)$row['has_pending_activation'] === 1;
        $row['has_completed_replacement'] = (int)$row['has_completed_replacement'] === 1;
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
        $pendingReplacementStatuses = [
            'PENDING_SEND',
            'DELIVERY_STARTED_PENDING_CONFIRMATION',
            'SENT_PENDING_ACTIVATION',
        ];
        $row['activation_flow'] = $row['administrative_status'] !== 'ACTIVATED'
            && $row['has_used_activation']
            ? 'REACTIVATION'
            : ($row['replaces_device_id'] !== null ? 'REPLACEMENT' : 'INITIAL');
        $row['availability_status'] = $row['enabled'] && $row['has_used_activation']
            ? 'AVAILABLE' : 'UNAVAILABLE';
        $isUnlinkedInactive = !$row['enabled'] && $row['effective_vehicle_count'] === 0;
        $isAbandonedReplacement = !$row['has_used_activation']
            && !$row['has_pending_activation']
            && $row['replaces_device_id'] !== null
            && in_array($status, ['CANCELLED', 'EXPIRED'], true);
        $row['lifecycle_status'] = $isUnlinkedInactive
            && ($row['has_completed_replacement'] || $isAbandonedReplacement)
            ? 'HISTORICAL' : 'CURRENT';
        if (!$row['enabled']) {
            $row['situation'] = 'DISABLED';
        } elseif (in_array($row['replacement_administrative_status'], $pendingReplacementStatuses, true)) {
            $row['situation'] = 'PENDING_REPLACEMENT';
        } elseif ($row['activation_flow'] === 'REACTIVATION'
            && in_array($row['administrative_status'], $pendingReplacementStatuses, true)) {
            $row['situation'] = 'REACTIVATION_PENDING';
        } elseif ($row['activation_flow'] === 'REACTIVATION'
            && $row['administrative_status'] === 'CANCELLED') {
            $row['situation'] = 'REACTIVATION_CANCELLED';
        } elseif ($row['activation_flow'] === 'REACTIVATION'
            && $row['administrative_status'] === 'EXPIRED') {
            $row['situation'] = 'REACTIVATION_EXPIRED';
        } elseif ($row['administrative_status'] === 'CANCELLED') {
            $row['situation'] = 'ACTIVATION_CANCELLED';
        } elseif ($row['administrative_status'] === 'EXPIRED') {
            $row['situation'] = 'ACTIVATION_EXPIRED';
        } elseif (in_array($row['administrative_status'], $pendingReplacementStatuses, true)) {
            $row['situation'] = 'PENDING_ACTIVATION';
        } elseif ($row['has_used_activation']) {
            $row['situation'] = $row['effective_vehicle_count'] > 0
                ? 'READY_TO_OPERATE' : 'NO_VEHICLE';
        } else {
            $row['situation'] = null;
        }
        unset($row['active'], $row['expired'], $row['activation_status']);
        unset($row['has_pending_activation'], $row['has_completed_replacement']);
        unset($row['replacement_status'], $row['replacement_expires_at']);
    }
    unset($row);

    driver_response(200, ['success' => true, 'data' => $rows]);
} catch (Throwable $e) {
    driver_error(500, 'INTERNAL_ERROR', 'No se pudo listar los dispositivos.');
}
