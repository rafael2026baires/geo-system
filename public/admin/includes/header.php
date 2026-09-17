<?php
declare(strict_types=1);
$pageTitle = $pageConfig['label'] ?? 'Administración';
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101d2d">
  <title><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?> · TwyVox Admin</title>
  <link rel="stylesheet" href="/admin/assets/css/admin.css">
</head>
<body>
<div class="admin-shell" id="adminShell">
  <div class="drawer-backdrop" id="drawerBackdrop" hidden></div>
