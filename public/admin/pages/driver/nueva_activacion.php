<?php
if (!defined('TWYVOX_ADMIN_PAGE')) {
    http_response_code(403);
    exit;
}
require __DIR__ . '/../../components/driver_header.php';
?>
<section class="driver-panel driver-form-panel" id="individualPanel">
  <div class="driver-panel-heading"><div><span class="driver-kicker">NUEVA ACTIVACIÓN</span><h2>Generar activación</h2></div></div>
  <p class="driver-panel-intro">Seleccioná el vehículo y la persona que recibirá el código. El destinatario no queda asociado al device.</p>
  <div class="driver-form-grid driver-create-selectors">
    <label><span>Vehículo *</span><select id="individualVehicle"><option value="">Seleccionar vehículo</option></select></label>
    <label><span>Destinatario *</span><select id="individualRecipient"><option value="">Seleccionar destinatario</option></select></label>
  </div>
  <div class="driver-channel-availability" aria-label="Canales disponibles">
    <h3>Canales disponibles</h3>
    <div><span>WhatsApp</span><output id="individualPhone">Sin teléfono disponible</output></div>
    <div><span>Email</span><output id="individualEmail">Sin email disponible</output></div>
  </div>
  <label class="driver-send-choice"><span>Enviar código por *</span><select id="individualChannel"><option value="">Seleccionar canal</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="ambos">Ambos</option></select></label>
  <p class="driver-hint" id="individualContactHint">El destinatario debe tener teléfono o email registrado en su ficha.</p>
  <div class="driver-actions"><button class="driver-button driver-button-primary" id="createActivation" type="button">Generar activación</button></div>
</section>
<section class="driver-panel" id="createResult" hidden>
  <div class="driver-panel-heading"><div><span class="driver-kicker">ACTIVACIÓN GENERADA</span><h2>Resultado</h2></div></div>
  <div id="createdItems" class="driver-result-list"></div>
  <div class="driver-actions"><a class="driver-button" href="/admin/?section=driver&amp;page=devices">Volver al listado</a></div>
</section>
</main>
<script src="<?= htmlspecialchars(admin_asset('/admin/assets/js/driver.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
