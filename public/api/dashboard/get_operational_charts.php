<?php

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../../config/redis.php';

session_start();

header('Content-Type: application/json; charset=utf-8');

$tenantId = $_SESSION['tenant_id'] ?? null;

if (!$tenantId) {
    $tenantId = 1; // SOLO TEST LOCAL
}

if (!$tenantId) {
    echo json_encode([
        'ok' => false,
        'error' => 'NO_TENANT',
        'period' => null,
        'labels' => [],
        'series' => [
            'loaded_rhythm' => [],
            'loaded_accumulated' => [],
            'delivered_rhythm' => [],
            'delivered_accumulated' => []
        ]        
    ]);
    exit;
}


// ------------------------------------------------------
// Config V1 hardcodeada, pero fácil de parametrizar luego
// ------------------------------------------------------
/*
$windowHours = 4;
$intervalMinutes = 15;
$cacheTtl = 60;
*/

$intervalMinutes = 1;
$cacheTtl = 5;

$bucketSeconds = $intervalMinutes * 60;

$toTs = time();
$fromTs = $toTs - (30 * 60); // últimos 30 minutos

$from = date('Y-m-d H:i:00', $fromTs);
$to   = date('Y-m-d H:i:00', $toTs);

$rangeStartTime = date('H:i', $fromTs);
$rangeEndTime   = date('H:i', $toTs);

$nowTs = time();
$currentBucketTs = floor($nowTs / $bucketSeconds) * $bucketSeconds;
// ------------------------------------------------------
$redisKey = "dashboard_operational_charts_live:" . (int)$tenantId;
// ------------------------------------------------------
// Redis HIT
// ------------------------------------------------------
try {    
    $redis = getRedis();

    $cached = $redis->get($redisKey);

    if ($cached) {
        echo $cached;
        exit;
    }
} catch (Throwable $e) {
    $redis = null;
}

// ------------------------------------------------------
// Armar tramos base
// ------------------------------------------------------
$labels = [];

$loadedRhythm = [];
$deliveredRhythm = [];

$bucketMap = [];

$startBucketTs = floor($fromTs / $bucketSeconds) * $bucketSeconds;
$endBucketTs = floor($toTs / $bucketSeconds) * $bucketSeconds;

for ($ts = $startBucketTs; $ts <= $endBucketTs; $ts += $bucketSeconds) {
    $bucketKey = date('Y-m-d H:i:00', $ts);
    $label = date('H:i', $ts);

    $isFuture = $ts > $currentBucketTs;

    $labels[] = $label;

    $loadedRhythm[] = $isFuture ? null : 0;
    $deliveredRhythm[] = $isFuture ? null : 0;

    $bucketMap[$bucketKey] = count($labels) - 1;
}

// ------------------------------------------------------
// MySQL: traer entregas crudas y agrupar en PHP
// ------------------------------------------------------
$stmt = $pdo->prepare("
                SELECT status, loaded_at, delivered_at
                FROM orders
                WHERE tenant_id = :tenantId
                AND status IN (30, 40)
                ORDER BY COALESCE(loaded_at, delivered_at) ASC
");

$stmt->execute([
    ':tenantId' => (int)$tenantId
]);

$initialLoadedAccumulated = 0;
$initialDeliveredAccumulated = 0;

$loadTargetTotal = 0;
$deliveryTargetTotal = 0;

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

    $status = (int)$row['status'];

    if ($status === 30 || $status === 40) {
        $loadTargetTotal++;
        $deliveryTargetTotal++;
    }
    // ---------------- CARGAS ----------------
    if (!empty($row['loaded_at'])) {
        $loadedTs = strtotime($row['loaded_at']);

        if ($loadedTs) {
            if ($loadedTs < $fromTs) {
                $initialLoadedAccumulated++;
            } else if ($loadedTs <= $toTs) {
                $bucketTs = floor($loadedTs / $bucketSeconds) * $bucketSeconds;
                $bucketKey = date('Y-m-d H:i:00', $bucketTs);

                if (isset($bucketMap[$bucketKey])) {
                    $loadedRhythm[$bucketMap[$bucketKey]]++;
                }
            }
        }
    }

    // ---------------- ENTREGAS ----------------
    if ($status === 40 && !empty($row['delivered_at'])) {
        $deliveredTs = strtotime($row['delivered_at']);

        if ($deliveredTs) {
            if ($deliveredTs < $fromTs) {
                $initialDeliveredAccumulated++;
            } else if ($deliveredTs <= $toTs) {
                $bucketTs = floor($deliveredTs / $bucketSeconds) * $bucketSeconds;
                $bucketKey = date('Y-m-d H:i:00', $bucketTs);

                if (isset($bucketMap[$bucketKey])) {
                    $deliveredRhythm[$bucketMap[$bucketKey]]++;
                }
            }
        }
    }
}

// ------------------------------------------------------
// Acumulado
// ------------------------------------------------------
$loadedAccumulated = [];
$runningLoadedTotal = $initialLoadedAccumulated;

foreach ($loadedRhythm as $value) {
    if ($value === null) {
        $loadedAccumulated[] = null;
        continue;
    }

    $runningLoadedTotal += (int)$value;
    $loadedAccumulated[] = $runningLoadedTotal;
}

$deliveredAccumulated = [];
$runningDeliveredTotal = $initialDeliveredAccumulated;

foreach ($deliveredRhythm as $value) {
    if ($value === null) {
        $deliveredAccumulated[] = null;
        continue;
    }

    $runningDeliveredTotal += (int)$value;
    $deliveredAccumulated[] = $runningDeliveredTotal;
}
// ------------------------------------------------------
// Respuesta final
// ------------------------------------------------------
$response = [
    'ok' => true,
    'source' => 'mysql',
    'period' => [
        'from' => $from,
        'to' => $to,
        'range_start_time' => $rangeStartTime,
        'range_end_time' => $rangeEndTime,
        'interval_minutes' => $intervalMinutes
    ],
    'labels' => $labels,
    'series' => [
        'loaded_rhythm' => $loadedRhythm,
        'loaded_accumulated' => $loadedAccumulated,
        'delivered_rhythm' => $deliveredRhythm,
        'delivered_accumulated' => $deliveredAccumulated
    ],    
    'targets' => [
        'load_total' => $loadTargetTotal,
        'delivery_total' => $deliveryTargetTotal
    ],       
    'cached_at' => date('Y-m-d H:i:s')
];

$json = json_encode($response);

// ------------------------------------------------------
// Redis SET
// ------------------------------------------------------
if ($redis) {
    try {
        $redis->setex($redisKey, $cacheTtl, $json);
    } catch (Throwable $e) {
        // No bloquea la respuesta
    }
}

echo $json;
