<?php
require_once __DIR__ . '/../../config/technical_access.php';
require_local_technical_access();

echo password_hash('moto33', PASSWORD_DEFAULT);
