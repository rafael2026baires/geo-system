<?php

// --------------------------------------------------------------
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/services/TechStateService.php';
require_once __DIR__ . '/services/RealtimePositionService.php';
require_once __DIR__ . '/services/BaseLocationService.php';
require_once __DIR__ . '/services/ClientZoneService.php';

$config = require __DIR__ . '/../../../config/tech_state.php';
$techService = new TechStateService($config);

require_once __DIR__ . '/../../../config/redis.php';
$redis = getRedis();
$useRedis = $redis !== null;

session_start();

$tenantId = $_SESSION['tenant_id'] ?? null;
$filterVehicleId = isset($_GET['vehicle_id'])
    ? (int)$_GET['vehicle_id']
    : null;


if (!$tenantId) {
    echo json_encode(['units' => []]);
    exit;
}

$baseLat    = $_SESSION['default_lat'] ?? 0;
$baseLng    = $_SESSION['default_lng'] ?? 0;
$baseRadius = $_SESSION['base_radius_m'] ?? 100;
$now = time();


$gridLogFile = __DIR__ . '/../../../logs/grid_context_test.log';
function gridTestLog($msg) {
    global $gridLogFile;
    error_log(date('Y-m-d H:i:s') . ' ' . $msg . PHP_EOL, 3, $gridLogFile);
}
  
// -------------------------------   nuevo      ---------------------------------------
// ------------------------------- CONTEXTO GRID CACHEADO EN REDIS ---------------------------------------

$ordersMap = [];
$activeMap = [];
$unitIdDbMap = [];
$vehicleMetaMap = [];

$gridContextKey = "grid_context:" . (int)$tenantId;
$gridContextTtl = 3600;

$gridContextLoadedFromRedis = false;

if ($useRedis) {
    $gridContextRaw = $redis->get($gridContextKey);

    if ($gridContextRaw) {
        $gridContext = json_decode($gridContextRaw, true);

        if (is_array($gridContext) && isset($gridContext['vehicleMetaMap'])) {
            $ordersMap = $gridContext['ordersMap'] ?? [];
            $activeMap = $gridContext['activeMap'] ?? [];
            $unitIdDbMap = $gridContext['unitIdDbMap'] ?? [];
            $vehicleMetaMap = $gridContext['vehicleMetaMap'];

            $gridContextLoadedFromRedis = true;
            
            //gridTestLog("[GRID_CONTEXT_HIT] tenant={$tenantId}");
        }
    }
}

