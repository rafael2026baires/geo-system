<?php
if (!defined('TWYVOX_ADMIN_PAGE')) {
    http_response_code(403);
    exit;
}
require __DIR__ . '/../../components/driver_header.php';
?>
<section class="driver-panel driver-list-panel" aria-label="Dispositivos">
  <div class="driver-panel-heading"><div><span class="driver-kicker">INVENTARIO</span><h2>Equipos registrados</h2></div><span class="driver-count" id="deviceCount">—</span></div>
  <div class="driver-filters">
    <label><span>Buscar</span><input id="deviceSearch" type="search" placeholder="Dispositivo, vehículo o chofer habitual" autocomplete="off"></label>
    <label><span>Vista</span><select id="deviceViewFilter"><option value="">Todos</option><option value="CURRENT" selected>Actuales</option><option value="HISTORICAL">Históricos</option></select></label>
    <label><span>Estado</span><select id="availabilityFilter"><option value="">Todos</option><option value="AVAILABLE">Disponible</option><option value="UNAVAILABLE">No disponible</option></select></label>
    <label><span>Situación</span><select id="situationFilter"><option value="">Todos</option><option value="READY_TO_OPERATE">Listo para operar</option><option value="PENDING_REPLACEMENT">Pendiente de ser reemplazado</option><option value="DISABLED">Deshabilitado</option><option value="PENDING_ACTIVATION">Pendiente de activación</option><option value="ACTIVATION_CANCELLED">Activación cancelada</option><option value="ACTIVATION_EXPIRED">Activación vencida</option><option value="REACTIVATION_PENDING">Reactivación pendiente</option><option value="REACTIVATION_CANCELLED">Reactivación cancelada</option><option value="REACTIVATION_EXPIRED">Reactivación vencida</option><option value="NO_VEHICLE">Sin vehículo asignado</option></select></label>
    <div class="driver-refresh-control"><button id="refreshDevices" type="button">Actualizar</button></div>
  </div>
  <div class="driver-table-wrap"><table class="driver-table"><thead><tr><th>Dispositivo</th><th>Estado</th><th>Situación</th><th>Vehículo</th><th>Chofer habitual</th><th>Gestionar</th></tr></thead><tbody id="deviceRows"><tr><td colspan="6" class="driver-loading">Cargando dispositivos…</td></tr></tbody></table></div>
  <div class="driver-mobile-list" id="deviceCards"></div>
  <p class="driver-empty" id="deviceEmpty" hidden>No hay devices que coincidan con los filtros.</p>
</section>
<div class="admin-drawer-backdrop" id="deviceDrawerBackdrop" hidden></div>
<aside class="admin-drawer" id="deviceDrawer" role="dialog" aria-modal="true" aria-labelledby="deviceDrawerTitle" hidden>
  <header class="admin-drawer-header">
    <div class="admin-drawer-heading"><span class="admin-drawer-kicker">DRIVER / ACTIVACIÓN</span><h2 id="deviceDrawerTitle">Gestionar</h2><p id="deviceDrawerSubtitle"></p></div>
    <button class="admin-drawer-close" id="deviceDrawerClose" type="button" aria-label="Cerrar gestión">×</button>
  </header>
  <div class="driver-feedback admin-drawer-feedback" id="deviceDrawerFeedback" role="status" aria-live="polite" hidden></div>
  <div class="admin-drawer-body" id="deviceDrawerBody"></div>
</aside>
</main>
<script src="<?= htmlspecialchars(admin_asset('/admin/assets/js/driver.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
