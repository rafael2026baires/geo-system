<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../config/conexion_base.php';
require_once __DIR__ . '/../services/WsCoreIdentityService.php';

$limit = isset($argv[1]) ? filter_var($argv[1], FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 100]
]) : 20;
if ($limit === false) {
    fwrite(STDERR, "El límite debe ser un entero entre 1 y 100.\n");
    exit(2);
}

$pdo = new Conexion();
$query = $pdo->prepare(
    'SELECT identity FROM ws_identity_revocation_outbox
     WHERE completed_at IS NULL ORDER BY id LIMIT ?'
);
$query->bindValue(1, $limit, PDO::PARAM_INT);
$query->execute();
$identities = $query->fetchAll(PDO::FETCH_COLUMN);

$failed = 0;
foreach ($identities as $identity) {
    $result = ws_core_process_identity_sync($pdo, (string)$identity);
    echo $identity . ': ' . ($result['success'] ? 'sincronizada' : 'pendiente') . PHP_EOL;
    if (!$result['success']) {
        $failed++;
    }
}

echo 'Procesadas: ' . count($identities) . '; pendientes por error: ' . $failed . PHP_EOL;
exit($failed === 0 ? 0 : 1);
