<?php

function getRedis() {
    try {
        $redis = new Redis();
        $redis->connect('127.0.0.1', 6379); 
        $redis->select(0);         
        return $redis;
    } catch (Throwable $e) {
        return null;
    }
}