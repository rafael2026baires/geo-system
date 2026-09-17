<?php
declare(strict_types=1);

require __DIR__ . '/auth/admin_session.php';
require __DIR__ . '/auth/permissions.php';
$navigation = require __DIR__ . '/config/navigation.php';

$visibleNavigation = [];
foreach ($navigation as $sectionKey => $sectionData) {
    $visiblePages = array_filter($sectionData['pages'], static fn (array $page): bool => can($page['permission']));
    if ($visiblePages !== []) {
        $sectionData['pages'] = $visiblePages;
        $visibleNavigation[$sectionKey] = $sectionData;
    }
}

$requestedSection = $_GET['section'] ?? null;
$requestedPage = $_GET['page'] ?? null;
if (($requestedSection !== null && !is_string($requestedSection)) || ($requestedPage !== null && !is_string($requestedPage))) {
    http_response_code(404);
    exit('Página no encontrada');
}

if ($requestedSection === null && $requestedPage === null && $visibleNavigation !== []) {
    $requestedSection = array_key_first($visibleNavigation);
    $requestedPage = array_key_first($visibleNavigation[$requestedSection]['pages']);
} elseif ($requestedSection !== null && $requestedPage === null && isset($visibleNavigation[$requestedSection])) {
    $requestedPage = array_key_first($visibleNavigation[$requestedSection]['pages']);
}

if ($requestedSection !== null && (!isset($navigation[$requestedSection]) || !isset($navigation[$requestedSection]['pages'][$requestedPage]))) {
    http_response_code(404);
    exit('Página no encontrada');
}
if ($requestedSection === null && $requestedPage !== null) {
    http_response_code(404);
    exit('Página no encontrada');
}
if ($requestedSection !== null && !isset($visibleNavigation[$requestedSection]['pages'][$requestedPage])) {
    http_response_code(403);
    exit('Acceso no autorizado');
}
if ($requestedSection === 'driver' && $adminUser['role'] !== 'admin') {
    http_response_code(403);
    exit('Acceso no autorizado');
}

$activeSection = $requestedSection;
$activePage = $requestedPage;
$pageConfig = $activeSection !== null ? $navigation[$activeSection]['pages'][$activePage] : null;
$pageFile = $pageConfig !== null ? __DIR__ . '/pages/' . $pageConfig['file'] : null;

require __DIR__ . '/includes/header.php';
require __DIR__ . '/includes/sidebar.php';
require __DIR__ . '/includes/topbar.php';
if ($pageFile !== null) {
    define('TWYVOX_ADMIN_PAGE', true);
    require $pageFile;
} else {
    echo '<main class="admin-content"><div class="empty-state"><h1>Sin páginas disponibles</h1><p>Tu sesión no tiene páginas administrativas habilitadas.</p></div></main>';
}
echo '</div></div><script src="/admin/assets/js/admin.js" defer></script></body></html>';
