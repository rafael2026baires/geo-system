<?php
// --------------------- configuración sql  -----------------------
/*
orders:
 PENDING = 10
 ASSIGNED = 20
 LOADED = 30
 DELIVERED = 40
 CANCELLED = 50
---------------------
order_assignments:
 ACTIVE = 1
 LOADED = 30
 SUPERSEDED = 50
---------------------
trips:
 PLANNED = 10
 IN_PROGRESS = 30 
 COMPLETED = 40
 CANCELLED = 50
*/
// --------------------------------------------------------------
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/services/TechStateService.php';
require_once __DIR__ . '/services/RealtimePositionService.php';
require_once __DIR__ . '/services/BaseLocationService.php';

$config = require __DIR__ . '/../../../config/tech_state.php';
$techService = new TechStateService($config);

require_once __DIR__ . '/../../../config/redis.php';
$redis = getRedis();
$useRedis = $redis !== null;

session_start();

$tenantId = $_SESSION['tenant_id'] ?? null;

if (!$tenantId) {
    echo json_encode(['units' => []]);
    exit;
}

$baseLat    = $_SESSION['default_lat'] ?? 0;
$baseLng    = $_SESSION['default_lng'] ?? 0;
$baseRadius = $_SESSION['base_radius_m'] ?? 100;
$now = time();

/*
$gridLogFile = 'C:/xampp/htdocs/apps/geo-system/grid_context_test.log';
function gridTestLog($msg) {
    global $gridLogFile;
    error_log(date('Y-m-d H:i:s') . ' ' . $msg . PHP_EOL, 3, $gridLogFile);
}
*/    
// -------------------------------   nuevo      ---------------------------------------
// ------------------------------- CONTEXTO GRID CACHEADO EN REDIS ---------------------------------------

$ordersMap = [];
$activeMap = [];
$unitIdDbMap = [];

$gridContextKey = "grid_context:" . (int)$tenantId;
$gridContextTtl = 3600;

$gridContextLoadedFromRedis = false;

if ($useRedis) {
    $gridContextRaw = $redis->get($gridContextKey);

    if ($gridContextRaw) {
        $gridContext = json_decode($gridContextRaw, true);

        if (is_array($gridContext)) {
            $ordersMap = $gridContext['ordersMap'] ?? [];
            $activeMap = $gridContext['activeMap'] ?? [];
            $unitIdDbMap = $gridContext['unitIdDbMap'] ?? [];

            $gridContextLoadedFromRedis = true;
            
            //gridTestLog("[GRID_CONTEXT_HIT] tenant={$tenantId}");
        }
    }
}

