<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../bootstrap.php';

try {
    $sql = "
        SELECT 
            setting_key,
            setting_value,
            descrip,
            grupo,
            orden
        FROM ui_theme_settings
        ORDER BY grupo, orden, setting_key
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();

    $theme = [];
    $settings = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $key = $row['setting_key'];

        $theme[$key] = $row['setting_value'];

        $settings[] = [
            'setting_key'   => $key,
            'setting_value' => $row['setting_value'],
            'descrip'       => $row['descrip'] ?? '',
            'grupo'         => $row['grupo'] ?? 'General',
            'orden'         => (int)($row['orden'] ?? 0)
        ];
    }

    echo json_encode([
        'ok' => true,
        'theme' => $theme,
        'settings' => $settings
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => 'Error al cargar el tema visual'
    ], JSON_UNESCAPED_UNICODE);
}