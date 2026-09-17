<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (empty($_SESSION['tenant_id']) || empty($_SESSION['user_id'])) {
    header('Location: /login/login.html');
    exit;
}

$adminUser = [
    'id' => (int) $_SESSION['user_id'],
    'name' => (string) ($_SESSION['user_name'] ?? 'Usuario'),
    'role' => (string) ($_SESSION['role'] ?? ''),
];
$adminTenant = ['id' => (int) $_SESSION['tenant_id']];
