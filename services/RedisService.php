<?php

class RedisService
{
    private static $redis = null;

    public static function get()
    {
        if (self::$redis instanceof Redis) {

            /*
            try {
                self::$redis->ping();
                return self::$redis;
            } catch (Throwable $e) {
                self::$redis = null;
            }
            */

            return self::$redis;
        }

        self::$redis = new Redis();
        self::$redis->connect('127.0.0.1', 6379);
        self::$redis->select(0);

        return self::$redis;
    }
}