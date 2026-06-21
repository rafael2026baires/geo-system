<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../bootstrap.php';

$allowedKeys = [

    'kpi_block_bg',
    'kpi_block_border',
    'kpi_card_border',
    'kpi_bar_border',
    'kpi_bar_empty',
    'kpi_bar_data',
    'kpi_bar_delivery',
    'kpi_title_color',
    'kpi_value_color',
    'kpi_row_title_color',
    'kpi-summary-border', 

    'layout_header_bg',
    'layout_header_title_color',
    'layout_header_button_bg',
    'layout_header_text_color',
    'layout_header_button_hover_bg',
    'layout_sidebar_bg',
    'layout_sidebar_text_color',
    'layout_sidebar_border_color',
    'layout_resizer_bg',
    'layout_resizer_hover_bg',
    'focus_panel_bg',
    'focus_panel_text_color',
    'focus_panel_border_color',
    'focus_empty_title_color',
    'focus_empty_text_color',   
    
    'user_button_text_color',
    'user_menu_bg',
    'user_menu_text_color',
    'user_menu_hover_bg',

    'floating_border_color',
    'floating_shadow_color',
    'floating_label_bg',
    'floating_label_text_color',
    'floating_button_bg',
    'floating_button_text_color',
    'floating_close_hover_bg',
    'floating_detach_bg',
    'floating_detach_hover_bg',

    'vehicle_dot_bg',
    'vehicle_dot_border',
    'vehicle_label_bg',
    'vehicle_label_text_color',

    'header_fleet_label_color',
    'header_fleet_value_color',  
    
    'layout_header_button_text_color',
    'focus_empty_message_color',
  
    'vehicle_highlight_color_1',
    'vehicle_highlight_color_2',
    
    'floating_normal_border_color',
    'floating_normal_shadow_color',
    'floating_normal_hover_shadow_color',
    
    'grid_summary_border',
    'grid_scroll_track_bg',
    'grid_scroll_thumb_bg',
    'grid_scroll_thumb_hover_bg',
    // --------------------------------------------------

    // ** GRILLA **   
    'grid_cell_shadow_color',
    'grid_header_bg',
    'grid_fixed_col_bg',   
    'grid_active_bg',
    
    'grid_vehicle_name_color',
    'grid_vehicle_active_color',
    'grid_vehicle_inactive_color',
    'grid_signal_label_color',
    'grid_motion_label_color',

    'grid_motion_wheel_color',
    'grid_motion_disabled_line_color',

    'grid_orders_bar_border',
    'grid_orders_bar_bg',
    'grid_orders_seg_base',
    'grid_orders_seg_truck',
    'grid_orders_seg_client',
    // -------------------------------
    'grid_timeline_line_color',
    'grid_timeline_dot_bg',
    'grid_timeline_dot_border',
    'grid_timeline_dot_delivered_bg',   
    
    
    // ** MAPA **
    'map_base_circle_border_color',
    'map_base_circle_fill_color',

    'map_client_circle_color',
    'map_client_done_color',
    'map_client_pending_color',    
    // -------------------------------------------------

    // gráficos
    'chart_axis_text_color',
    'chart_grid_line_color',
    'chart_line_color',    
];

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        throw new Exception('JSON inválido');
    }

    $sql = "
        UPDATE ui_theme_settings
        SET setting_value = :setting_value
        WHERE setting_key = :setting_key
    ";

    $stmt = $pdo->prepare($sql);

    foreach ($allowedKeys as $key) {
        if (!isset($data[$key])) {
            continue;
        }

        $value = trim($data[$key]);

        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $value)) {
            continue;
        }

        $stmt->execute([
            ':setting_key' => $key,
            ':setting_value' => strtoupper($value)
        ]);
    }

    echo json_encode([
        'ok' => true,
        'message' => 'Tema visual guardado correctamente'
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'ok' => false,
        'error' => 'Error al guardar el tema visual'
    ], JSON_UNESCAPED_UNICODE);
}