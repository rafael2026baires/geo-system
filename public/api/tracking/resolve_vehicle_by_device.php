<?php

require_once __DIR__ . '/../bootstrap.php';

$device_uuid = $_GET['device_uuid'];

try {

$sql = "

SELECT
v.id           AS vehicle_id,
dv.device_uuid AS vehicle_code,
d.id           AS driver_id,
d.name         AS driver_name,
dv.id          AS device_id

FROM devices dv

JOIN policy_driver_device pdd
ON pdd.device_id = dv.id

JOIN drivers d
ON d.id = pdd.driver_id

JOIN policy_vehicle_driver pvd
ON pvd.driver_id = d.id

JOIN vehicles v
ON v.id = pvd.vehicle_id

JOIN vehicle_devices vd
ON vd.vehicle_id = v.id
AND vd.device_id = dv.id

WHERE dv.device_uuid = :device_uuid
AND dv.active = 1

LIMIT 1

";

$stmt = $pdo->prepare($sql);
$stmt->bindParam(':device_uuid', $device_uuid);
$stmt->execute();

$result = $stmt->fetch(PDO::FETCH_ASSOC);

if($result){

    echo json_encode([
        "success" => true,
        "data" => $result
    ]);

}else{

    echo json_encode([
        "success" => false,
        "message" => "No se encontró relación device-driver-vehicle"
    ]);

}

}catch(Exception $e){

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

}