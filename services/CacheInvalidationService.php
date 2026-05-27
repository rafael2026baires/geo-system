<?php

require_once __DIR__ . '/RedisService.php';

class CacheInvalidationService
{
    public static function gridContext($tenantId)
    {
        if (!$tenantId) {
            return false;
        }

        /*
        try {
            $redis = RedisService::get();
            return $redis->del("grid_context:$tenantId");
        } catch (Throwable $e) {
            error_log('[CACHE INVALIDATION ERROR] ' . $e->getMessage());
            return false;
        }
        */

        $redis = RedisService::get();
        return $redis->del("grid_context:$tenantId");
    }
}