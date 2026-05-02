<?php
session_start();
session_unset();
session_destroy();
//header('Location: /apps/geo-system/public/login/login.html');
header('Location: /login/login.html');
exit;