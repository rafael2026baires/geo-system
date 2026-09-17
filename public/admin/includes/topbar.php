<div class="admin-main">
  <header class="admin-topbar">
    <div class="topbar-left">
      <button class="icon-button mobile-menu" id="mobileMenu" type="button" aria-label="Abrir menú" aria-controls="adminSidebar" aria-expanded="false">☰</button>
      <div class="topbar-context"><span class="context-dot"></span> Espacio <strong>#<?= $adminTenant['id'] ?></strong></div>
    </div>
    <div class="topbar-account">
      <?php if ($adminUser['role'] !== ''): ?><span class="role-pill"><?= htmlspecialchars($adminUser['role'], ENT_QUOTES, 'UTF-8') ?></span><?php endif; ?>
      <span class="user-avatar" aria-hidden="true"><?= htmlspecialchars(strtoupper(substr($adminUser['name'], 0, 1)), ENT_QUOTES, 'UTF-8') ?></span>
      <span class="user-name"><?= htmlspecialchars($adminUser['name'], ENT_QUOTES, 'UTF-8') ?></span>
      <a class="logout-link" href="/login/logout.php" title="Cerrar sesión">Salir</a>
    </div>
  </header>
