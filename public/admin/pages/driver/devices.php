<?php
if (!defined('TWYVOX_ADMIN_PAGE')) {
    http_response_code(403);
    exit;
}
require __DIR__ . '/../../components/driver_header.php';
?>
<section class="driver-panel" aria-label="Listado de devices">
  <div class="driver-panel-heading"><div><span class="driver-kicker">INVENTARIO</span><h2>Devices del espacio</h2></div><span class="driver-count" id="deviceCount">—</span></div>
  <div class="driver-filters">
    <label><span>Buscar</span><input id="deviceSearch" type="search" placeholder="ID, UUID, marca o modelo" autocomplete="off"></label>
    <label><span>Activación</span><select id="activationFilter"><option value="">Todos los estados</option><option value="NO_ACTIVATION">Sin activación</option><option value="PENDING_SEND">Código generado · pendiente de envío</option><option value="SENT_PENDING_ACTIVATION">Código enviado · pendiente de activación</option><option value="ACTIVATED">Activado</option><option value="EXPIRED">Código vencido</option></select></label>
    <label><span>Estado técnico</span><select id="enabledFilter"><option value="">Todos</option><option value="enabled">Habilitado</option><option value="disabled">Deshabilitado</option></select></label>
  </div>
  <div class="driver-table-wrap"><table class="driver-table"><thead><tr><th>Device</th><th>Estado técnico</th><th>Activación</th><th>Vehículo</th><th>Marca / modelo</th><th>Versión</th><th>Última activación / vencimiento</th><th></th></tr></thead><tbody id="deviceRows"><tr><td colspan="8" class="driver-loading">Cargando devices…</td></tr></tbody></table></div>
  <div class="driver-mobile-list" id="deviceCards"></div>
  <p class="driver-empty" id="deviceEmpty" hidden>No hay devices que coincidan con los filtros.</p>
</section>
</main>
<script src="/admin/assets/js/driver.js" defer></script>
