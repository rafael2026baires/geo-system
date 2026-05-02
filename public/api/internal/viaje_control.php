<?php
header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid json']);
    exit;
}

foreach (['tenant_id','unit_id','action'] as $k) {
    if (!isset($data[$k])) {
        http_response_code(400);
        echo json_encode(['error'=>"missing $k"]);
        exit;
    }
}

$tenantId = $data['tenant_id'];
$unitId   = $data['unit_id'];
$action   = strtoupper($data['action']);
$viaje    = $data['viaje'] ?? null;

if (!in_array($action,['START','END'])) {
    http_response_code(400);
    echo json_encode(['error'=>'invalid action']);
    exit;
}

/* 1) Llamar a Node */
$ch = curl_init("https://twybox-ws-core.onrender.com/viaje");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "tenantId" => $tenantId,
    "unitId"   => $unitId,
    "action"   => $action,
    "viaje"    => $viaje
]));
$response = curl_exec($ch);
curl_close($ch);

/* 2) Responder */
echo $response ?: json_encode(['error'=>'node call failed']);
