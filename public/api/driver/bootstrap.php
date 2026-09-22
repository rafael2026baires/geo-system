<?php

require_once __DIR__ . '/../bootstrap.php';

function driver_response(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function driver_error(int $status, string $code, string $message): void
{
    driver_response($status, [
        'success' => false,
        'error' => ['code' => $code, 'message' => $message]
    ]);
}

function driver_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        driver_error(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
    }
}

function driver_read_json(): object
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, false);

    if (!is_object($data) || json_last_error() !== JSON_ERROR_NONE) {
        driver_error(400, 'INVALID_JSON', 'Se requiere un objeto JSON válido.');
    }

    return $data;
}

function driver_session_tenant_id(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $tenantId = $_SESSION['tenant_id'] ?? null;
    $userId = $_SESSION['user_id'] ?? null;
    $role = $_SESSION['role'] ?? null;

    if (filter_var($tenantId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false
        || filter_var($userId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false
        || $role !== 'admin') {
        driver_error(401, 'UNAUTHORIZED', 'Sesión administrativa no válida.');
    }

    return (int)$tenantId;
}

function driver_require_permission(string $permission): void
{
    if (array_key_exists('admin_permissions', $_SESSION)
        && (!is_array($_SESSION['admin_permissions'])
            || !in_array($permission, $_SESSION['admin_permissions'], true))) {
        driver_error(403, 'FORBIDDEN', 'No tenés permiso para esta acción.');
    }
}

function driver_generate_activation_code(PDO $pdo): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $checkCode = $pdo->prepare('SELECT id FROM device_activations WHERE activation_code = ? LIMIT 1');
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $random = random_bytes(10);
        $suffix = '';
        for ($i = 0; $i < 10; $i++) {
            $suffix .= $alphabet[ord($random[$i]) & 31];
        }
        $activationCode = 'TVX-' . $suffix;
        $checkCode->execute([$activationCode]);
        if (!$checkCode->fetchColumn()) {
            return $activationCode;
        }
    }

    throw new RuntimeException('No se pudo generar un código único.');
}

function driver_generate_device_uuid(PDO $pdo): string
{
    $checkDevice = $pdo->prepare('SELECT id FROM devices WHERE device_uuid = ? LIMIT 1');
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $deviceUuid = 'U-' . strtoupper(bin2hex(random_bytes(4)));
        $checkDevice->execute([$deviceUuid]);
        if (!$checkDevice->fetchColumn()) {
            return $deviceUuid;
        }
    }

    throw new RuntimeException('No se pudo generar un identificador único.');
}

function driver_find_enabled_vehicle(PDO $pdo, int $vehicleId, int $tenantId): ?array
{
    $query = $pdo->prepare(
        'SELECT id, patent, brand, model, enabled FROM vehicles
         WHERE id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE'
    );
    $query->execute([$vehicleId, $tenantId]);
    $vehicle = $query->fetch(PDO::FETCH_ASSOC);
    return $vehicle && (int)$vehicle['enabled'] === 1
        ? $vehicle : null;
}

function driver_current_activation_condition(string $activationAlias): string
{
    if (preg_match('/^[a-z][a-z0-9_]*$/i', $activationAlias) !== 1) {
        throw new InvalidArgumentException('Alias de activación inválido.');
    }

    return "(($activationAlias.status = 'PENDING' AND $activationAlias.expires_at > NOW())
        OR ($activationAlias.status = 'USED' AND EXISTS (
            SELECT 1 FROM vehicle_devices current_vd
            WHERE current_vd.vehicle_id = $activationAlias.vehicle_id
              AND current_vd.device_id = $activationAlias.device_id
        )))";
}

function driver_expire_pending_activations(PDO $pdo, int $tenantId, ?int $deviceId = null): int
{
    $sql = "UPDATE device_activations a
            INNER JOIN devices d ON d.id = a.device_id
            SET a.status = 'EXPIRED',
                d.active = IF(a.replaces_device_id IS NOT NULL, 0, d.active)
            WHERE d.tenant_id = ?
              AND a.status = 'PENDING'
              AND a.expires_at <= NOW()";
    $params = [$tenantId];

    if ($deviceId !== null) {
        $sql .= ' AND a.device_id = ?';
        $params[] = $deviceId;
    }

    $update = $pdo->prepare($sql);
    $update->execute($params);
    return $update->rowCount();
}

function driver_vehicle_has_current_activation(PDO $pdo, int $vehicleId, int $tenantId): bool
{
    $condition = driver_current_activation_condition('current_a');
    $query = $pdo->prepare(
        "SELECT current_a.id
         FROM device_activations current_a
         INNER JOIN devices current_d ON current_d.id = current_a.device_id
         WHERE current_a.vehicle_id = ? AND current_d.tenant_id = ?
           AND $condition
         LIMIT 1 FOR UPDATE"
    );
    $query->execute([$vehicleId, $tenantId]);
    return $query->fetchColumn() !== false;
}

function driver_create_activation_for_vehicle(PDO $pdo, int $tenantId, int $vehicleId, ?int $driverId = null): array
{
    $deviceUuid = driver_generate_device_uuid($pdo);
    $activationCode = driver_generate_activation_code($pdo);
    $expiresAt = (new DateTimeImmutable('now'))->modify('+7 days')->format('Y-m-d H:i:s');

    $insertDevice = $pdo->prepare(
        'INSERT INTO devices (tenant_id, device_uuid, model, brand, app_version, active)
         VALUES (?, ?, NULL, NULL, NULL, 1)'
    );
    $insertDevice->execute([$tenantId, $deviceUuid]);
    $deviceId = (int)$pdo->lastInsertId();

    $insertActivation = $pdo->prepare(
        'INSERT INTO device_activations
         (device_id, vehicle_id, driver_id, activation_code, status, expires_at, sent_at, used_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)'
    );
    $insertActivation->execute([$deviceId, $vehicleId, $driverId, $activationCode, 'PENDING', $expiresAt]);

    return [
        'device_id' => $deviceId,
        'device_uuid' => $deviceUuid,
        'vehicle_id' => $vehicleId,
        'activation_id' => (int)$pdo->lastInsertId(),
        'activation_code' => $activationCode,
        'activation_status' => 'PENDING',
        'administrative_status' => 'PENDING_SEND',
        'expires_at' => $expiresAt
    ];
}
