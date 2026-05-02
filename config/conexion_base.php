<?php

require_once __DIR__ . '/env.php';

// Detectar entorno: local vs VPS
if (getEnv() === 'local') {          

    // Configuración LOCAL (XAMPP)
    if (!defined('DB_HOST')) define('DB_HOST', 'geo.local');
    if (!defined('DB_USER')) define('DB_USER', 'root');
    if (!defined('DB_PASS')) define('DB_PASS', ''); 
}
else {
    if (!defined('DB_HOST')) define('DB_HOST', 'geo.local');
    if (!defined('DB_USER')) define('DB_USER', 'root');
    if (!defined('DB_PASS')) define('DB_PASS', '');
}

class Conexion extends PDO {
    
    private $charset = 'utf8';
    public $nombreBd;

    public function __construct($bd = null) {
        
        $bd = $bd ?? 'geolocalizacion';
        $this->nombreBd = "pymebit_" . $bd; 
        
        try {
            parent::__construct(
                'mysql:host=' . DB_HOST . ';dbname=' . $this->nombreBd . ';charset=' . $this->charset, 
                DB_USER, 
                DB_PASS, 
                array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
            );
        } 
        catch (PDOException $e) {
            echo 'Error base: ' . $e->getMessage();
            exit;
        }
    }
}

?>