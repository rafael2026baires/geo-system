<?php

require_once __DIR__ . '/../config/env.php';

final class WsCoreIdentityService
{
    private string $baseUrl;
    private string $token;

    public function __construct(string $baseUrl, string $token)
    {
        $baseUrl = rtrim(trim($baseUrl), '/');
        $token = trim($token);
        if ($baseUrl === '' || filter_var($baseUrl, FILTER_VALIDATE_URL) === false || $token === '') {
            throw new RuntimeException('La integración interna con ws-core no está configurada.');
        }
        $this->baseUrl = $baseUrl;
        $this->token = $token;
    }

    public function revokeIdentity(string $deviceUuid): void
    {
        $this->sendIdentityRequest($deviceUuid, '/identities/revoke', 'revocación');
    }

    public function clearRevocation(string $deviceUuid): void
    {
        $this->sendIdentityRequest($deviceUuid, '/identities/clear-revocation', 'habilitación');
    }

    public function invalidateMapping(string $deviceUuid): void
    {
        $this->sendIdentityRequest($deviceUuid, '/identities/invalidate-mapping', 'invalidación del mapping');
    }

    private function sendIdentityRequest(string $deviceUuid, string $path, string $operation): void
    {
        $deviceUuid = trim($deviceUuid);
        if ($deviceUuid === '') {
            throw new InvalidArgumentException('La identidad a sincronizar es inválida.');
        }
        if (!function_exists('curl_init')) {
            throw new RuntimeException('El cliente HTTP interno no está disponible.');
        }

        $handle = curl_init($this->baseUrl . $path);
        if ($handle === false) {
            throw new RuntimeException('No se pudo iniciar la llamada interna a ws-core.');
        }

        $payload = json_encode(['identity' => $deviceUuid], JSON_THROW_ON_ERROR);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'x-internal-api-token: ' . $this->token
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 5
        ]);

        $response = curl_exec($handle);
        $networkError = curl_error($handle);
        $httpStatus = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        if ($response === false) {
            throw new RuntimeException('Falló la comunicación con ws-core: ' . $networkError);
        }
        if ($httpStatus < 200 || $httpStatus >= 300) {
            throw new RuntimeException('ws-core rechazó la ' . $operation . ' con HTTP ' . $httpStatus . '.');
        }

        try {
            $decoded = json_decode($response, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('ws-core devolvió una respuesta inválida.');
        }
        if (!is_object($decoded)
            || (property_exists($decoded, 'success') && $decoded->success !== true)
            || (property_exists($decoded, 'ok') && $decoded->ok !== true)) {
            throw new RuntimeException('ws-core no confirmó la ' . $operation . '.');
        }
    }
}

function ws_core_identity_service_from_env(): WsCoreIdentityService
{
    return new WsCoreIdentityService(
        (string)getenv_config('WS_CORE_INTERNAL_URL'),
        (string)getenv_config('WS_CORE_INTERNAL_TOKEN')
    );
}

function ws_core_queue_identity_sync(PDO $pdo, string $deviceUuid): void
{
    $queue = $pdo->prepare(
        "INSERT INTO ws_identity_revocation_outbox (identity, last_error)
         VALUES (?, CONCAT('PENDING:', UUID()))
         ON DUPLICATE KEY UPDATE
             completed_at = NULL,
             last_error = CONCAT('PENDING:', UUID()),
             updated_at = NOW()"
    );
    $queue->execute([$deviceUuid]);
}

function ws_core_process_identity_sync(
    PDO $pdo,
    string $deviceUuid,
    ?WsCoreIdentityService $service = null
): array {
    $syncToken = null;
    try {
        $pendingQuery = $pdo->prepare(
            "SELECT d.active, COALESCE(o.last_error, '') AS sync_token
             FROM ws_identity_revocation_outbox o
             INNER JOIN devices d ON d.device_uuid = o.identity
             WHERE o.identity = ? AND o.completed_at IS NULL LIMIT 1"
        );
        $pendingQuery->execute([$deviceUuid]);
        $pending = $pendingQuery->fetch(PDO::FETCH_ASSOC);
        if (!$pending) {
            return ['success' => true, 'error' => null];
        }

        $active = (int)$pending['active'];
        $syncToken = (string)$pending['sync_token'];
        $identityService = $service ?? ws_core_identity_service_from_env();
        if ($active === 1) {
            $identityService->clearRevocation($deviceUuid);
            $identityService->invalidateMapping($deviceUuid);
        } else {
            $identityService->revokeIdentity($deviceUuid);
        }

        $complete = $pdo->prepare(
            "UPDATE ws_identity_revocation_outbox o
             INNER JOIN devices d ON d.device_uuid = o.identity
             SET attempts = attempts + 1, last_attempt_at = NOW(), completed_at = NOW(), last_error = NULL
             WHERE o.identity = ? AND o.completed_at IS NULL
               AND COALESCE(o.last_error, '') = ? AND d.active = ?"
        );
        $complete->execute([$deviceUuid, $syncToken, $active]);
        return ['success' => true, 'error' => null];
    } catch (Throwable $e) {
        $error = substr(preg_replace('/\s+/', ' ', $e->getMessage()), 0, 500);
        try {
            if ($syncToken !== null) {
                $pending = $pdo->prepare(
                    "UPDATE ws_identity_revocation_outbox
                     SET attempts = attempts + 1, last_attempt_at = NOW(), last_error = ?
                     WHERE identity = ? AND completed_at IS NULL
                       AND COALESCE(last_error, '') = ?"
                );
                $pending->execute([$error, $deviceUuid, $syncToken]);
            }
        } catch (Throwable $persistenceError) {
            error_log('[WS IDENTITY SYNC OUTBOX ERROR] identity=' . $deviceUuid);
        }
        error_log('[WS IDENTITY SYNC PENDING] identity=' . $deviceUuid . ' error=' . $error);
        return ['success' => false, 'error' => $error];
    }
}

function ws_core_queue_identity_revocation(PDO $pdo, string $deviceUuid): void
{
    ws_core_queue_identity_sync($pdo, $deviceUuid);
}

function ws_core_process_identity_revocation(
    PDO $pdo,
    string $deviceUuid,
    ?WsCoreIdentityService $service = null
): array {
    return ws_core_process_identity_sync($pdo, $deviceUuid, $service);
}