if (!$gridContextLoadedFromRedis) {

    //gridTestLog("[GRID_CONTEXT_MISS_DB] tenant={$tenantId}");

    $stmtOrders = $pdo->prepare("
        SELECT 
        o.id,
        v.id as vehicle_id, 
        o.status, 
        o.loaded_at AS last_loaded_at, 
        o.delivered_at AS last_delivered_at, 
        o.lat, 
        o.lng, 
        v.active, 
        d.device_uuid AS unit_id 
        FROM vehicles v 
        LEFT JOIN orders o ON o.vehicle_id = v.id 
            AND o.tenant_id = v.tenant_id 
        LEFT JOIN vehicle_devices vd ON vd.vehicle_id = v.id 
        LEFT JOIN devices d ON d.id = vd.device_id 
        WHERE v.tenant_id = ?;
    ");

    $stmtOrders->execute([(int)$tenantId]);

    while ($r = $stmtOrders->fetch(PDO::FETCH_ASSOC)) {
        
        $vehicleId = (int)$r['vehicle_id'];
        
        if (!isset($ordersMap[$vehicleId])) {
            $ordersMap[$vehicleId] = [
                'A' => 0,
                'C' => 0,
                'E' => 0,
                'last_loaded_at' => null,
                'last_delivered_at' => null,
                'clients' => []
            ];
        } 
        
        $status = (int)$r['status'];
        
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
                'lat' => (float)$r['lat'],
                'lng' => (float)$r['lng'],
                'status' => (int)$r['status']
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
    
    $enBase = false;
    $enCliente = false;
    
    $unitId = $unitIdDbMap[$vehicleId] ?? null;
    if (!$unitId) continue; 
    // ---------------------------- nuevo  -------------------------------------
    $enBase = false;
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
    // --------------------------------------------------------------------------
    $redisKey = "stopped_since:$unitId";

    $obdKey = "obd:$tenantId:$vehicleId";
    $obdRaw = $useRedis ? $redis->get($obdKey) : null;
    $obd = $obdRaw ? json_decode($obdRaw, true) : null;

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
        'A' => 0,
        'C' => 0,
        'E' => 0,
        'last_loaded_at' => null,
        'last_delivered_at' => null
    ];
    
    $A = $orders['A'];
    $C = $orders['C'];
    $E = $orders['E'];
    
    $total = $A + $C + $E;
    $pendingDelivery = $total - $E;
    
    $lastLoadAge = $orders['last_loaded_at']
        ? $now - strtotime($orders['last_loaded_at'])
        : null;
    
    $lastDeliveryAge = $orders['last_delivered_at']
        ? $now - strtotime($orders['last_delivered_at'])
        : null;   
    // -----------------------------------------------------------------------------
    $units[] = [
        'unit_id' => $unitId,
        'vehicle_id' => $vehicleId,
        'lat' => $lat,
        'lng' => $lng,
        'server_ts' => $serverTs,
        'now_ts' => $now,
        
        'is_visible_on_map' => ($active === 1 && !$enBase),

        // --- VISIBILIDAD / ESTADO TÉCNICO
        'active' => $active,
        'tech_state' => $tech['tech_state'],
        'signal_age' => $signalAge,

        // --- UBICACIÓN LÓGICA
        'in_base' => $enBase,
        'in_street' => !$enBase && !$enCliente,
        'in_client' => $enCliente && !$enBase,
        'state' => $enBase ? 'base' : ($enCliente ? 'client' : 'street'),
        
         // --- TIEMPOS DE ESTADO (BASE / CALLE)        
        'state_since' => $serverTs,
        
        // --- PEDIDOS (CORE A/C/E) ---
        'orders_total' => $total,
        'orders_assigned' => $A,
        'orders_loaded' => $C,
        'orders_delivered' => $E,
        'orders_pending_load' => $A,
        'orders_pending_delivery' => $pendingDelivery,
        
        // --- EVENTOS (NO se reinician nunca) ----------
        'last_load_age' => $lastLoadAge,
        'last_delivery_age' => $lastDeliveryAge,   
        
        'clients' => $ordersMap[$vehicleId]['clients'] ?? [],

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
        
        // --- OPCIONAL (NO ahora, pero ya definido)
        //'next_trip_orders' => $nextTripCount   
        // -------------------------------------------------------------------------
    ];
}

function resolveSection($u) {
    if ($u['active'] !== 1) return 'inactive';
    if ($u['in_base']) return 'base';
    return 'trip';
}
// ------------------------------------------------------------------
$summary = [
    'idle' => 0,
    'delivering' => 0,
    'client' => 0, 
    'inactive' => 0
];

foreach ($units as $u) {
    $s = resolveSection($u);
    if ($s === 'inactive') {
        $summary['inactive']++;
    } else if ($s === 'base') {
        $summary['idle']++;
    } else if ($s === 'trip') {
        $summary['delivering']++;
    }
}

/*
$summary['idle'] = 5;
$summary['delivering'] = 15;
$summary['client'] = 10;
*/

// ------------------------------------------------------------------
$ordersSummary = [
    'A' => 0,
    'C' => 0,
    'E' => 0
];

foreach ($units as $u) {
    $ordersSummary['A'] += $u['orders_assigned'];
    $ordersSummary['C'] += $u['orders_loaded'];
    $ordersSummary['E'] += $u['orders_delivered'];
}
// ------------------------------------------------------------------
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
    'summary' => $summary,
    'orders_summary' => $ordersSummary,
    'total_vehicles' => $totalVehicles,
    'base' => [
        'lat' => $baseLat,
        'lng' => $baseLng
    ]    
]);