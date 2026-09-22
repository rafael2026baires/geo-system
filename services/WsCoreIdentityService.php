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
        $deviceUuid = trim($deviceUuid);
        if ($deviceUuid === '') {
            throw new InvalidArgumentException('La identidad a revocar es inválida.');
        }
        if (!function_exists('curl_init')) {
            throw new RuntimeException('El cliente HTTP interno no está disponible.');
        }

        $handle = curl_init($this->baseUrl . '/identities/revoke');
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
            throw new RuntimeException('ws-core rechazó la revocación con HTTP ' . $httpStatus . '.');
        }

        try {
            $decoded = json_decode($response, false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('ws-core devolvió una respuesta inválida.');
        }
        if (!is_object($decoded)
            || (property_exists($decoded, 'success') && $decoded->success !== true)
            || (property_exists($decoded, 'ok') && $decoded->ok !== true)) {
            throw new RuntimeException('ws-core no confirmó la revocación.');
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

function ws_core_queue_identity_revocation(PDO $pdo, string $deviceUuid): void
{
    $queue = $pdo->prepare(
        'INSERT INTO ws_identity_revocation_outbox (identity) VALUES (?)
         ON DUPLICATE KEY UPDATE identity = VALUES(identity)'
    );
    $queue->execute([$deviceUuid]);
}

function ws_core_process_identity_revocation(
    PDO $pdo,
    string $deviceUuid,
    ?WsCoreIdentityService $service = null
): array {
    try {
        ($service ?? ws_core_identity_service_from_env())->revokeIdentity($deviceUuid);
        $complete = $pdo->prepare(
            'UPDATE ws_identity_revocation_outbox
             SET attempts = attempts + 1, last_attempt_at = NOW(), completed_at = NOW(), last_error = NULL
             WHERE identity = ?'
        );
        $complete->execute([$deviceUuid]);
        return ['success' => true, 'error' => null];
    } catch (Throwable $e) {
        $error = substr(preg_replace('/\s+/', ' ', $e->getMessage()), 0, 500);
        try {
            $pending = $pdo->prepare(
                'UPDATE ws_identity_revocation_outbox
                 SET attempts = attempts + 1, last_attempt_at = NOW(), last_error = ?
                 WHERE identity = ? AND completed_at IS NULL'
            );
            $pending->execute([$error, $deviceUuid]);
        } catch (Throwable $persistenceError) {
            error_log('[WS IDENTITY REVOCATION OUTBOX ERROR] identity=' . $deviceUuid);
        }
        error_log('[WS IDENTITY REVOCATION PENDING] identity=' . $deviceUuid . ' error=' . $error);
        return ['success' => false, 'error' => $error];
    }
}
