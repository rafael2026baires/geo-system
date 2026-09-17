<aside class="admin-sidebar" id="adminSidebar" aria-label="Navegación principal">
  <div class="brand-row">
    <a class="brand" href="/admin/" aria-label="TwyVox Administración">
      <img class="brand-mark" src="/assets/images/brand/masters/twyvox-isotipo-color.svg" alt="">
      <img class="brand-word" src="/assets/images/brand/masters/twyvox-logotipo-blanco.svg" alt="TwyVox">
    </a>
    <button class="icon-button sidebar-collapse" id="sidebarCollapse" type="button" aria-label="Plegar menú" title="Plegar menú">‹</button>
  </div>
  <div class="sidebar-caption">WORKSPACE <span>ADMIN</span></div>
  <nav class="module-nav" aria-label="Módulos administrativos">
    <?php foreach ($visibleNavigation as $sectionKey => $sectionData): ?>
      <?php $isActive = $sectionKey === $activeSection; ?>
      <a class="module-link<?= $isActive ? ' is-active' : '' ?>" href="/admin/?section=<?= rawurlencode($sectionKey) ?>&amp;page=<?= rawurlencode(array_key_first($sectionData['pages'])) ?>" <?= $isActive ? 'aria-current="true"' : '' ?> title="<?= htmlspecialchars($sectionData['label'], ENT_QUOTES, 'UTF-8') ?>">
        <span class="module-icon" aria-hidden="true"><?= htmlspecialchars($sectionData['icon'], ENT_QUOTES, 'UTF-8') ?></span>
        <span class="module-label"><?= htmlspecialchars($sectionData['label'], ENT_QUOTES, 'UTF-8') ?></span>
        <span class="module-arrow" aria-hidden="true">↗</span>
      </a>
    <?php endforeach; ?>
  </nav>
  <div class="sidebar-bottom">
    <a class="dashboard-link" href="/index.php"><span aria-hidden="true">↗</span><span class="module-label">Ir al tablero operativo</span></a>
    <div class="sidebar-foot">TWYVOX <span> / ADMINISTRACIÓN</span></div>
  </div>
</aside>
