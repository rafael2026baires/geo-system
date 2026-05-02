<?php

require_once __DIR__ . '/bootstrap.php';

$path = $_GET['path'] ?? '';

if (!$path) {
    json_error('Ruta no definida');
}

// limpiar
$path = trim($path, '/');

// construir ruta real
$file = __DIR__ . '/' . $path . '.php';

if (!file_exists($file)) {
    json_error('Endpoint no encontrado');
}

// ejecutar
require $file;