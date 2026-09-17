<?php
if (!defined('TWYVOX_ADMIN_PAGE')) {
    http_response_code(403);
    exit;
}
require __DIR__ . '/../../components/driver_header.php';
?>
<a class="driver-text-link driver-back-link" href="/admin/?section=driver&amp;page=devices">← Volver al listado</a>
<div id="detailContent" hidden>
  <div class="driver-detail-grid">
    <section class="driver-panel"><span class="driver-kicker">01 / IDENTIDAD</span><h2>Device</h2><div class="driver-data-grid" id="identityData"></div></section>
    <section class="driver-panel"><span class="driver-kicker">02 / VEHÍCULO</span><h2>Vehículo</h2><div class="driver-data-grid" id="vehicleData"></div></section>
    <section class="driver-panel"><span class="driver-kicker">03 / ACTIVACIÓN</span><h2>Estado actual</h2><div class="driver-data-grid" id="activationData"></div></section>
    <section class="driver-panel"><span class="driver-kicker">04 / CÓDIGO</span><h2>Entrega asistida</h2><div id="codeContent"></div></section>
  </div>
  <section class="driver-panel driver-special" id="specialActions"><span class="driver-kicker">GESTIÓN</span><h2>Acciones especiales</h2><div class="driver-actions" id="specialButtons"></div></section>
</div>
</main>
<script src="/admin/assets/js/driver.js" defer></script>
