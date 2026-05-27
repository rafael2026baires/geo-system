<?php

class ClientZoneService
{
    public static function resolve(
        ?float $lat,
        ?float $lng,
        array $clients,
        float $defaultRadius = 70
    ): array {
        
        if ($lat === null || $lng === null || empty($clients)) {
            return [
                'in_client' => false,
                'distance_to_client_m' => null
            ];
        }

        $nearestDistance = null;

        foreach ($clients as $client) {
            if (!isset($client['lat'], $client['lng'])) {
                continue;
            }

            $clientLat = (float)$client['lat'];
            $clientLng = (float)$client['lng'];

            if (!$clientLat || !$clientLng) {
                continue;
            }

            $radius = isset($client['radius'])
                ? (float)$client['radius']
                : $defaultRadius;

            $prefilterRadius = $radius * 2;

            if (!self::isNearEnough(
                (float)$lat,
                (float)$lng,
                $clientLat,
                $clientLng,
                $prefilterRadius
            )) {
                continue;
            }    

            $distance = self::distanceMeters(
                $lat,
                $lng,
                $clientLat,
                $clientLng
            );

            if ($distance <= $radius) {
                if ($nearestDistance === null || $distance < $nearestDistance) {
                    $nearestDistance = $distance;
                }
            }
        }

        return [
            'in_client' => $nearestDistance !== null,
            'distance_to_client_m' => $nearestDistance
        ];
    }

    private static function isNearEnough(
        float $lat1,
        float $lng1,
        float $lat2,
        float $lng2,
        float $meters
    ): bool {
        $latAvg = deg2rad(($lat1 + $lat2) / 2);

        $maxLatDiff = $meters / 110540;
        $maxLngDiff = $meters / (111320 * cos($latAvg));

        return abs($lat2 - $lat1) <= $maxLatDiff
            && abs($lng2 - $lng1) <= $maxLngDiff;
    }    

    private static function distanceMeters(
        float $lat1,
        float $lng1,
        float $lat2,
        float $lng2
    ): float {
        $latAvg = deg2rad(($lat1 + $lat2) / 2);

        $dx = ($lng2 - $lng1) * 111320 * cos($latAvg);
        $dy = ($lat2 - $lat1) * 110540;

        return sqrt($dx * $dx + $dy * $dy);
    }
}