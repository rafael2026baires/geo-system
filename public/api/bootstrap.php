<?php

date_default_timezone_set('America/Argentina/Buenos_Aires');

require_once __DIR__ . '/../../config/conexion_base.php';

$pdo = new Conexion();

// headers comunes
header('Content-Type: application/json');

function json_ok($data = []) {
    echo json_encode([
        "success" => true,
        "data" => $data
    ]);
    exit;
}

// manejo básico de errores
function json_error($msg, $code = 400) {
    http_response_code($code);
    echo json_encode([
        "success" => false,
        "error" => $msg
    ]);
    exit;
}