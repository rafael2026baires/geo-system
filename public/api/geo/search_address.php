<?php

require_once __DIR__ . '/../bootstrap.php';

try {

    $q = $_GET['q'] ?? '';

    if (strlen($q) < 2) {
        http_response_code(400);
        echo json_encode(['error' => 'mínimo 2 caracteres']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT
            c.id   AS city_id,
            c.name AS city,
            s.id   AS state_id,
            s.name AS state,
            co.id  AS country_id,
            co.name AS country
        FROM cities c
        JOIN states s
            ON c.state_id = s.id
        JOIN countries co
            ON s.country_id = co.id
        WHERE c.name LIKE ?
        ORDER BY c.name
        LIMIT 20
    ");

    $stmt->execute([
        $q.'%'
    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($rows);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'error' => 'Error interno',
        'detalle' => $e->getMessage()
    ]);
}