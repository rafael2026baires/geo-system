<?php

require_once __DIR__ . '/../../../../config/node.php';

class RealtimePositionService
{    

    /**
     * Obtiene posición actual de un vehículo desde Node (/last)
     *
     * @param int $tenantId
     * @param int $vehicleId
     * @return array|null  ['lat' => float, 'lng' => float] o null si no existe
     */
    public static function getVehiclePosition(string $tenantId, int $vehicleId): ?array
    
    {
        $url = getNodeBaseUrl() . '/last?tenantId=' . urlencode($tenantId);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);

        $response = curl_exec($ch);
        curl_close($ch);

        if (!$response) {
            return null;
        }

        $data = json_decode($response, true);

        if (!isset($data['units']) || !is_array($data['units'])) {
            return null;
        }

        foreach ($data['units'] as $unit) {

            $rowVehicleId = isset($unit['vehicle_id'])
                ? (int)$unit['vehicle_id']
                : 0;

            if ($rowVehicleId === $vehicleId) {

                return [
                    'lat' => isset($unit['lat']) ? (float)$unit['lat'] : null,
                    'lng' => isset($unit['lng']) ? (float)$unit['lng'] : null,
                ];
            }
        }

        return null;
    }    
    
    public static function getAllUnits(string $tenantId): ?array
    {
        require_once __DIR__ . '/../../../../config/redis.php';
        $redis = getRedis();

        if (!$redis) {
            return ['units' => []];
        }

        $pattern = "unit:$tenantId:*";
        $keys = $redis->keys($pattern);

        $units = [];

        foreach ($keys as $key) {
            $data = $redis->get($key);
            if (!$data) continue;

            $unit = json_decode($data, true);
            if (!$unit) continue;

            $units[] = $unit;
      
        }

        return ['units' => $units];
    }
    
    /*
    public static function getAllUnits(string $tenantId): ?array
    {
        $url = getNodeBaseUrl() . '/last?tenantId=' . urlencode($tenantId);
    
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    
        $response = curl_exec($ch);

        if ($response === false) {
            curl_close($ch);
            return ['units' => []];
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            return ['units' => []];
        }

        $data = json_decode($response, true);

        if (!is_array($data) || !isset($data['units'])) {
            return ['units' => []];
        }

        return $data;

    }  
    */    
    
}