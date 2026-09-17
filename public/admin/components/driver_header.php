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
    'regenerate' => can('driver.activacion.regenerar'),
    'enable' => can('driver.device.habilitar'),
    'disable' => can('driver.device.deshabilitar'),
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
      <a class="driver-button driver-button-primary" href="/admin/?section=driver&amp;page=nueva_activacion">+ Nueva activación</a>
    <?php endif; ?>
  </div>
  <nav class="page-nav" aria-label="Páginas de Driver / Activación">
    <?php foreach ($visibleNavigation['driver']['pages'] as $pageKey => $item): ?>
      <?php if ($pageKey === 'gestion_activacion'): continue; endif; ?>
      <a href="/admin/?section=driver&amp;page=<?= rawurlencode($pageKey) ?>" class="page-tab<?= $pageKey === $activePage ? ' is-active' : '' ?>" <?= $pageKey === $activePage ? 'aria-current="page"' : '' ?>><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></a>
    <?php endforeach; ?>
  </nav>
  <div class="driver-feedback" id="driverFeedback" role="status" aria-live="polite" hidden></div>
