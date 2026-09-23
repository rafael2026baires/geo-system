<?php
if (!defined('TWYVOX_ADMIN_PAGE') || $activeSection !== 'driver') {
    http_response_code(403);
    exit;
}
$driverPermissions = [
    'list' => can('driver.devices.ver'),
    'create' => can('driver.activacion.crear'),
    'detail' => can('driver.activacion.ver'),
    'send' => can('driver.activacion.enviar'),
    'cancel' => can('driver.activacion.cancelar'),
    'regenerate' => can('driver.activacion.regenerar'),
    'reactivate' => can('driver.activacion.reactivar'),
    'replace' => can('driver.activacion.reemplazar'),
    'enable' => can('driver.device.habilitar'),
    'disable' => can('driver.device.deshabilitar'),
    'assignVehicle' => can('driver.device.asignar_vehiculo'),
];
?>
<main class="admin-content driver-content" id="mainContent" data-driver-page="<?= htmlspecialchars($activePage, ENT_QUOTES, 'UTF-8') ?>" data-permissions="<?= htmlspecialchars(json_encode($driverPermissions), ENT_QUOTES, 'UTF-8') ?>">
  <div class="breadcrumb"><span>Administración</span><span class="breadcrumb-separator">/</span><span>Driver / Activación</span></div>
  <div class="page-head driver-page-head">
    <div>
      <div class="eyebrow">Driver / Activación <span class="eyebrow-line"></span> MÓDULO</div>
      <h1><?= htmlspecialchars($pageConfig['label'], ENT_QUOTES, 'UTF-8') ?></h1>
      <p><?= htmlspecialchars($pageConfig['description'], ENT_QUOTES, 'UTF-8') ?></p>
    </div>
    <?php if ($activePage === 'devices' && $driverPermissions['create']): ?>
      <button class="driver-button driver-button-primary" id="openCreateActivation" type="button">Nueva activación</button>
    <?php endif; ?>
  </div>
  <div class="driver-feedback" id="driverFeedback" role="status" aria-live="polite" hidden></div>
