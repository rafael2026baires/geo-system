<?php
session_start();

if (empty($_SESSION['tenant_id'])) {
    header('Location: /login/login.html');
    exit;
}

readfile('index.html');