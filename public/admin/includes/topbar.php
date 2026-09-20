<div class="admin-main">
  <header class="admin-topbar">
    <div class="topbar-left">
      <button class="icon-button mobile-menu" id="mobileMenu" type="button" aria-label="Abrir menú" aria-controls="adminSidebar" aria-expanded="false">☰</button>
      <?php if (!($activeSection === 'driver' && $activePage === 'devices')): ?><div class="topbar-context"><span class="context-dot"></span> Espacio <strong>#<?= $adminTenant['id'] ?></strong></div><?php endif; ?>
    </div>
    <div class="topbar-account">
      <?php if ($activeSection === 'driver' && $activePage === 'devices'): ?>
      <?php $listUserName = trim((string) ($_SESSION['user_name'] ?? '')); ?>
      <?php $listInitial = preg_match('/^./u', $listUserName, $initialMatch) ? (function_exists('mb_strtoupper') ? mb_strtoupper($initialMatch[0], 'UTF-8') : strtoupper($initialMatch[0])) : ''; ?>
      <?php if ($adminUser['role'] !== ''): ?><span class="role-pill"><?= htmlspecialchars($adminUser['role'], ENT_QUOTES, 'UTF-8') ?></span><?php endif; ?>
      <?php if ($listUserName !== ''): ?><span class="user-avatar" aria-hidden="true"><?= htmlspecialchars($listInitial, ENT_QUOTES, 'UTF-8') ?></span><span class="user-name"><?= htmlspecialchars($listUserName, ENT_QUOTES, 'UTF-8') ?></span><?php endif; ?>
      <?php else: ?>
      <?php if ($adminUser['role'] !== ''): ?><span class="role-pill"><?= htmlspecialchars($adminUser['role'], ENT_QUOTES, 'UTF-8') ?></span><?php endif; ?>
      <span class="user-avatar" aria-hidden="true"><?= htmlspecialchars(strtoupper(substr($adminUser['name'], 0, 1)), ENT_QUOTES, 'UTF-8') ?></span>
      <span class="user-name"><?= htmlspecialchars($adminUser['name'], ENT_QUOTES, 'UTF-8') ?></span>
      <?php endif; ?>
      <a class="logout-link" href="/login/logout.php" title="Cerrar sesión">Salir</a>
    </div>
  </header>
