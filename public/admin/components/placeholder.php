<?php
declare(strict_types=1);
if (!defined('TWYVOX_ADMIN_PAGE')) {
    http_response_code(403);
    exit;
}
$section = $navigation[$activeSection];
?>
<main class="admin-content" id="mainContent">
  <div class="breadcrumb"><span>Administración</span><span class="breadcrumb-separator">/</span><span><?= htmlspecialchars($section['label'], ENT_QUOTES, 'UTF-8') ?></span></div>
  <div class="page-head">
    <div>
      <div class="eyebrow"><?= htmlspecialchars($section['label'], ENT_QUOTES, 'UTF-8') ?> <span class="eyebrow-line"></span> MÓDULO</div>
      <h1><?= htmlspecialchars($pageConfig['label'], ENT_QUOTES, 'UTF-8') ?></h1>
      <p><?= htmlspecialchars($pageConfig['description'], ENT_QUOTES, 'UTF-8') ?></p>
    </div>
    <span class="phase-badge"><span></span> Estructura inicial</span>
  </div>
  <nav class="page-nav" aria-label="Páginas de <?= htmlspecialchars($section['label'], ENT_QUOTES, 'UTF-8') ?>">
    <?php foreach ($visibleNavigation[$activeSection]['pages'] as $pageKey => $item): ?>
      <a href="/admin/?section=<?= rawurlencode($activeSection) ?>&amp;page=<?= rawurlencode($pageKey) ?>" class="page-tab<?= $pageKey === $activePage ? ' is-active' : '' ?>" <?= $pageKey === $activePage ? 'aria-current="page"' : '' ?>><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></a>
    <?php endforeach; ?>
  </nav>
  <section class="workspace-card" aria-labelledby="workspaceTitle">
    <div class="workspace-card-top"><span>TWYVOX / <?= htmlspecialchars(strtoupper($activeSection), ENT_QUOTES, 'UTF-8') ?></span><span>01 — ESTRUCTURA</span></div>
    <div class="workspace-empty">
      <span class="empty-symbol" aria-hidden="true"><?= htmlspecialchars($section['icon'], ENT_QUOTES, 'UTF-8') ?></span>
      <span class="empty-overline">ESPACIO PREPARADO</span>
      <h2 id="workspaceTitle"><?= htmlspecialchars($pageConfig['label'], ENT_QUOTES, 'UTF-8') ?></h2>
      <p>Esta pantalla ya forma parte de la navegación administrativa. Su contenido funcional se incorporará en una etapa posterior.</p>
    </div>
    <div class="workspace-card-bottom"><span>ADMINISTRACIÓN TWYVOX</span><span>VISTA BASE</span></div>
  </section>
</main>
