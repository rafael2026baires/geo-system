<?php
if (!defined('TWYVOX_ADMIN_PAGE')) {
    http_response_code(403);
    exit;
}
require __DIR__ . '/../../components/driver_header.php';
?>
<a class="driver-text-link driver-back-link" href="/admin/?section=driver&amp;page=devices">← Volver al listado</a>
<div id="detailContent" hidden>
  <section class="driver-panel"><span class="driver-kicker">DISPOSITIVO</span><h2 id="deviceHeading">—</h2><div class="driver-data-grid" id="identityData"></div></section>
  <section class="driver-panel"><span class="driver-kicker">ACTIVACIÓN</span><h2>Estado de activación</h2><div class="driver-data-grid" id="activationData"></div></section>
  <section class="driver-panel"><span class="driver-kicker">ACCIÓN CONTEXTUAL</span><h2>Próximo paso</h2><div id="primaryAction"></div><div id="codeContent"></div></section>
  <section class="driver-panel driver-special" id="specialActions"><span class="driver-kicker">HABILITACIÓN Y OTRAS ACCIONES</span><h2>Acciones adicionales</h2><div class="driver-actions" id="specialButtons"></div></section>
</div>
</main>
<script src="<?= htmlspecialchars(admin_asset('/admin/assets/js/driver.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
