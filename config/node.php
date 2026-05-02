<?php

require_once __DIR__ . '/env.php';

function getNodeBaseUrl(): string
{
    /*
    return (strpos($_SERVER['HTTP_HOST'], 'geo.local') !== false)
        ? 'http://geo.local:3000'
        : 'http://mi-dominio.com:3000';
    */    
    return getEnv() === 'local'
        ? 'http://geo.local:3000'
        : 'http://mi-dominio.com:3000';    
}