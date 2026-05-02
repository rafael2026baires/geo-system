<?php
session_start();

require_once __DIR__ . '/../../config/conexion_base.php';


// Validar POST
if (empty($_POST['email']) || empty($_POST['password'])) {
    header('Location: login.html');
    exit;
}

$email    = $_POST['email'];
$password = $_POST['password'];

// Conexión
$pdo = new Conexion();

// Buscar usuario
$sql = "
    SELECT 
      u.id,
      u.password_hash,
      u.name,
      u.role,
      u.tenant_id
    FROM usuarios u
    WHERE u.email = ?
      AND u.active = 1
    LIMIT 1
";
$stmt = $pdo->prepare($sql);
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    header('Location: login.html');
    exit;
}

// Verificar password
if (!password_verify($password, $user['password_hash'])) {
    header('Location: login.html');
    exit;
}

// Setear sesión (PUERTA DE ENTRADA DEFINITIVA)
$_SESSION['tenant_id'] = (int)$user['tenant_id'];
$_SESSION['user_id']   = $user['id'];
$_SESSION['user_name'] = $user['name']; 
$_SESSION['role']      = $user['role'];

// Redirigir al dashboard
header('Location: ../index.php');
exit;
