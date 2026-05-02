<?php
/**
 * tech_state_service.php
 *
 * Módulo CANÓNICO de estado técnico.
 * Decide estados técnicos usando SOLO server_ts.
 *
 * NO conoce frontend
 * NO conoce HTTP
 * NO usa tiempo local del cliente
 */

class TechStateService
{
    // === Parámetros (configuración, no lógica) ===
    private int $STOPPED_MEDIUM_SEC;
    private int $STOPPED_LONG_SEC;
    private float $MOVE_EPS_METERS;
    
    private int $STALE_TTL_SEC;
    private int $NO_DATA_TTL_SEC;
    private int $OFFLINE_TTL_SEC;

    public function __construct(array $config)
    {
        $this->STOPPED_MEDIUM_SEC = $config['stopped_medium_sec'];
        $this->STOPPED_LONG_SEC = $config['stopped_long_sec'];
        $this->MOVE_EPS_METERS  = $config['move_eps_meters'];
        
        $this->STALE_TTL_SEC = $config['stale_ttl_sec'];
        $this->NO_DATA_TTL_SEC   = $config['no_data_ttl_sec'];
        $this->OFFLINE_TTL_SEC = $config['offline_ttl_sec'];
    }
    
    public function compute(array $ctx): array
    {
        // 1) Sin datos
        if (!$ctx['last_point']) {
            return $this->buildResult(
                $ctx,
                'NO_DATA',
                'NO_DATA',
                $ctx['stopped_since']
            );
        }
    
        $age = $ctx['now_server_ts'] - $ctx['last_point']['server_ts'];
    
        // 2) OFFLINE
        if ($age > $this->OFFLINE_TTL_SEC) {
            return $this->buildResult(
                $ctx,
                'NO_DATA',
                'OFFLINE',
                $ctx['stopped_since']
            );
        }
    
        // 3) NO_DATA
        if ($age > $this->NO_DATA_TTL_SEC) {
            return $this->buildResult(
                $ctx,
                'NO_DATA',
                'NO_DATA',
                $ctx['stopped_since']
            );
        }
    
        // 4) STALE
        if ($age > $this->STALE_TTL_SEC) {
            return $this->buildResult(
                $ctx,
                'HAS_DATA',
                'STALE',
                $ctx['stopped_since']
            );
        }
    
        // 5) Movimiento / detención
        if (!$ctx['prev_point']) {
            return $this->buildResult(
                $ctx,
                'HAS_DATA',
                'STOPPED',
                $ctx['last_point']['server_ts']
            );
        }
    
        $distance = $this->distanceMeters(
            $ctx['prev_point'],
            $ctx['last_point']
        );
    
        if ($distance > $this->MOVE_EPS_METERS) {
            return $this->buildResult(
                $ctx,
                'HAS_DATA',
                'MOVING',
                null
            );
        }
    
        $stoppedSince = $ctx['stopped_since'] ?? $ctx['last_point']['server_ts'];
        $stoppedFor   = $ctx['now_server_ts'] - $stoppedSince;
    
        if ($stoppedFor >= $this->STOPPED_LONG_SEC) {
            return $this->buildResult(
                $ctx,
                'HAS_DATA',
                'STOPPED_LONG',
                $stoppedSince
            );
        }
        
        if ($stoppedFor >= $this->STOPPED_MEDIUM_SEC) {
            return $this->buildResult(
                $ctx,
                'HAS_DATA',
                'STOPPED_MEDIUM',
                $stoppedSince
            );
        }
        
        return $this->buildResult(
            $ctx,
            'HAS_DATA',
            'STOPPED',
            $stoppedSince
        );
    }

    // === Helpers internos ===
    private function buildResult(
        array $ctx,
        string $dataState,
        string $techState,
        ?int $stoppedSince
    ): array {
        return [
            'unit_id'        => $ctx['unit_id'],
            'server_ts'      => $ctx['last_point']['server_ts'] ?? null,
            'lat'            => $ctx['last_point']['lat'] ?? null,
            'lng'            => $ctx['last_point']['lng'] ?? null,
            'data_state'     => $dataState,
            'tech_state'     => $techState,
            'stopped_since'  => $stoppedSince
        ];
    }

    private function distanceMeters(array $p1, array $p2): float
    {
        // implementación simple (Haversine o plana)
        $dx = ($p2['lng'] - $p1['lng']) * 111320;
        $dy = ($p2['lat'] - $p1['lat']) * 110540;
        return sqrt($dx * $dx + $dy * $dy);
    }
}
