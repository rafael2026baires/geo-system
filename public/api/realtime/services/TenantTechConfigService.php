<?php

class TenantTechConfigService
{
    public static function get(PDO $pdo, $redis, int $tenantId): array
    {
        $defaults = require __DIR__ . '/../../../../config/tech_state.php';

        $cacheKey = "tenant_alert_config:$tenantId";

        if ($redis) {
            $raw = $redis->get($cacheKey);
            if ($raw) {
                $cfg = json_decode($raw, true);
                if (is_array($cfg)) {
                    return array_merge($defaults, $cfg);
                }
            }
        }

        $stmt = $pdo->prepare("
            SELECT
                stopped_medium_sec,
                stopped_long_sec,
                move_eps_meters,
                stale_ttl_sec,
                no_data_ttl_sec,
                offline_ttl_sec,
                reset_context_sec,
                fuel_low_pct,
                engine_temp_high
            FROM tenant_alert_config
            WHERE tenant_id = ?
            LIMIT 1
        ");

        $stmt->execute([$tenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return $defaults;
        }

        $cfg = [
            'stopped_medium_sec' => (int)$row['stopped_medium_sec'],
            'stopped_long_sec'   => (int)$row['stopped_long_sec'],
            'move_eps_meters'    => (float)$row['move_eps_meters'],
            'stale_ttl_sec'      => (int)$row['stale_ttl_sec'],
            'no_data_ttl_sec'    => (int)$row['no_data_ttl_sec'],
            'offline_ttl_sec'    => (int)$row['offline_ttl_sec'],
            'reset_context_sec'  => (int)$row['reset_context_sec'],
            'fuel_low_pct'       => (float)$row['fuel_low_pct'],
            'engine_temp_high'   => (float)$row['engine_temp_high'],
        ];

        if ($redis) {
            $redis->setex($cacheKey, 3600, json_encode($cfg));
        }

        return array_merge($defaults, $cfg);
    }
}