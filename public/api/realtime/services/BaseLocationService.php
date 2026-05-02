<?php

// Haversine  ********* método más preciso para distancias grandes + 50-100 km, no aplicacable por ahora, el actual es más rápido  ***************

class BaseLocationService
{
    /**
     * Determina si una posición está fuera de base
     *
     * @param float $lat         Latitud actual
     * @param float $lng         Longitud actual
     * @param float $baseLat     Latitud base
     * @param float $baseLng     Longitud base
     * @param int   $baseRadius  Radio base en metros
     *
     * @return bool
     */
    public static function isFueraDeBase(
        float $lat,
        float $lng,
        float $baseLat,
        float $baseLng,
        int $baseRadius
    ): bool {

        if (!$baseLat || !$baseLng) {
            return false; // sin base definida no se evalúa
        }

        $distance = self::distanceMeters(
            $lat,
            $lng,
            $baseLat,
            $baseLng
        );

        return $distance > ($baseRadius + 15);
    }

    /**
     * Cálculo simple de distancia en metros
     */
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