if (!$gridContextLoadedFromRedis) {

    gridTestLog("[GRID_CONTEXT_MISS_DB] tenant={$tenantId}");

    $stmtOrders = $pdo->prepare("
        SELECT 
        o.id,
        v.id as vehicle_id, 
        v.guy AS vehicle_type,
        v.brand AS vehicle_brand,
        v.model AS vehicle_model,
        v.patent AS vehicle_patent,
        o.status, 
        o.loaded_at AS last_loaded_at, 
        o.delivered_at AS last_delivered_at, 
        o.address,
        o.street_address,
        o.city,
        o.lat, 
        o.lng, 
        v.active, 
        d.device_uuid AS unit_id,
        o.company_id,
        o.customer_id,
        c.name AS customer_name,
        t.driver_id,
        dr.name AS driver_name,
        t.id AS trip_id,
        t.trip_code,
        t.started_at AS trip_started_at
        FROM vehicles v 
        LEFT JOIN orders o ON o.vehicle_id = v.id 
            AND o.tenant_id = v.tenant_id 
        LEFT JOIN customers c ON c.id = o.customer_id
            AND c.tenant_id = o.tenant_id
        LEFT JOIN vehicle_devices vd ON vd.vehicle_id = v.id 
        LEFT JOIN devices d ON d.id = vd.device_id
        LEFT JOIN trips t ON t.tenant_id = v.tenant_id
            AND t.vehicle_id = v.id
            AND t.active = 1
            AND t.status = 30
        LEFT JOIN drivers dr ON dr.id = t.driver_id
            AND dr.tenant_id = t.tenant_id
        WHERE v.tenant_id = ?;
    ");

    $stmtOrders->execute([(int)$tenantId]);

    $orderStatusLabels = [
        10 => 'Pendiente',
        20 => 'Asignado',
        30 => 'Cargado',
        40 => 'Entregado'
    ];

    while ($r = $stmtOrders->fetch(PDO::FETCH_ASSOC)) {
        
        $vehicleId = (int)$r['vehicle_id'];

        if (!isset($vehicleMetaMap[$vehicleId])) {
            $vehicleType = trim((string)($r['vehicle_type'] ?? ''));
            $vehicleBrand = trim((string)($r['vehicle_brand'] ?? ''));
            $vehicleModel = trim((string)($r['vehicle_model'] ?? ''));
            $vehiclePatent = trim((string)($r['vehicle_patent'] ?? ''));

            $vehicleLabelParts = array_values(array_filter([
                $vehicleType,
                $vehicleBrand,
                $vehicleModel
            ], static fn($value) => $value !== ''));

            $vehicleMetaMap[$vehicleId] = [
                'vehicle_label' => $vehiclePatent !== ''
                    ? $vehiclePatent
                    : ($vehicleLabelParts
                        ? implode(' ', $vehicleLabelParts)
                        : (string)$vehicleId),
                'vehicle_patent' => $vehiclePatent !== '' ? $vehiclePatent : null,
                'vehicle_type' => $vehicleType !== '' ? $vehicleType : null,
                'vehicle_brand' => $vehicleBrand !== '' ? $vehicleBrand : null,
                'vehicle_model' => $vehicleModel !== '' ? $vehicleModel : null,
                'driver_id' => isset($r['driver_id']) ? (int)$r['driver_id'] : null,
                'driver_name' => isset($r['driver_name']) ? (string)$r['driver_name'] : null,
                'trip_id' => isset($r['trip_id']) ? (int)$r['trip_id'] : null,
                'trip_code' => isset($r['trip_code']) ? (string)$r['trip_code'] : null,
                'trip_started_at' => isset($r['trip_started_at']) ? (string)$r['trip_started_at'] : null
            ];
        }
        
        if (!isset($ordersMap[$vehicleId])) {
            $ordersMap[$vehicleId] = [
                'P' => 0,
                'A' => 0,
                'C' => 0,
                'E' => 0,
                'last_loaded_at' => null,
                'last_delivered_at' => null,
                'clients' => []
            ];
        } 
        
        $status = (int)$r['status'];

        if ($status === 10) {
            $ordersMap[$vehicleId]['P']++;
        }
        
        if ($status === 20) {
            $ordersMap[$vehicleId]['A']++;
        }

        if ($status === 30) {
            $ordersMap[$vehicleId]['C']++;
        }

        if ($status === 40) {
            $ordersMap[$vehicleId]['E']++;
        }  
        
        if ($r['lat'] && $r['lng']) {
            $ordersMap[$vehicleId]['clients'][] = [
              'order_id' => (int)$r['id'],
              'lat' => (float)$r['lat'],
              'lng' => (float)$r['lng'],
              'status' => (int)$r['status'],
              'order_status_label' => $orderStatusLabels[$status] ?? 'Desconocido',
              'company_id' => isset($r['company_id']) ? (int)$r['company_id'] : null,
              'customer_id' => isset($r['customer_id']) ? (int)$r['customer_id'] : null,
              'customer_name' => isset($r['customer_name']) ? (string)$r['customer_name'] : null,
              'address' => isset($r['address']) ? (string)$r['address'] : null,
              'street_address' => isset($r['street_address']) ? (string)$r['street_address'] : null,
              'city' => isset($r['city']) ? (string)$r['city'] : null
            ];
        }    
        
        if ($r['last_loaded_at']) {
            $ordersMap[$vehicleId]['last_loaded_at'] = $r['last_loaded_at'];
        }

        if ($r['last_delivered_at']) {
            $ordersMap[$vehicleId]['last_delivered_at'] = $r['last_delivered_at'];
        }
        
        $activeMap[$vehicleId] = (int)$r['active'];
        $unitIdDbMap[$vehicleId] = $r['unit_id'];
    }

    if ($useRedis) {
        $redis->setex($gridContextKey, $gridContextTtl, json_encode([
            'ordersMap' => $ordersMap,
            'activeMap' => $activeMap,
            'unitIdDbMap' => $unitIdDbMap,
            'vehicleMetaMap' => $vehicleMetaMap,
            'totalVehicles' => count($activeMap),
            'cached_at' => time()
        ]));
    }
}
// -------------------------------------------------------------------------------------------------------
// DATA
$data = RealtimePositionService::getAllUnits($tenantId);

if (!$data || !isset($data['units'])) {
    echo json_encode(['units' => []]);
    exit;
}
$units = [];


foreach ($activeMap as $vehicleId => $active) {

if ($filterVehicleId !== null && (int)$vehicleId !== $filterVehicleId) {
    continue;
}
    
    $row = [];

    // buscar si hay realtime para este vehículo
    foreach ($data['units'] as $r) {
        $vid = (int)($r['vehicle_id'] ?? $r['vehicleId'] ?? 0);
        //$vid = (int)$r['vehicle_id'];    // *** probar redis
    
        if ($vid === $vehicleId) {
            $row = $r;
            break;
        }
    }
    $lat = $row['lat'] ?? null;
    $lng = $row['lng'] ?? null;
    
    //$enBase = false;
    //$enCliente = false;
    
    $unitId = $unitIdDbMap[$vehicleId] ?? null;
    if (!$unitId) continue; 
    // ---------------------------- nuevo  -------------------------------------
    $enBase = false;
    $enCliente = false;
    $distanceToClientM = null;

    if ($lat !== null && $lng !== null && $baseLat && $baseLng) {
        $fuera = BaseLocationService::isFueraDeBase(
            (float)$lat,
            (float)$lng,
            (float)$baseLat,
            (float)$baseLng,
            (float)$baseRadius
        );
        $enBase = !$fuera;
    }

    if (!$enBase && $lat !== null && $lng !== null) {
        $clientZone = ClientZoneService::resolve(
            (float)$lat,
            (float)$lng,
            $ordersMap[$vehicleId]['clients'] ?? [],
            70
        );
        $enCliente = $clientZone['in_client'];
        $distanceToClientM = $clientZone['distance_to_client_m'];
    }  
    // --------------------------------------------------------------------------
    $redisKey = "stopped_since:$unitId";

    // TELEMETRÍA / OBD OCULTA TEMPORALMENTE - V1 COMERCIAL
    /*
    $obdKey = "obd:$tenantId:$vehicleId";
    $obdRaw = $useRedis ? $redis->get($obdKey) : null;
    $obd = $obdRaw ? json_decode($obdRaw, true) : null;
    */

    $stoppedSinceRedis = $useRedis ? $redis->get($redisKey) : null;    
    
    $serverTs = isset($row['server_ts']) ? (int) floor($row['server_ts'] / 1000) : null;
    // ------------------------------  nuevo  ------------------------------------    
    $signalAge = $serverTs ? ($now - $serverTs) : null;
    // ---------------------------------------------------------------------------
    $nowServerTs = $now;
    
    $ctx = [
        'unit_id'        => $unitId,
        'now_server_ts'  => $nowServerTs,        

        'last_point' => ($row && $serverTs) ? [
            'lat' => $row['lat'],
            'lng' => $row['lng'],
            'server_ts' => $serverTs
        ] : null,

        'prev_point'     => ($row && isset($row['prev_lat'])) ? [
            'lat' => $row['prev_lat'],
            'lng' => $row['prev_lng'],
            'server_ts' => null
        ] : null,

        'stopped_since' => $stoppedSinceRedis ?: ($row['stopped_since'] ?? null),
        'is_offline' => false
    ];    

    // TODO (arquitectura):
    // Hoy tech_state se calcula en PHP.
    // Si en el futuro hay múltiples consumidores (APIs, alertas, microservicios),
    // evaluar mover tech_state a Redis para evitar duplicación de lógica.    
    if ($row && $serverTs) {
        $tech = $techService->compute($ctx);
    } else {
        // 🔴 NO recalcular, mantener último estado
        $tech = [
            'tech_state' => 'OFFLINE',
            'stopped_since' => null
        ];
    }
    
    // ---------------- SEÑAL STATE ----------------
    if ($serverTs === null || $signalAge === null) {
        $signalState = 'SIGNAL_NODATA';
    } else if ($signalAge > $config['offline_ttl_sec']) {
        $signalState = 'SIGNAL_ALERT';
    } else if ($signalAge > $config['stale_ttl_sec']) {
        $signalState = 'SIGNAL_NODATA';
    } else {
        $signalState = 'SIGNAL_OK';
    }    

    // ---------------- ACTIVITY STATE ----------------
    if ($tech['tech_state'] === 'MOVING') {
        $activityState = 'ACTIVITY_MOVING';
    } else if (
        $tech['tech_state'] === 'STOPPED' ||
        $tech['tech_state'] === 'STOPPED_MEDIUM'
    ) {
        $activityState = 'ACTIVITY_STOPPED';
    } else if ($tech['tech_state'] === 'STOPPED_LONG') {
        $activityState = 'ACTIVITY_ALERT';
    } else {
        $activityState = 'ACTIVITY_NONE';
    }    
    
    
    if ($useRedis) {
        if ($tech['tech_state'] === 'STOPPED' 
            || $tech['tech_state'] === 'STOPPED_MEDIUM' 
            || $tech['tech_state'] === 'STOPPED_LONG') {
    
            if (!$stoppedSinceRedis) {
                $redis->set($redisKey, $tech['stopped_since']);
            }
        } else {
            $redis->del($redisKey);
        }
    }   
    //-------------------------  nuevo   ----------------------------------------  
    $orders = $ordersMap[$vehicleId] ?? [
        'P' => 0,
        'A' => 0,
        'C' => 0,
        'E' => 0,
        'last_loaded_at' => null,
        'last_delivered_at' => null
    ];
    
    $P = $orders['P'] ?? 0;
    $A = $orders['A'];
    $C = $orders['C'];
    $E = $orders['E'];
    
    $in_operation = $A + $C + $E;
    $total = $in_operation;
    $pendingDelivery = $C;
    
    $lastLoadAge = $orders['last_loaded_at']
        ? $now - strtotime($orders['last_loaded_at'])
        : null;
    
    $lastDeliveryAge = $orders['last_delivered_at']
        ? $now - strtotime($orders['last_delivered_at'])
        : null;   

    $vehicleMeta = $vehicleMetaMap[$vehicleId] ?? [
        'vehicle_label' => (string)$vehicleId,
        'vehicle_patent' => null,
        'vehicle_type' => null,
        'vehicle_brand' => null,
        'vehicle_model' => null,
        'driver_id' => null,
        'driver_name' => null,
        'trip_id' => null,
        'trip_code' => null,
        'trip_started_at' => null
    ];
    // -----------------------------------------------------------------------------
    $units[] = [
        'unit_id' => $unitId,
        'vehicle_id' => $vehicleId,
        'vehicle_label' => $vehicleMeta['vehicle_label'],
        'vehicle_patent' => $vehicleMeta['vehicle_patent'],
        'vehicle_type' => $vehicleMeta['vehicle_type'],
        'vehicle_brand' => $vehicleMeta['vehicle_brand'],
        'vehicle_model' => $vehicleMeta['vehicle_model'],
        'driver_id' => $vehicleMeta['driver_id'] ?? null,
        'driver_name' => $vehicleMeta['driver_name'] ?? null,
        'trip_id' => $vehicleMeta['trip_id'] ?? null,
        'trip_code' => $vehicleMeta['trip_code'] ?? null,
        'trip_started_at' => $vehicleMeta['trip_started_at'] ?? null,
        'lat' => $lat,
        'lng' => $lng,
        'server_ts' => $serverTs,
        'now_ts' => $now,
        
        'is_visible_on_map' => ($active === 1 && !$enBase),

        // --- VISIBILIDAD / ESTADO TÉCNICO
        'active' => $active,        
        'signal_state' => $signalState,
        'activity_state' => $activityState,
        'tech_state' => $tech['tech_state'],
        'signal_age' => $signalAge,

        // --- UBICACIÓN LÓGICA
        'in_base' => $enBase,
        'in_street' => !$enBase && !$enCliente,
        'in_client' => $enCliente && !$enBase,
        'state' => $enBase ? 'base' : ($enCliente ? 'client' : 'street'),
        'distance_to_client_m' => $distanceToClientM,
        
         // --- TIEMPOS DE ESTADO (BASE / CALLE)        
        'state_since' => $serverTs,
        
        // --- PEDIDOS (CORE A/C/E) ---
        'orders_total' => $total,        
        'orders_in_operation' => $in_operation,
        'orders_assigned' => $A,
        'orders_loaded' => $C,
        'orders_delivered' => $E,
        'orders_pending_load' => $A,
        'orders_pending_delivery' => $pendingDelivery,
        
        // --- EVENTOS (NO se reinician nunca) ----------
        'last_load_age' => $lastLoadAge,
        'last_delivery_age' => $lastDeliveryAge,   
        
        'clients' => $ordersMap[$vehicleId]['clients'] ?? [],

        // TELEMETRÍA / OBD OCULTA TEMPORALMENTE - V1 COMERCIAL
        /*
        'obd' => [
            'fuel_level' => $obd['fuel_level'] ?? null,
            'rpm' => $obd['rpm'] ?? null,
            'engine_temp' => $obd['engine_temp'] ?? null,
            'odometer' => $obd['odometer'] ?? null,
            'battery_voltage' => $obd['battery_voltage'] ?? null,
            'engine_on' => $obd['engine_on'] ?? null,
            'client_ts' => $obd['client_ts'] ?? null,
            'server_ts' => $obd['server_ts'] ?? null
        ],
        */       
        
        // --- OPCIONAL (NO ahora, pero ya definido)
        //'next_trip_orders' => $nextTripCount   
        // -------------------------------------------------------------------------
    ];
}

function resolveSection($u) {
    if ($u['active'] !== 1) return 'inactive';
    if ($u['in_base']) return 'base';
    if ($u['in_client']) return 'client';
    return 'trip';
}
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
$kpiSummary = [
    'vehicles' => [
        'total' => count($activeMap),
        'active' => 0,
        'inactive' => 0,
        'in_base' => 0,
        'in_street' => 0,
        'in_client' => 0,
        // --------------------------------
        // KPI Señal
        'signal_ok' => 0,
        'signal_nodata' => 0,
        'signal_alert' => 0,  
        // --------------------------------
        // KPI Actividad
        'activity_moving' => 0,
        'activity_stopped' => 0,
        'activity_alert' => 0
        // --------------------------------

    ],
    'orders' => [        
        'in_operation' => 0,
        'assigned' => 0,
        'loaded' => 0,
        'pending_load' => 0,
        'delivered' => 0,
        'pending_delivery' => 0
    ]

    // TELEMETRÍA / OBD OCULTA TEMPORALMENTE - V1 COMERCIAL
    /*
    'telemetry' => [
        'with_obd' => 0,
        'engine_on' => 0,
        'fuel_ok' => 0,
        'fuel_low' => 0,
        'temp_ok' => 0,
        'temp_high' => 0
    ]
    */    
];

// TELEMETRÍA / OBD OCULTA TEMPORALMENTE - V1 COMERCIAL
/*
$fuelLowPct = 20;
$engineTempHigh = 100;
*/

$ordersSummary = [
    'A' => 0,
    'C' => 0,
    'E' => 0
];

foreach ($units as $u) {

    // ---------------- PEDIDOS KPI ACUMULADOS ----------------    
    $in_operation = (int)$u['orders_in_operation'];

    $A = (int)$u['orders_assigned'];   // status 20
    $C = (int)$u['orders_loaded'];     // status 30
    $E = (int)$u['orders_delivered'];  // status 40

    $ordersSummary['A'] += $A;
    $ordersSummary['C'] += $C;
    $ordersSummary['E'] += $E;

    $assignedKpi = $A + $C + $E;
    $loadedKpi = $C + $E;
    $deliveredKpi = $E;

    $pendingLoadKpi = $assignedKpi - $loadedKpi;
    $pendingDeliveryKpi = $loadedKpi - $deliveredKpi;
    
    $kpiSummary['orders']['in_operation'] += $in_operation;
    $kpiSummary['orders']['assigned'] += $assignedKpi;
    $kpiSummary['orders']['loaded'] += $loadedKpi;
    $kpiSummary['orders']['pending_load'] += $pendingLoadKpi;
    $kpiSummary['orders']['delivered'] += $deliveredKpi;
    $kpiSummary['orders']['pending_delivery'] += $pendingDeliveryKpi;

    // Desde acá, solo vehículos activos
    if ((int)$u['active'] !== 1) {
        $kpiSummary['vehicles']['inactive']++;
        continue;
    }

    // ---------------- VEHÍCULOS ----------------
    $kpiSummary['vehicles']['active']++;

    if (!empty($u['in_base'])) {
        $kpiSummary['vehicles']['in_base']++;
    } else if (!empty($u['in_client'])) {
        $kpiSummary['vehicles']['in_client']++;
    } else {
        $kpiSummary['vehicles']['in_street']++;
    }

    if ($u['activity_state'] === 'ACTIVITY_MOVING') {
        $kpiSummary['vehicles']['activity_moving']++;
    }

    if ($u['activity_state'] === 'ACTIVITY_STOPPED') {
        $kpiSummary['vehicles']['activity_stopped']++;
    }

    if ($u['activity_state'] === 'ACTIVITY_ALERT') {
        $kpiSummary['vehicles']['activity_alert']++;
    }
    // --------------------------------------------------------

    if ($u['signal_state'] === 'SIGNAL_OK') {
        $kpiSummary['vehicles']['signal_ok']++;
    }

    if ($u['signal_state'] === 'SIGNAL_NODATA') {
        $kpiSummary['vehicles']['signal_nodata']++;
    }

    if ($u['signal_state'] === 'SIGNAL_ALERT') {
        $kpiSummary['vehicles']['signal_alert']++;
    }

    
    // TELEMETRÍA / OBD OCULTA TEMPORALMENTE - V1 COMERCIAL
    /*
    // ---------------- TELEMETRÍA ----------------
    $obd = $u['obd'] ?? null;

    if (is_array($obd) && !empty($obd['server_ts'])) {
        $kpiSummary['telemetry']['with_obd']++;

        if (!empty($obd['engine_on'])) {
            $kpiSummary['telemetry']['engine_on']++;
        }

        if ($obd['fuel_level'] !== null) {
            if ((float)$obd['fuel_level'] <= $fuelLowPct) {
                $kpiSummary['telemetry']['fuel_low']++;
            } else {
                $kpiSummary['telemetry']['fuel_ok']++;
            }
        }

        if ($obd['engine_temp'] !== null) {
            if ((float)$obd['engine_temp'] >= $engineTempHigh) {
                $kpiSummary['telemetry']['temp_high']++;
            } else {
                $kpiSummary['telemetry']['temp_ok']++;
            }
        }        
    }
    */    
    
}

// ----------------------------------------------------------------------------------------------------
// Compatibilidad temporal con gráficos actuales
$summary = [
    'idle' => $kpiSummary['vehicles']['in_base'],
    'delivering' => $kpiSummary['vehicles']['in_street'],
    'client' => $kpiSummary['vehicles']['in_client'],    
    'inactive' => $kpiSummary['vehicles']['inactive']
];
// -----------------------------------------------------------------------------------------------------    
$totalVehicles = count($activeMap);
// ------------------------------------------------------------------
// órden del vector
usort($units, function($a, $b) {
    // activos primero
    if ($a['active'] !== $b['active']) {
        return $b['active'] <=> $a['active'];
    }
    
    // opcional: ordenar por vehicle_id
    return $a['vehicle_id'] <=> $b['vehicle_id'];
});
// ------------------------------------------------------------------
echo json_encode([
    'units' => $units,
    'kpi_summary' => $kpiSummary,
    'summary' => $summary,
    'orders_summary' => $ordersSummary,
    'total_vehicles' => $totalVehicles,
    'base' => [
        'lat' => $baseLat,
        'lng' => $baseLng
    ]    
]);
